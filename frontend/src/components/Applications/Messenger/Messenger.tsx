import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AnimatedScore from "../../AnimatedScore/AnimatedScore";
import { useContext } from "../../../context/context";
import { usePoints } from "../../../context/points";
import { DEFAULT_AVATAR_SRC } from "../../../data/avatars";
import { ACTIVE_SESSIONS_POLL_MS, fetchActiveSessions, openMessengerChatWindow } from "../../../utils/messenger";
import { subscribeToMessengerRealtime } from "../../../utils/messengerRealtime";
import type { ActiveSession } from "../../../utils/messenger";
import { saveUserProfile } from "../../../utils/userProfile";
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

const PERSONAL_MESSAGE_PLACEHOLDER = "<Type a personal message>";

const Messenger = () => {
    const { username, avatarSrc, personalMessage, currentWindows, dispatch } = useContext();
    const { awardPoints } = usePoints();
    const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchActiveSessions>>["sessions"]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [draftPersonalMessage, setDraftPersonalMessage] = useState(personalMessage);
    const [isSavingPersonalMessage, setIsSavingPersonalMessage] = useState(false);
    const sessionRowRefs = useRef(new Map<string, HTMLButtonElement>());
    const previousRowPositionsRef = useRef(new Map<string, DOMRect>());

    useEffect(() => {
        awardPoints("open-messenger");
    }, [awardPoints]);

    useEffect(() => {
        setDraftPersonalMessage(personalMessage);
    }, [personalMessage]);

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
        const interval = window.setInterval(loadSessions, ACTIVE_SESSIONS_POLL_MS);

        return () => {
            isCancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!username.trim()) return;

        return subscribeToMessengerRealtime(username, (event) => {
            if (event.type !== "points_updated") return;

            const { userId, score } = event.payload;
            setSessions((currentSessions) => {
                const targetIndex = currentSessions.findIndex((session) => session.user_id === userId);
                if (targetIndex === -1) return currentSessions;
                if (currentSessions[targetIndex].score === score) return currentSessions;

                return currentSessions.map((session) => (
                    session.user_id === userId
                        ? { ...session, score }
                        : session
                ));
            });
        });
    }, [username]);

    const visibleSessions = useMemo(
        () => sessions
            .map((session) => ({
                ...session,
                avatarSrc: session.avatar_src || DEFAULT_AVATAR_SRC,
                presence: getPresence(session, username),
            }))
            .sort((a, b) => (
                b.score - a.score
                || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                || a.user_id.localeCompare(b.user_id)
            )),
        [sessions, username],
    );
    const currentUserSession = useMemo(
        () => visibleSessions.find((session) => session.user_id === username) || null,
        [visibleSessions, username],
    );

    useLayoutEffect(() => {
        const nextPositions = new Map<string, DOMRect>();

        visibleSessions.forEach((session) => {
            const element = sessionRowRefs.current.get(session.user_id);
            if (!element) return;

            const nextRect = element.getBoundingClientRect();
            nextPositions.set(session.user_id, nextRect);

            const previousRect = previousRowPositionsRef.current.get(session.user_id);
            if (!previousRect) return;

            const deltaY = previousRect.top - nextRect.top;
            if (Math.abs(deltaY) < 1) return;

            element.style.transition = "none";
            element.style.transform = `translateY(${deltaY}px)`;

            window.requestAnimationFrame(() => {
                element.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
                element.style.transform = "translateY(0)";
            });
        });

        previousRowPositionsRef.current = nextPositions;
    }, [visibleSessions]);

    useEffect(() => () => {
        sessionRowRefs.current.clear();
        previousRowPositionsRef.current.clear();
    }, []);

    const savePersonalMessage = async () => {
        const trimmedUsername = username.trim();
        const nextPersonalMessage = draftPersonalMessage.trim();

        if (!trimmedUsername || nextPersonalMessage === personalMessage) return;

        setIsSavingPersonalMessage(true);

        try {
            const profile = await saveUserProfile(trimmedUsername, { personalMessage: nextPersonalMessage });
            dispatch({
                type: "SET_PERSONAL_MESSAGE",
                payload: profile.personalMessage || "",
            });
            setErrorMessage("");
            setSessions((currentSessions) => currentSessions.map((session) => (
                session.user_id === trimmedUsername
                    ? {
                        ...session,
                        personal_message: profile.personalMessage,
                    }
                    : session
            )));
        } catch (error) {
            setDraftPersonalMessage(personalMessage);
            setErrorMessage(error instanceof Error ? error.message : "Unable to save your personal message.");
        } finally {
            setIsSavingPersonalMessage(false);
        }
    };

    const onPersonalMessageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            void savePersonalMessage();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setDraftPersonalMessage(personalMessage);
        }
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
                    <AnimatedScore
                        value={currentUserSession?.score || 0}
                        className={styles.profileScore}
                        title={`${currentUserSession?.score || 0} points`}
                    />
                    <img src={avatarSrc || DEFAULT_AVATAR_SRC} alt="" />
                    <div>
                        <h2>{username || "User"}</h2>
                        <p>{PRESENCE_LABELS.online}</p>
                    </div>
                </div>

                <input
                    type="text"
                    className={styles.statusInput}
                    value={draftPersonalMessage}
                    placeholder={PERSONAL_MESSAGE_PLACEHOLDER}
                    maxLength={120}
                    onChange={(event) => setDraftPersonalMessage(event.target.value)}
                    onBlur={() => void savePersonalMessage()}
                    onKeyDown={onPersonalMessageKeyDown}
                    disabled={isSavingPersonalMessage}
                />
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
                                data-self={session.user_id === username}
                                onClick={() => {
                                    if (session.user_id === username) return;
                                    openMessengerChatWindow(session.user_id, session.avatarSrc, currentWindows, dispatch);
                                }}
                                ref={(node) => {
                                    if (node) {
                                        sessionRowRefs.current.set(session.user_id, node);
                                        return;
                                    }

                                    sessionRowRefs.current.delete(session.user_id);
                                    previousRowPositionsRef.current.delete(session.user_id);
                                }}
                            >
                                <span className={styles.presenceIcon} data-presence={session.presence} />
                                <AnimatedScore
                                    value={session.score}
                                    className={styles.score}
                                    title={`${session.score} points`}
                                />
                                <img src={session.avatarSrc} alt="" />
                                <div className={styles.sessionMeta}>
                                    <div className={styles.nameRow}>
                                        <strong>{session.user_id}</strong>
                                        {session.user_id === username && <span className={styles.selfTag}>You</span>}
                                        <span className={styles.statusText}>({PRESENCE_LABELS[session.presence]})</span>
                                        {session.personal_message && (
                                            <span className={styles.personalMessage} title={session.personal_message}>
                                                - {session.personal_message}
                                            </span>
                                        )}
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
