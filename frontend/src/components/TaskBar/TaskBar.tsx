import React, { Activity } from "react";
import { useContext } from "../../context/context";
import { Stopwatch } from "../Stopwatch/Stopwatch";
import applicationsJSON from "../../data/applications.json";
import { getCurrentWindow, generateUniqueId } from "../../utils/general";
import { buildShellContextMenu } from "../../utils/shell";
import StartMenu from "../StartMenu/StartMenu";
import Tooltip from "../Tooltip/Tooltip";
import styles from "./TaskBar.module.scss";
import type { Application } from "../../context/types";

const applications = applicationsJSON as unknown as Record<string, Application>;

const TaskBar = () => {
    const { currentWindows, customApplications, isStartVisible, isTaskbarLocked, dispatch, openContextMenu } = useContext();
    const [systemTrayIconDismissed, setSystemTrayIconDismissed] = React.useState(true);
    const startButtonRef = React.useRef<HTMLButtonElement | null>(null);
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

    const systemTrayIconClickHandler = () => {
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
            <div className={`${styles.systemTray} flex justify-center items-center`}>
                <ul className="flex">
                    <li className=" flex relative">
                        <button onClick={systemTrayIconClickHandler}>
                            <img src="/icon__info.png" width="14" height="14" className="cursor-pointer mr-2 min-w-[1.4rem]"></img>
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
