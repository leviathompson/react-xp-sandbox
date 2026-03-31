import { useState, useRef } from "react";
import { useContext } from "../../context/context";
import applicationsJSON from "../../data/applications.json";
import { throttle } from "../../utils/general";
import { openApplication } from "../../utils/general";
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
    const { currentWindows, dispatch } = useContext();
    const [position, setPosition] = useState<AbsoluteObject>({ top, right, bottom, left });
    const desktopIconRef = useRef<HTMLButtonElement | null>(null);
    const desktopIcon = desktopIconRef.current;
    const isActive = id === selectedId;
    const appData = applications[appId];
    const { title, icon, iconLarge, link } = { ...appData };

    const lastTouchTapRef = useRef(0);
    const skipNextDoubleClickRef = useRef(false);

    const activateIcon = () => {
        if (link) return window.open(link, "_blank", "noopener,noreferrer");

        openApplication(appId, currentWindows, dispatch);
        setSelectedId("");
    };

    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
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

    const imageMask = (isActive) ? `url("${iconLarge || icon}")` : "";

    return (
        <button ref={desktopIconRef} className={styles.desktopIcon} data-selected={isActive} data-link={!!link} onClick={onClickHandler} onPointerDown={onPointerDown} onDoubleClick={onDoubleClickHandler} style={{ top: position.top, right: position.right, bottom: position.bottom, left: position.left, touchAction: "none" }}>
            <span style={{ maskImage: imageMask }}><img src={iconLarge || icon} width="50" draggable={false} /></span>
            <div className="relative w-full flex justify-center"><h4 className="text-center">{title}</h4></div>
        </button>
    );
};

export default DesktopIcon;
