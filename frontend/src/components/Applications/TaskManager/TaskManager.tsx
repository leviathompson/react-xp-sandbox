import { useEffect, useMemo, useState } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import Button from "../../Button/Button";
import styles from "./TaskManager.module.scss";
import type { Application } from "../../../context/types";

const baseApplications = applicationsJSON as unknown as Record<string, Application>;

const TaskManager = () => {
    const { currentWindows, customApplications, dispatch } = useContext();
    const [selectedWindowId, setSelectedWindowId] = useState<string | number | null>(null);
    const applications = useMemo(
        () => ({ ...baseApplications, ...customApplications }),
        [customApplications],
    );

    const visibleWindows = useMemo(
        () => currentWindows.filter((window) => applications[window.appId]),
        [applications, currentWindows],
    );

    useEffect(() => {
        if (!visibleWindows.length) {
            setSelectedWindowId(null);
            return;
        }

        const selectionStillExists = visibleWindows.some((window) => window.id === selectedWindowId);
        if (!selectionStillExists) {
            setSelectedWindowId(visibleWindows[0].id);
        }
    }, [selectedWindowId, visibleWindows]);

    const onEndTask = () => {
        if (!selectedWindowId) return;

        dispatch({
            type: "SET_CURRENT_WINDOWS",
            payload: currentWindows.filter((window) => window.id !== selectedWindowId),
        });
    };

    const onSwitchTo = () => {
        if (!selectedWindowId) return;

        dispatch({
            type: "SET_CURRENT_WINDOWS",
            payload: currentWindows.map((window) => ({
                ...window,
                active: window.id === selectedWindowId,
                hidden: window.id === selectedWindowId ? false : window.hidden,
            })),
        });
    };

    return (
        <div className={styles.taskManager}>
            <div className={styles.listFrame}>
                <div className={styles.headerRow}>
                    <span>Task</span>
                    <span>Status</span>
                </div>
                <ul className={styles.windowList}>
                    {visibleWindows.map((window) => {
                        const app = applications[window.appId];
                        if (!app) return null;

                        const isSelected = window.id === selectedWindowId;
                        const status = window.hidden ? "Minimized" : window.active ? "Running" : "Open";

                        return (
                            <li key={window.id}>
                                <button
                                    type="button"
                                    className={styles.windowRow}
                                    data-selected={isSelected}
                                    onClick={() => setSelectedWindowId(window.id)}
                                    onDoubleClick={onSwitchTo}
                                >
                                    <span className={styles.windowTitle}>
                                        <img src={app.icon || app.iconLarge} width="16" height="16" alt="" />
                                        <span>{app.title}</span>
                                    </span>
                                    <span>{status}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <footer className={styles.footer}>
                <Button type="button" onClick={onSwitchTo} disabled={!selectedWindowId}>Switch To</Button>
                <Button type="button" onClick={onEndTask} disabled={!selectedWindowId}>End Task</Button>
            </footer>
        </div>
    );
};

export default TaskManager;
