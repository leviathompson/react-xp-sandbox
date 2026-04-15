import { useMemo, useState } from "react";
import outlookMail from "../../../data/outlookMail.json";
import WindowMenu, { type WindowMenuDefinition } from "../../WindowMenu/WindowMenu";
import styles from "./Outlook.module.scss";

type OutlookFolder = {
    id: string;
    label: string;
    category: "favorite" | "mail";
    icon: string;
    virtual?: boolean;
};

type OutlookMessage = {
    id: string;
    folderId: string;
    fromName?: string;
    fromEmail?: string;
    toName?: string;
    toEmail?: string;
    subject: string;
    receivedAt: string;
    unread?: boolean;
    flagged?: boolean;
    draft?: boolean;
    junk?: boolean;
    body: string;
};

type OutlookData = {
    accountName: string;
    folders: OutlookFolder[];
    messages: OutlookMessage[];
};

const data = outlookMail as OutlookData;
const moduleButtons = ["Mail", "Calendar", "Contacts", "Tasks"];

const TOOLBAR_ACTIONS = [
    { label: "New", icon: "/icon__mail--large.png" },
    { label: "Reply", icon: "/icon__back.png" },
    { label: "Forward", icon: "/icon__forward.png" },
    { label: "Send/Receive", icon: "/icon__refresh--large.png" },
    { label: "Find", icon: "/icon__search--large.png" },
] as const;

const MENUS: WindowMenuDefinition[] = [
    { label: "File", items: [{ id: "file-new", label: "New" }, { id: "file-open", label: "Open" }, { id: "file-save", label: "Save" }] },
    { label: "Edit", items: [{ id: "edit-cut", label: "Cut", disabled: true }, { id: "edit-copy", label: "Copy", disabled: true }, { id: "edit-select", label: "Select All" }] },
    { label: "View", items: [{ id: "view-preview", label: "Preview Pane" }, { id: "view-reading", label: "Reading Pane Right", checked: true }] },
    { label: "Go", items: [{ id: "go-inbox", label: "Inbox" }, { id: "go-drafts", label: "Drafts" }, { id: "go-junk", label: "Junk E-mail" }] },
    { label: "Tools", items: [{ id: "tools-send-receive", label: "Send/Receive" }, { id: "tools-rules", label: "Rules and Alerts..." }, { id: "tools-options", label: "Options..." }] },
    { label: "Actions", items: [{ id: "actions-reply", label: "Reply" }, { id: "actions-forward", label: "Forward" }, { id: "actions-junk", label: "Junk E-mail" }] },
    { label: "Help", items: [{ id: "help-office", label: "Microsoft Outlook Help" }, { id: "help-about", label: "About Microsoft Outlook" }] },
];

const formatMessageTime = (iso: string) => new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

const isOutgoingMessage = (message: OutlookMessage) => {
    return message.draft || message.folderId === "outbox" || message.folderId === "sent";
};

const Outlook = () => {
    const [selectedFolderId, setSelectedFolderId] = useState("inbox");
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    const messageCounts = useMemo(() => {
        const unreadIds = new Set(data.messages.filter((message) => message.unread).map((message) => message.id));
        const flaggedIds = new Set(data.messages.filter((message) => message.flagged).map((message) => message.id));

        return {
            unread: unreadIds.size,
            followUp: flaggedIds.size,
            byFolder: data.messages.reduce<Record<string, number>>((counts, message) => {
                counts[message.folderId] = (counts[message.folderId] ?? 0) + 1;
                return counts;
            }, {}),
        };
    }, []);

    const messages = useMemo(() => {
        const baseMessages = [...data.messages].sort((a, b) => (
            new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
        ));

        if (selectedFolderId === "unread") {
            return baseMessages.filter((message) => message.unread);
        }

        if (selectedFolderId === "followUp") {
            return baseMessages.filter((message) => message.flagged);
        }

        return baseMessages.filter((message) => message.folderId === selectedFolderId);
    }, [selectedFolderId]);

    const selectedMessage = useMemo(() => {
        if (!messages.length) return null;
        return messages.find((message) => message.id === selectedMessageId) || messages[0];
    }, [messages, selectedMessageId]);

    const selectedFolder = data.folders.find((folder) => folder.id === selectedFolderId) || data.folders[0];

    const getFolderCount = (folder: OutlookFolder) => {
        if (folder.id === "unread") return messageCounts.unread;
        if (folder.id === "followUp") return messageCounts.followUp;
        return messageCounts.byFolder[folder.id] ?? 0;
    };

    const getMessageCounterparty = (message: OutlookMessage) => {
        if (isOutgoingMessage(message)) {
            return `${message.toName || "Unknown"} <${message.toEmail || "draft@example.com"}>`;
        }

        return `${message.fromName || "Unknown"} <${message.fromEmail || "unknown@example.com"}>`;
    };

    return (
        <div className={styles.outlook}>
            <div className={styles.topChrome}>
                <WindowMenu menus={MENUS} hasWindowsLogo={true} />

                <div className={styles.toolbar}>
                    <div className={styles.toolbarButtons}>
                        {TOOLBAR_ACTIONS.map((action) => (
                            <button key={action.label} type="button" className={styles.toolbarButton}>
                                <img src={action.icon} alt="" width="16" height="16" />
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>

                    <label className={styles.findBox}>
                        <span>Type a contact to find</span>
                        <input type="text" value="Type a contact to find" readOnly aria-label="Type a contact to find" />
                    </label>
                </div>
            </div>

            <div className={styles.workspace}>
                <aside className={styles.sidebar}>
                    <section className={styles.sidebarSection}>
                        <h2>Favorite Folders</h2>
                        <ul>
                            {data.folders.filter((folder) => folder.category === "favorite").map((folder) => (
                                <li key={folder.id}>
                                    <button
                                        type="button"
                                        data-active={folder.id === selectedFolderId}
                                        onClick={() => {
                                            setSelectedFolderId(folder.id);
                                            setSelectedMessageId(null);
                                        }}
                                    >
                                        <img src={folder.icon} alt="" width="14" height="14" />
                                        <span>{folder.label}</span>
                                        <strong>{getFolderCount(folder)}</strong>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className={styles.sidebarSection}>
                        <h2>All Mail Folders</h2>
                        <div className={styles.mailTreeRoot}>{data.accountName}</div>
                        <ul className={styles.mailTree}>
                            {data.folders.filter((folder) => folder.category === "mail").map((folder) => (
                                <li key={folder.id}>
                                    <button
                                        type="button"
                                        data-active={folder.id === selectedFolderId}
                                        onClick={() => {
                                            setSelectedFolderId(folder.id);
                                            setSelectedMessageId(null);
                                        }}
                                    >
                                        <img src={folder.icon} alt="" width="14" height="14" />
                                        <span>{folder.label}</span>
                                        <strong>{getFolderCount(folder)}</strong>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <nav className={styles.moduleNav}>
                        {moduleButtons.map((button) => (
                            <button key={button} type="button" data-active={button === "Mail"}>
                                {button}
                            </button>
                        ))}
                    </nav>
                </aside>

                <section className={styles.messagePane}>
                    <header className={styles.messagePaneHeader}>
                        <div>
                            <h1>{selectedFolder.label}</h1>
                            <p>{messages.length} item{messages.length === 1 ? "" : "s"}</p>
                        </div>
                        <button type="button" className={styles.sortButton}>Arranged By: Date</button>
                    </header>

                    <div className={styles.messageList}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>This folder is empty.</div>
                        ) : messages.map((message) => {
                            const sender = isOutgoingMessage(message)
                                ? (message.toName || message.toEmail || "Draft")
                                : (message.fromName || message.fromEmail || "Unknown sender");

                            return (
                                <button
                                    key={message.id}
                                    type="button"
                                    className={styles.messageRow}
                                    data-active={selectedMessage?.id === message.id}
                                    data-unread={message.unread ? "true" : "false"}
                                    onClick={() => setSelectedMessageId(message.id)}
                                >
                                    <div className={styles.messageFlags}>
                                        {message.flagged && <span title="Follow up">!</span>}
                                        {message.junk && <span title="Junk">J</span>}
                                        {message.draft && <span title="Draft">D</span>}
                                    </div>
                                    <div className={styles.messageMeta}>
                                        <strong>{sender}</strong>
                                        <span>{message.subject}</span>
                                    </div>
                                    <time dateTime={message.receivedAt}>{formatMessageTime(message.receivedAt)}</time>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className={styles.readingPane}>
                    {selectedMessage ? (
                        <>
                            <header className={styles.readingHeader}>
                                <h2>{selectedMessage.subject}</h2>
                                <dl>
                                    <div>
                                        <dt>{isOutgoingMessage(selectedMessage) ? "To:" : "From:"}</dt>
                                        <dd>{getMessageCounterparty(selectedMessage)}</dd>
                                    </div>
                                    <div>
                                        <dt>Sent:</dt>
                                        <dd>{formatMessageTime(selectedMessage.receivedAt)}</dd>
                                    </div>
                                    <div>
                                        <dt>Folder:</dt>
                                        <dd>{selectedFolder.label}</dd>
                                    </div>
                                </dl>
                            </header>

                            <article className={styles.messageBody}>
                                {selectedMessage.body}
                            </article>
                        </>
                    ) : (
                        <div className={styles.emptyReadingPane}>Choose a message to read.</div>
                    )}
                </section>
            </div>

            <footer className={styles.statusBar}>
                <span>{messages.length} item{messages.length === 1 ? "" : "s"}</span>
                <span>Connected</span>
            </footer>
        </div>
    );
};

export default Outlook;
