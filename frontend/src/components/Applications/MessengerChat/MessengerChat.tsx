import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "../../../context/context";
import { DEFAULT_AVATAR_SRC } from "../../../data/avatars";
import { generateUniqueId, openApplication, updateCurrentActiveWindow } from "../../../utils/general";
import { DIRECT_MESSAGES_POLL_MS, fetchDirectMessages, sendDirectMessage } from "../../../utils/messenger";
import { subscribeToMessengerRealtime } from "../../../utils/messengerRealtime";
import { addShellBrowserResultListener, openShellBrowserWindow } from "../../../utils/shellBrowser";
import { playMessengerSendSound } from "../../../utils/sounds";
import styles from "./MessengerChat.module.scss";
import type { Application } from "../../../context/types";

interface MessengerChatContent {
    peerId: string;
    peerAvatarSrc?: string;
}

interface MessengerChatProps {
    content?: unknown;
}

const toolbarItems = [
    { label: "Invite", icon: "/icon__messenger--large.png" },
    { label: "Send Files", icon: "/icon__file_explorer--large.png" },
    { label: "Voice", icon: "/icon__support--large.png" },
    { label: "Activities", icon: "/icon__solitaire--large.png" },
    { label: "Games", icon: "/icon__music--large.png" },
];

const formatTimestamp = (iso: string) => new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
});

const getAttachmentImageSrc = (application?: Application) => {
    const nextContent = application?.content as { imageSrc?: string } | undefined;
    return application?.assetSrc || nextContent?.imageSrc || application?.iconLarge || "";
};
const buildAttachmentAppId = (messageId: number) => `messengerAttachment:${messageId}`;

const MessengerChat = ({ content }: MessengerChatProps) => {
    const { username, avatarSrc, currentWindows, dispatch } = useContext();
    const { peerId, peerAvatarSrc } = (content || {}) as MessengerChatContent;
    const [messages, setMessages] = useState<Awaited<ReturnType<typeof fetchDirectMessages>>["messages"]>([]);
    const [draftMessage, setDraftMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const threadRef = useRef<HTMLDivElement | null>(null);
    const lastMessageIdRef = useRef<number | null>(null);
    const isAtBottomRef = useRef(true);
    const dialogHandlersRef = useRef(new Map<string, (selection?: {
        containerId: string;
        appId?: string;
        fileName?: string;
        application?: Application;
    }) => void>());

    useEffect(() => {
        if (!username || !peerId) return;

        let isCancelled = false;

        const loadMessages = async () => {
            try {
                const response = await fetchDirectMessages(username, peerId, 200);
                if (isCancelled) return;

                setMessages(response.messages || []);
                setErrorMessage("");
            } catch (error) {
                if (isCancelled) return;
                setErrorMessage(error instanceof Error ? error.message : "Unable to load messages.");
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        void loadMessages();
        const interval = window.setInterval(loadMessages, DIRECT_MESSAGES_POLL_MS);

        return () => {
            isCancelled = true;
            window.clearInterval(interval);
        };
    }, [peerId, username]);

    useEffect(() => {
        if (!username || !peerId) return;

        return subscribeToMessengerRealtime(username, (event) => {
            if (event.type === "message_created") {
                const { message } = event.payload;
                const isThreadMatch = (
                    (message.sender_id === username && message.recipient_id === peerId)
                    || (message.sender_id === peerId && message.recipient_id === username)
                );

                if (!isThreadMatch) return;

                setMessages((currentMessages) => {
                    if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
                        return currentMessages;
                    }

                    return [...currentMessages, message];
                });
                return;
            }
        });
    }, [peerId, username]);

    useEffect(() => {
        const thread = threadRef.current;
        if (!thread) return;

        const onScroll = () => {
            isAtBottomRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 2;
        };

        thread.addEventListener("scroll", onScroll);
        return () => thread.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!messages.length) return;
        const lastId = messages[messages.length - 1].id;
        const isNewMessage = lastId !== lastMessageIdRef.current;

        const thread = threadRef.current;
        if (!isNewMessage || !thread) return;

        lastMessageIdRef.current = lastId;

        if (isAtBottomRef.current) {
            thread.scrollTop = thread.scrollHeight;
        }
    }, [messages]);

    useEffect(() => addShellBrowserResultListener((detail) => {
        const handler = dialogHandlersRef.current.get(detail.dialogId);
        if (!handler) return;

        dialogHandlersRef.current.delete(detail.dialogId);
        handler(detail.selection);
    }), []);

    const statusNote = useMemo(() => {
        if (!messages.length) return `${peerId} has not sent any messages yet.`;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.attachment_src && !lastMessage.body) {
            return `${lastMessage.sender_id} shared a picture at ${formatTimestamp(lastMessage.created_at)}.`;
        }

        return `Last message ${formatTimestamp(lastMessage.created_at)} from ${lastMessage.sender_id}.`;
    }, [messages, peerId]);

    const onSend = async () => {
        const trimmedMessage = draftMessage.trim();
        if (!trimmedMessage || !username || !peerId) return;

        setIsSending(true);
        setErrorMessage("");

        try {
            const response = await sendDirectMessage(username, peerId, trimmedMessage);
            setMessages((currentMessages) => [...currentMessages, response.message]);
            setDraftMessage("");
            playMessengerSendSound();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to send message.");
        } finally {
            setIsSending(false);
        }
    };

    const onSendAttachment = async (application?: Application) => {
        const attachmentSrc = getAttachmentImageSrc(application);
        if (!username || !peerId || !attachmentSrc || !application) return;

        setIsSending(true);
        setErrorMessage("");

        try {
            const response = await sendDirectMessage(username, peerId, "", {
                attachmentSrc,
                attachmentName: application.title,
            });
            setMessages((currentMessages) => [...currentMessages, response.message]);
            playMessengerSendSound();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to send picture.");
        } finally {
            setIsSending(false);
        }
    };

    const onDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;

        event.preventDefault();
        void onSend();
    };

    const openAttachment = (message: typeof messages[number]) => {
        if (!message.attachment_src) return;

        const appId = buildAttachmentAppId(message.id);
        dispatch({
            type: "REGISTER_CUSTOM_APPLICATION",
            payload: {
                appId,
                application: {
                    title: message.attachment_name || "Shared Picture",
                    icon: "/icon__pictures.png",
                    iconLarge: message.attachment_src,
                    assetSrc: message.attachment_src,
                    component: "PictureViewer",
                    width: 560,
                    height: 430,
                    top: 95,
                    left: 145,
                },
            },
        });

        const existingWindow = currentWindows.find((window) => window.appId === appId);
        if (existingWindow) {
            dispatch({
                type: "SET_CURRENT_WINDOWS",
                payload: updateCurrentActiveWindow(existingWindow.id, currentWindows),
            });
            return;
        }

        openApplication(appId, currentWindows, dispatch);
    };

    const openAttachmentPicker = () => {
        const dialogId = generateUniqueId();

        dialogHandlersRef.current.set(dialogId, (selection) => {
            if (!selection?.application) return;
            void onSendAttachment(selection.application);
        });

        openShellBrowserWindow({
            dialogId,
            title: "Send a Picture",
            confirmLabel: "Send",
            mode: "open",
            currentWindows,
            dispatch,
            initialContainerId: "pictures",
            filter: "imageAttachments",
            icon: "/icon__pictures.png",
            iconLarge: "/icon__pictures--large.png",
            width: 620,
            height: 430,
            top: 110,
            left: 175,
        });
    };

    return (
        <div className={styles.chatWindow}>
            <header className={styles.toolbar}>
                {toolbarItems.map((item) => (
                    <button key={item.label} type="button" className={styles.toolbarItem}>
                        <img src={item.icon} alt="" />
                        <span>{item.label}</span>
                    </button>
                ))}
                <img src="/icon__msn--large.png" alt="" className={styles.toolbarBrand} />
            </header>

            <main className={styles.content}>
                <section className={styles.leftPane}>
                    <div className={styles.recipientBar}>
                        <span>To:</span>
                        <strong>{peerId}</strong>
                        <span className={styles.recipientAddress}>&lt;{peerId}@reactxp.msn&gt;</span>
                    </div>

                    <div className={styles.statusBanner}>
                        <span className={styles.infoBadge}>i</span>
                        <p>{statusNote}</p>
                    </div>

                    <div className={styles.thread} ref={threadRef}>
                        {isLoading && <p className={styles.emptyState}>Loading conversation...</p>}
                        {!isLoading && errorMessage && !messages.length && <p className={styles.emptyState}>{errorMessage}</p>}
                        {!isLoading && !messages.length && !errorMessage && (
                            <p className={styles.emptyState}>Send the first message to start this conversation.</p>
                        )}

                        {messages.map((message) => {
                            const isOwnMessage = message.sender_id === username;

                            return (
                                <article key={message.id} className={styles.messageRow} data-own={isOwnMessage}>
                                    <img
                                        src={isOwnMessage ? (avatarSrc || DEFAULT_AVATAR_SRC) : (peerAvatarSrc || DEFAULT_AVATAR_SRC)}
                                        alt=""
                                    />
                                    <div className={styles.messageBubble}>
                                        <div className={styles.messageMeta}>
                                            <strong>{message.sender_id}</strong>
                                            <span>{formatTimestamp(message.created_at)}</span>
                                        </div>
                                        {message.attachment_src && (
                                            <button
                                                type="button"
                                                className={styles.attachmentCard}
                                                onClick={() => openAttachment(message)}
                                            >
                                                <img src={message.attachment_src} alt={message.attachment_name || "Shared picture"} />
                                                <span>{message.attachment_name || "Picture"}</span>
                                            </button>
                                        )}
                                        {!!message.body && <p>{message.body}</p>}
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className={styles.composer}>
                        <div className={styles.composerToolbar}>
                            <button type="button">A</button>
                            <button type="button">{"\uD83D\uDE0A"}</button>
                            <button type="button" onClick={openAttachmentPicker} aria-label="Send a picture">{"\uD83D\uDCF7"}</button>
                            <button type="button">{"\uD83C\uDF81"}</button>
                        </div>

                        <div className={styles.composerBody}>
                            <textarea
                                value={draftMessage}
                                onChange={(event) => setDraftMessage(event.target.value)}
                                onKeyDown={onDraftKeyDown}
                                placeholder="Type your message here"
                            />
                            <button type="button" onClick={() => void onSend()} disabled={!draftMessage.trim() || isSending}>
                                {isSending ? "..." : "Send"}
                            </button>
                        </div>

                        {errorMessage && messages.length > 0 && <p className={styles.sendError}>{errorMessage}</p>}
                    </div>
                </section>

                <aside className={styles.rightPane}>
                    <div className={styles.avatarCard}>
                        <img src={peerAvatarSrc || DEFAULT_AVATAR_SRC} alt="" />
                        <span>{peerId}</span>
                    </div>
                    <div className={styles.avatarCard}>
                        <img src={avatarSrc || DEFAULT_AVATAR_SRC} alt="" />
                        <span>{username || "You"}</span>
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default MessengerChat;
