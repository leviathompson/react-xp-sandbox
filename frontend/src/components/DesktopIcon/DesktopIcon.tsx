import { useState, useRef } from "react";
import { useContext } from "../../context/context";
import { usePoints } from "../../context/points";
import applicationsJSON from "../../data/applications.json";
import { throttle } from "../../utils/general";
import { openApplication } from "../../utils/general";
import { buildShellContextMenu, createShortcutShellItemPayload } from "../../utils/shell";
import styles from "./DesktopIcon.module.scss";
import type { AbsoluteObject, Application } from "../../context/types";

type DesktopIconProps = AbsoluteObject & {
    id: string | number;
    appId: string;
    selectedId: string | number;
    setSelectedId: (value: string | number) => void;
};

const applications = applicationsJSON as unknown as Record<string, Application>;
const DOUBLE_TAP_DELAY_MS = 350;
const DOUBLE_TAP_MOVE_THRESHOLD_PX = 8;

const DesktopIcon = ({ appId, top = undefined, right = undefined, bottom = undefined, left = undefined, id, selectedId, setSelectedId }: DesktopIconProps) => {
    const { currentWindows, customApplications, dispatch, openContextMenu } = useContext();
    const { awardPoints } = usePoints();
    const [position, setPosition] = useState<AbsoluteObject>({ top, right, bottom, left });
    const desktopIconRef = useRef<HTMLButtonElement | null>(null);
    const desktopIcon = desktopIconRef.current;
    const isActive = id === selectedId;
    const mergedApplications = { ...applications, ...customApplications };
    const appData = { ...(applications[appId] || {}), ...(customApplications[appId] || {}) };
    const { title, icon, iconLarge, link, redirect, disabled, shortcut, component } = { ...appData };
    const isCustomItem = !!customApplications[appId];

    const lastTouchTapRef = useRef(0);
    const skipNextDoubleClickRef = useRef(false);

    const activateIcon = () => {
        if (disabled) return;
        if (link) return window.open(link, "_blank", "noopener,noreferrer");

        openApplication(redirect || appId, currentWindows, dispatch);
        setSelectedId("");
    };

    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;

        const desktopIconRect = desktopIcon?.getBoundingClientRect();
        if (!desktopIconRect) return;

        const xOffset = event.clientX - desktopIconRect.left;
        const yOffset = event.clientY - desktopIconRect.top;
        const initialPointerX = event.clientX;
        const initialPointerY = event.clientY;
        let hasPointerMovedBeyondTapThreshold = false;

        setSelectedId(id);

        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === "touch" && !hasPointerMovedBeyondTapThreshold) {
                const deltaX = Math.abs(event.clientX - initialPointerX);
                const deltaY = Math.abs(event.clientY - initialPointerY);
                if (deltaX > DOUBLE_TAP_MOVE_THRESHOLD_PX || deltaY > DOUBLE_TAP_MOVE_THRESHOLD_PX) {
                    hasPointerMovedBeyondTapThreshold = true;
                } else {
                    return;
                }
            }

            setPosition({
                top: event.clientY - yOffset,
                left: event.clientX - xOffset,
            });
            document.body.style.userSelect = "none";
            setSelectedId(id);
        };
        const throttledPointerMove = throttle(onPointerMove, 50);

        const onPointerUp = (upEvent: PointerEvent) => {
            window.removeEventListener("pointermove", throttledPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            document.body.style.userSelect = "";

            if (upEvent.pointerType === "touch" && !hasPointerMovedBeyondTapThreshold) {
                const now = performance.now();
                if (now - lastTouchTapRef.current < DOUBLE_TAP_DELAY_MS) {
                    skipNextDoubleClickRef.current = true;
                    activateIcon();
                    lastTouchTapRef.current = 0;
                } else {
                    lastTouchTapRef.current = now;
                }
            }
        };
        window.addEventListener("pointermove", throttledPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const onClickHandler = () => {
        setSelectedId(id);

        const onSecondClick = (event: PointerEvent) => {
            const target = (event.target as HTMLElement);
            if (event.target && target.closest("[data-selected") === desktopIcon) return;
            setSelectedId("");
            window.removeEventListener("pointerdown", onSecondClick);
        };

        window.addEventListener("pointerdown", onSecondClick);
    };

    const onDoubleClickHandler = () => {
        if (skipNextDoubleClickRef.current) {
            skipNextDoubleClickRef.current = false;
            return;
        }

        activateIcon();
    };

    const onContextMenuHandler = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setSelectedId(id);
        const shortcutSourcePosition = desktopIcon ? { top: desktopIcon.offsetTop, left: desktopIcon.offsetLeft } : position;

        openContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: buildShellContextMenu("desktopFolderItem", {
                canDelete: isCustomItem,
                canRename: isCustomItem,
                canOpen: !disabled,
                onOpen: activateIcon,
                onExplore: activateIcon,
                onCreateShortcut: () => {
                    dispatch({
                        type: "CREATE_SHELL_ITEM",
                        payload: createShortcutShellItemPayload(appId, appData, mergedApplications, shortcutSourcePosition),
                    });
                },
                onDelete: () => {
                    dispatch({
                        type: "SET_CURRENT_WINDOWS",
                        payload: currentWindows.filter((currentWindow) => currentWindow.appId !== appId),
                    });
                    dispatch({
                        type: "DELETE_SHELL_ITEM",
                        payload: {
                            containerId: "desktop",
                            appId,
                        },
                    });
                    setSelectedId("");
                },
                onRename: () => {
                    const nextTitle = window.prompt("Rename", title);
                    if (!nextTitle) return;

                    const trimmedTitle = nextTitle.trim();
                    if (!trimmedTitle || trimmedTitle === title) return;

                    dispatch({
                        type: "UPDATE_SHELL_ITEM",
                        payload: {
                            appId,
                            application: {
                                title: trimmedTitle,
                            },
                        },
                    });

                    if (component === "FileExplorer") {
                        awardPoints("rename-folder", {
                            metadata: { appId, title: trimmedTitle },
                        });
                    }
                },
            }),
        });
    };

    const imageMask = (isActive) ? `url("${iconLarge || icon}")` : "";

    return (
        <button ref={desktopIconRef} className={`${styles.desktopIcon} ${disabled ? "cursor-not-allowed" : ""}`} data-label="desktop-icon" data-selected={isActive} data-link={!!link} data-shortcut={shortcut} onClick={onClickHandler} onContextMenu={onContextMenuHandler} onPointerDown={onPointerDown} onDoubleClick={onDoubleClickHandler} style={{ top: position.top, right: position.right, bottom: position.bottom, left: position.left, touchAction: "none" }}>
            <span style={{ maskImage: imageMask }}><img src={iconLarge || icon} width="50" draggable={false} /></span>
            <div className="relative w-full flex justify-center"><h4 className="text-center">{title}</h4></div>
        </button>
    );
};

export default DesktopIcon;
