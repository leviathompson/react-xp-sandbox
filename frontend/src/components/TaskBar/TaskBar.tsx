import React, { Activity } from "react";
import type { IncomingDirectMessage } from "../../utils/messenger";
import { useContext } from "../../context/context";
import { DEFAULT_AVATAR_SRC } from "../../data/avatars";
import applicationsJSON from "../../data/applications.json";
import StartMenu from "../StartMenu/StartMenu";
import { Stopwatch } from "../Stopwatch/Stopwatch";
import TaskBarNotifications, { type TaskBarNotificationItem } from "../TaskBarNotifications/TaskBarNotifications";
import Tooltip from "../Tooltip/Tooltip";
import { buildShellContextMenu } from "../../utils/shell";
import { DIRECT_MESSAGES_POLL_MS, fetchIncomingDirectMessages, openMessengerChatWindow, openMessengerWindow } from "../../utils/messenger";
import { generateUniqueId, getCurrentWindow } from "../../utils/general";
import { playMessengerPopSound } from "../../utils/sounds";
import styles from "./TaskBar.module.scss";
import type { Application } from "../../context/types";

const applications = applicationsJSON as unknown as Record<string, Application>;
const NOTIFICATION_FADE_MS = 220;
const NOTIFICATION_LIFETIME_MS = 3000;

const buildNotificationPreview = (message: IncomingDirectMessage) => {
    const normalizedBody = (message.body || "").replace(/\s+/g, " ").trim();
    if (normalizedBody) return normalizedBody;

    if (message.attachment_name) return `sent a picture: ${message.attachment_name}`;
    if (message.attachment_src) return "sent a picture";
    return "sent you a message";
};

const TaskBar = () => {
    const {
        currentWindows,
        customApplications,
        isStartVisible,
        isTaskbarLocked,
        username,
        dispatch,
        openContextMenu,
    } = useContext();
    const [systemTrayIconDismissed, setSystemTrayIconDismissed] = React.useState(true);
    const [notifications, setNotifications] = React.useState<TaskBarNotificationItem[]>([]);
    const startButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const notificationTimersRef = React.useRef(new Map<number, number>());
    const notificationRemovalTimersRef = React.useRef(new Map<number, number>());
    const knownNotificationIdsRef = React.useRef(new Set<number>());
    const lastIncomingMessageIdRef = React.useRef(0);
    const hasPrimedIncomingRef = React.useRef(false);
    const isPollingIncomingRef = React.useRef(false);
    const startButton = startButtonRef.current;
    const mergedApplications = { ...applications, ...customApplications };

    const windowTabClickHandler = (event: React.MouseEvent<HTMLElement>) => {
        const windowTabSelector = "[data-label=taskBarWindowTab]";
        const windowTab = (event.target as HTMLElement).closest<HTMLElement>(windowTabSelector);
        if (!windowTab) return;

        const windowId = windowTab.dataset.windowId;
        if (!windowId) return;

        const updatedCurrentWindows = [...currentWindows];
        updatedCurrentWindows.map((currentWindow) => {
            if (windowId === currentWindow.id) {
                currentWindow.hidden = (currentWindow.active === true) ? true : false;
                currentWindow.active = (currentWindow.active === true) ? false : true;
            } else currentWindow.active = false;

        });
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const dismissNotification = React.useCallback((notificationId: number) => {
        if (!knownNotificationIdsRef.current.has(notificationId)) return;

        const displayTimer = notificationTimersRef.current.get(notificationId);
        if (displayTimer) {
            window.clearTimeout(displayTimer);
            notificationTimersRef.current.delete(notificationId);
        }

        setNotifications((currentNotifications) => currentNotifications.map((notification) => (
            notification.id === notificationId
                ? { ...notification, dismissed: true }
                : notification
        )));

        if (notificationRemovalTimersRef.current.has(notificationId)) return;

        const removalTimer = window.setTimeout(() => {
            notificationRemovalTimersRef.current.delete(notificationId);
            knownNotificationIdsRef.current.delete(notificationId);
            setNotifications((currentNotifications) => currentNotifications.filter((notification) => notification.id !== notificationId));
        }, NOTIFICATION_FADE_MS);

        notificationRemovalTimersRef.current.set(notificationId, removalTimer);
    }, []);

    const enqueueNotification = React.useCallback((message: IncomingDirectMessage) => {
        if (knownNotificationIdsRef.current.has(message.id)) return;

        knownNotificationIdsRef.current.add(message.id);
        setNotifications((currentNotifications) => ([
            ...currentNotifications,
            {
                id: message.id,
                senderId: message.sender_id,
                senderAvatarSrc: message.sender_avatar_src || DEFAULT_AVATAR_SRC,
                preview: buildNotificationPreview(message),
                dismissed: false,
            },
        ]));

        playMessengerPopSound();

        const displayTimer = window.setTimeout(() => {
            notificationTimersRef.current.delete(message.id);
            dismissNotification(message.id);
        }, NOTIFICATION_LIFETIME_MS);

        notificationTimersRef.current.set(message.id, displayTimer);
    }, [dismissNotification]);

    React.useEffect(() => {
        if (!username.trim()) {
            lastIncomingMessageIdRef.current = 0;
            hasPrimedIncomingRef.current = false;
            knownNotificationIdsRef.current.clear();
            notificationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
            notificationRemovalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
            notificationTimersRef.current.clear();
            notificationRemovalTimersRef.current.clear();
            setNotifications([]);
            return;
        }

        const loadIncomingMessages = async () => {
            if (isPollingIncomingRef.current) return;
            isPollingIncomingRef.current = true;

            try {
                const response = await fetchIncomingDirectMessages(username, lastIncomingMessageIdRef.current, 50);
                const incomingMessages = response.messages || [];

                if (!incomingMessages.length) {
                    hasPrimedIncomingRef.current = true;
                    return;
                }

                lastIncomingMessageIdRef.current = incomingMessages[incomingMessages.length - 1].id;

                if (!hasPrimedIncomingRef.current) {
                    hasPrimedIncomingRef.current = true;
                    return;
                }

                incomingMessages.forEach(enqueueNotification);
            } catch {
                // Ignore transient polling failures; the next interval will retry.
            } finally {
                isPollingIncomingRef.current = false;
            }
        };

        void loadIncomingMessages();
        const interval = window.setInterval(loadIncomingMessages, DIRECT_MESSAGES_POLL_MS);

        return () => {
            window.clearInterval(interval);
        };
    }, [enqueueNotification, username]);

    React.useEffect(() => () => {
        notificationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        notificationRemovalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    }, []);

    const openNotification = (notificationId: number) => {
        const notification = notifications.find((item) => item.id === notificationId);
        if (!notification) return;

        dismissNotification(notificationId);
        openMessengerChatWindow(notification.senderId, notification.senderAvatarSrc, currentWindows, dispatch);
    };

    const systemTrayIconClickHandler = () => {
        openMessengerWindow(currentWindows, dispatch);
    };

    const infoTrayIconClickHandler = () => {
        setSystemTrayIconDismissed(false);
    };

    const startButtonClickHandler = (event: React.MouseEvent) => {
        event?.stopPropagation();
        dispatch({ type: "SET_IS_START_VISIBLE", payload: (isStartVisible) ? false : true });

        dispatch({ type: "SET_IS_RECENT_DOCUMENTS_OPEN", payload: false });
        dispatch({ type: "SET_IS_ALL_PROGRAMS_OPEN", payload: false });

        const { currentWindow, updatedCurrentWindows } = getCurrentWindow(currentWindows);
        if (currentWindow) currentWindow.active = false;

        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const openTaskManagerWindow = () => {
        const existingWindow = currentWindows.find((window) => window.appId === "taskManager");

        if (existingWindow) {
            const updatedCurrentWindows = currentWindows.map((window) => ({
                ...window,
                active: window.id === existingWindow.id,
                hidden: window.id === existingWindow.id ? false : window.hidden,
            }));
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
            return;
        }

        const updatedCurrentWindows = currentWindows.map((window) => ({
            ...window,
            active: false,
        }));

        updatedCurrentWindows.push({
            id: generateUniqueId(),
            appId: "taskManager",
            active: true,
        });
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const onTaskbarContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();

        openContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: buildShellContextMenu("taskbar", {
                isTaskbarLocked,
                onOpenTaskManager: openTaskManagerWindow,
                onToggleTaskbarLock: () => dispatch({ type: "SET_IS_TASKBAR_LOCKED", payload: !isTaskbarLocked }),
            }),
        });
    };

    return (
        <div className={`${styles.taskBar} flex justify-between`} data-label="taskbar" data-locked={isTaskbarLocked} onContextMenu={onTaskbarContextMenu}>
            <button ref={startButtonRef} className={`${styles.startButton}`} onClick={startButtonClickHandler} data-selected={isStartVisible}>Start</button>
            <Activity mode={isStartVisible ? "visible" : "hidden"}>
                <StartMenu startButton={startButton} />
            </Activity>
            <ul className={`${styles.windows} flex items-center justify-start w-full`}>
                {currentWindows.map((currentWindow, index) => {
                    const appData = mergedApplications[currentWindow.appId];
                    if (!appData) return null;
                    const { title, icon, iconLarge, showOnTaskbar = true } = { ...appData };
                    if (!showOnTaskbar) return;

                    return (
                        <li key={index} onClick={windowTabClickHandler} data-label="taskBarWindowTab" data-active={currentWindow.active} data-window-id={currentWindow.id}>
                            <span className="w-full relative flex">
                                <img src={icon || iconLarge} width="14" height="14" className="mr-2 min-w-5.5"></img>
                                <span className="absolute ml-7">{title}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <TaskBarNotifications
                notifications={notifications}
                onOpen={openNotification}
                onDismiss={dismissNotification}
            />
            <div className={`${styles.systemTray} flex justify-center items-center`}>
                <ul className={styles.trayIcons}>
                    <li className={styles.trayItem}>
                        <button onClick={systemTrayIconClickHandler} className={styles.trayButton} aria-label="Open MSN Messenger">
                            <img src="/icon__messenger--large.png" width="14" height="14" className="min-w-[1.4rem]"></img>
                        </button>
                    </li>
                    <li className={`${styles.trayItem} relative`}>
                        <button onClick={infoTrayIconClickHandler} className={styles.trayButton} aria-label="Show project info">
                            <img src="/icon__info.png" width="14" height="14" className="min-w-[1.4rem]"></img>
                        </button>
                        <Tooltip heading="Windows XP React Edition" content="Still a work in progress, but this is a semi-authentic recreation of Windows XP created using React & Typescript." systemTrayIconDismissed={systemTrayIconDismissed} setSystemTrayIconDismissed={setSystemTrayIconDismissed} />
                    </li>
                </ul>
                <Stopwatch />
            </div>
        </div>
    );
};

export default TaskBar;
