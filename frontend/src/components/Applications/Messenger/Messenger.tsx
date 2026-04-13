import { useEffect, useMemo, useState } from "react";
import { useContext } from "../../../context/context";
import { DEFAULT_AVATAR_SRC } from "../../../data/avatars";
import { buildChatAppId, fetchActiveSessions } from "../../../utils/messenger";
import type { ActiveSession } from "../../../utils/messenger";
import { openApplication, updateCurrentActiveWindow } from "../../../utils/general";
import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./Messenger.module.scss";

type Presence = "online" | "away" | "busy" | "offline";

const PRESENCE_LABELS: Record<Presence, string> = {
    online: "Online",
    away: "Away",
    busy: "Busy",
    offline: "Offline",
};

const hashUserId = (value: string) => value
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

const getPresence = (session: ActiveSession, currentUsername: string): Presence => {
    if (session.user_id === currentUsername) return "online";

    const updatedAt = new Date(session.updated_at).getTime();
    const ageMs = Date.now() - updatedAt;
    if (ageMs <= 1000 * 60 * 15) return "online";
    if (ageMs <= 1000 * 60 * 60 * 24) return "away";
    if (ageMs <= 1000 * 60 * 60 * 24 * 7) return "busy";

    const fallbackStatuses: Presence[] = ["offline", "busy", "away"];
    return fallbackStatuses[hashUserId(session.user_id) % fallbackStatuses.length];
};

const formatLastSeen = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
};

const Messenger = () => {
    const { username, avatarSrc, currentWindows, dispatch } = useContext();
    const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchActiveSessions>>["sessions"]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let isCancelled = false;

        const loadSessions = async () => {
            try {
                const data = await fetchActiveSessions(100);
                if (isCancelled) return;

                setSessions(data.sessions || []);
                setErrorMessage("");
            } catch (error) {
                if (isCancelled) return;
                setErrorMessage(error instanceof Error ? error.message : "Unable to load active sessions.");
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        void loadSessions();
        const interval = window.setInterval(loadSessions, 30000);

        return () => {
            isCancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    const visibleSessions = useMemo(
        () => sessions
            .filter((session) => session.user_id !== username)
            .map((session) => ({
                ...session,
                avatarSrc: session.avatar_src || DEFAULT_AVATAR_SRC,
                presence: getPresence(session, username),
            })),
        [sessions, username],
    );

    const openChatWindow = (peerId: string, peerAvatarSrc: string) => {
        const appId = buildChatAppId(peerId);

        dispatch({
            type: "REGISTER_CUSTOM_APPLICATION",
            payload: {
                appId,
                application: {
                    title: peerId,
                    icon: "/icon__messenger--large.png",
                    iconLarge: "/icon__messenger--large.png",
                    component: "MessengerChat",
                    width: 440,
                    height: 370,
                    top: 65,
                    left: 150,
                    content: {
                        peerId,
                        peerAvatarSrc,
                    },
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

    return (
        <div className={styles.messenger}>
            <WindowMenu menuItems={["File", "Contacts", "Actions", "Tools", "Help"]} />

            <header className={styles.identityCard}>
                <div className={styles.brandRow}>
                    <img src="/icon__msn--large.png" width="30" height="30" />
                    <span>MSN Messenger</span>
                </div>

                <div className={styles.profileRow}>
                    <img src={avatarSrc || DEFAULT_AVATAR_SRC} alt="" />
                    <div>
                        <h2>{username || "User"}</h2>
                        <p>{PRESENCE_LABELS.online}</p>
                    </div>
                </div>

                <button type="button" className={styles.statusInput}>
                    &lt;Type a personal message&gt;
                </button>
            </header>

            <main className={styles.content}>
                <div className={styles.noticeCard}>
                    <span className={styles.infoBubble}>i</span>
                    <p>Click here to learn about the Customer Experience Improvement Program.</p>
                </div>

                <button type="button" className={styles.addContactButton}>
                    <span className={styles.addContactIcon}>+</span>
                    Add a contact
                </button>

                <section className={styles.listShell}>
                    <div className={styles.listHeader}>
                        <span>Active User Sessions</span>
                        <span>{visibleSessions.length}</span>
                    </div>

                    <div className={styles.sessionList}>
                        {isLoading && <p className={styles.emptyState}>Loading active sessions...</p>}
                        {!isLoading && errorMessage && <p className={styles.emptyState}>{errorMessage}</p>}
                        {!isLoading && !errorMessage && visibleSessions.length === 0 && (
                            <p className={styles.emptyState}>No user sessions have been recorded yet.</p>
                        )}

                        {!isLoading && !errorMessage && visibleSessions.map((session) => (
                            <button
                                key={session.user_id}
                                type="button"
                                className={styles.sessionRow}
                                onClick={() => openChatWindow(session.user_id, session.avatarSrc)}
                            >
                                <span className={styles.presenceIcon} data-presence={session.presence} />
                                <img src={session.avatarSrc} alt="" />
                                <div className={styles.sessionMeta}>
                                    <div className={styles.nameRow}>
                                        <strong>{session.user_id}</strong>
                                        <span className={styles.statusText}>({PRESENCE_LABELS[session.presence]})</span>
                                    </div>
                                    <span className={styles.lastSeen}>Last active {formatLastSeen(session.updated_at)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <footer className={styles.footerBrand}>
                    <img src="/icon__msn--large.png" width="40" height="40" />
                    <div>
                        <strong>MSN Messenger</strong>
                        <span>.NET</span>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default Messenger;
