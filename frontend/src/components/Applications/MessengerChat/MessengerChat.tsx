import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "../../../context/context";
import { DEFAULT_AVATAR_SRC } from "../../../data/avatars";
import { fetchDirectMessages, sendDirectMessage } from "../../../utils/messenger";
import styles from "./MessengerChat.module.scss";

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

const MessengerChat = ({ content }: MessengerChatProps) => {
    const { username, avatarSrc } = useContext();
    const { peerId, peerAvatarSrc } = (content || {}) as MessengerChatContent;
    const [messages, setMessages] = useState<Awaited<ReturnType<typeof fetchDirectMessages>>["messages"]>([]);
    const [draftMessage, setDraftMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
        const interval = window.setInterval(loadMessages, 4000);

        return () => {
            isCancelled = true;
            window.clearInterval(interval);
        };
    }, [peerId, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
    }, [messages]);

    const statusNote = useMemo(() => {
        if (!messages.length) return `${peerId} has not sent any messages yet.`;

        const lastMessage = messages[messages.length - 1];
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
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to send message.");
        } finally {
            setIsSending(false);
        }
    };

    const onDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;

        event.preventDefault();
        void onSend();
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

                    <div className={styles.thread}>
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
                                        <p>{message.body}</p>
                                    </div>
                                </article>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.composer}>
                        <div className={styles.composerToolbar}>
                            <button type="button">A</button>
                            <button type="button">😊</button>
                            <button type="button">📷</button>
                            <button type="button">🎁</button>
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
