import { useMemo, useState } from "react";
import hotmailMail from "../../../data/hotmailMail.json";
import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./Hotmail.module.scss";

type Folder = {
    id: string;
    label: string;
};

type Message = {
    id: string;
    folderId: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    receivedAt: string;
    unread?: boolean;
    body: string;
};

type HotmailData = {
    accountEmail: string;
    folders: Folder[];
    messages: Message[];
};

const HOTMAIL_EMAIL = "gerrit@hotmail.com";
const HOTMAIL_PASSWORD = "password123";
const data = hotmailMail as HotmailData;

const formatListDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

const formatTimestamp = (iso: string) => new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

const getMessageSize = (message: Message) => {
    const bytes = new TextEncoder().encode(message.body).length;
    return `${Math.max(1, Math.round(bytes / 128))} KB`;
};

const Hotmail = () => {
    const [email, setEmail] = useState(HOTMAIL_EMAIL);
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState("inbox");
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    const folderCounts = useMemo(() => {
        return data.folders.reduce<Record<string, number>>((counts, folder) => {
            counts[folder.id] = data.messages.filter((message) => message.folderId === folder.id).length;
            return counts;
        }, {});
    }, []);

    const messages = useMemo(() => {
        return [...data.messages]
            .filter((message) => message.folderId === selectedFolderId)
            .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }, [selectedFolderId]);

    const selectedFolder = useMemo(() => {
        return data.folders.find((folder) => folder.id === selectedFolderId) || data.folders[0];
    }, [selectedFolderId]);

    const selectedMessage = useMemo(() => {
        if (!messages.length) return null;
        return messages.find((message) => message.id === selectedMessageId) || messages[0];
    }, [messages, selectedMessageId]);

    const onLogin = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (email.trim().toLowerCase() !== HOTMAIL_EMAIL || password !== HOTMAIL_PASSWORD) {
            setErrorMessage("Incorrect email or password.");
            return;
        }

        setIsAuthenticated(true);
        setErrorMessage("");
    };

    if (!isAuthenticated) {
        return (
            <div className={styles.hotmail}>
                <div className={styles.loginShell}>
                    <WindowMenu menuItems={["File", "Edit", "View", "Help"]} />
                    <div className={styles.loginPanel}>
                        <div className={styles.brandRow}>
                            <div className={styles.logoMark}>
                                <span className={styles.logoText}>msn</span>
                                <span className={styles.butterfly}>🦋</span>
                            </div>
                            <div>
                                <h1>Hotmail</h1>
                                <p>Sign in to read your archived mailbox.</p>
                            </div>
                        </div>

                        <form onSubmit={onLogin} className={styles.loginForm}>
                            <label>
                                <span>E-mail address</span>
                                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
                            </label>
                            <label>
                                <span>Password</span>
                                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" />
                            </label>
                            <button type="submit">Sign In</button>
                        </form>

                        <p className={styles.loginHint}>Use the Hotmail account credentials to continue.</p>
                        {errorMessage && <p className={styles.loginError}>{errorMessage}</p>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.hotmail}>
            <div className={styles.topBar}>
                <WindowMenu menuItems={["File", "Edit", "View", "Favorites", "Tools", "Help"]} />
                <div className={styles.brandStrip}>
                    <div className={styles.brandLockup}>
                        <div className={styles.logoMark}>
                            <span className={styles.logoText}>msn</span>
                            <span className={styles.butterfly}>🦋</span>
                        </div>
                        <div className={styles.mailboxTitle}>Inbox - My E-mail</div>
                    </div>
                    <div className={styles.utilityActions}>
                        <button type="button">Help &amp; Settings</button>
                        <button type="button">Sign Out</button>
                    </div>
                </div>

                <div className={styles.ribbon}>
                    {[
                        ["⌂", "Home"],
                        ["✉", "E-mail"],
                        ["★", "Favorites"],
                        ["👥", "Online Buddies"],
                        ["💬", "People & Chat"],
                        ["💰", "Money"],
                        ["🛍", "Shopping"],
                        ["🎵", "Music"],
                    ].map(([icon, label]) => (
                        <button key={label} type="button" className={styles.ribbonButton}>
                            <span>{icon}</span>
                            <strong>{label}</strong>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.workspace}>
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarHero}>
                        <div className={styles.sidebarMsn}>msn</div>
                        <span>My City</span>
                    </div>

                    <nav className={styles.sidebarNav}>
                        {["My Calendar", "My Stocks", "My Communities", "My Photos"].map((label) => (
                            <button key={label} type="button">
                                <span>{label}</span>
                                <span className={styles.sidebarArrow}>›</span>
                            </button>
                        ))}
                    </nav>

                    <div className={styles.searchCard}>
                        <h2>Search the Web</h2>
                        <div className={styles.searchBox}>
                            <input type="text" aria-label="Search the Web" />
                            <button type="button">Go</button>
                        </div>
                    </div>

                    <div className={styles.sidebarLogo}>
                        <span className={styles.logoText}>msn</span>
                        <span className={styles.butterfly}>🦋</span>
                    </div>

                    <div className={styles.mediaControls}>
                        <button type="button">◀</button>
                        <button type="button">▶</button>
                        <button type="button">■</button>
                    </div>
                </aside>

                <section className={styles.mainPane}>
                    <div className={styles.commandBar}>
                        <div className={styles.commandTitle}>Inbox - My E-mail</div>
                        <div className={styles.commandActions}>
                            {["Go", "Stop", "Print", "Refresh", "More Choices"].map((label) => (
                                <button key={label} type="button">{label}</button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.heroPanel}>
                        <div className={styles.heroBrand}>
                            <div className={styles.heroMsn}>
                                <span className={styles.logoText}>msn</span>
                                <span className={styles.butterfly}>🦋</span>
                            </div>
                            <h1>Hotmail</h1>
                        </div>
                        <div className={styles.heroPromo}>
                            <h2>Online Buddies</h2>
                            <p>How do you send a butterfly to your Pal to make her smile?</p>
                        </div>
                    </div>

                    <div className={styles.tabs}>
                        {["My E-mail", "Write E-mail", "Address Book", "Free Newsletters"].map((label, index) => (
                            <button key={label} type="button" data-active={index === 0 ? "true" : "false"}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.mailPanel}>
                        <header className={styles.mailToolbar}>
                            <div className={styles.folderPicker}>
                                <span>{selectedFolder.label}</span>
                                <span className={styles.folderCount}>({folderCounts[selectedFolder.id] || 0})</span>
                            </div>

                            <div className={styles.toolbarActions}>
                                {["Delete", "Put in Folder", "More"].map((label) => (
                                    <button key={label} type="button">{label}</button>
                                ))}
                            </div>
                        </header>

                        <div className={styles.contentArea}>
                            <aside className={styles.folderRail}>
                                <h2>Folders</h2>
                                <ul>
                                    {data.folders.map((folder) => (
                                        <li key={folder.id}>
                                            <button
                                                type="button"
                                                data-active={folder.id === selectedFolderId}
                                                onClick={() => {
                                                    setSelectedFolderId(folder.id);
                                                    setSelectedMessageId(null);
                                                }}
                                            >
                                                <span>{folder.label}</span>
                                                <strong>{folderCounts[folder.id] || 0}</strong>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </aside>

                            <div className={styles.messagePanel}>
                                <div className={styles.messageHeader}>
                                    <span>From</span>
                                    <span>Subject</span>
                                    <span>Date</span>
                                    <span>Size</span>
                                </div>

                                <div className={styles.messageList}>
                                    {messages.map((message) => (
                                        <button
                                            key={message.id}
                                            type="button"
                                            className={styles.messageRow}
                                            data-active={selectedMessage?.id === message.id}
                                            data-unread={message.unread ? "true" : "false"}
                                            onClick={() => setSelectedMessageId(message.id)}
                                        >
                                            <span className={styles.fromCell}>{message.fromName}</span>
                                            <span className={styles.subjectCell}>{message.subject}</span>
                                            <time dateTime={message.receivedAt}>{formatListDate(message.receivedAt)}</time>
                                            <span className={styles.sizeCell}>{getMessageSize(message)}</span>
                                        </button>
                                    ))}
                                </div>

                                <section className={styles.previewPane}>
                                    {selectedMessage ? (
                                        <>
                                            <header className={styles.previewHeader}>
                                                <h2>{selectedMessage.subject}</h2>
                                                <p>From: {selectedMessage.fromName} &lt;{selectedMessage.fromEmail}&gt;</p>
                                                <p>{formatTimestamp(selectedMessage.receivedAt)}</p>
                                            </header>
                                            <article className={styles.messageBody}>{selectedMessage.body}</article>
                                        </>
                                    ) : (
                                        <div className={styles.emptyState}>This folder is empty.</div>
                                    )}
                                </section>
                            </div>
                        </div>

                        <footer className={styles.statusFooter}>
                            <span>{selectedFolder.label} ({messages.filter((message) => message.unread).length} unread)</span>
                            <span>Page 1 of 1</span>
                        </footer>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Hotmail;
