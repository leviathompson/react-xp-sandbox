import { useState, useRef, useEffect } from "react";
import { useContext } from "../../context/context";
import applicationsJSON from "../../data/applications.json";
import { throttle, updateCurrentActiveWindow } from "../../utils/general";
import { getWindowPadding, getMinimumWindowSize, getWindowClickRegion } from "../../utils/window";
import styles from "./Window.module.scss";
import type { Application, currentWindow } from "../../context/types";
import type { ReactNode } from "react";

interface WindowProps extends currentWindow {
    children: ReactNode;
}

const THROTTLE_DELAY = 50;
const VIEWPORT_BOTTOM_PADDING = 50;
const NON_AUTO_FIT_COMPONENTS = new Set(["InternetExplorer", "MediaPlayer", "PictureViewer", "Solitaire"]);
const taskBarHeight = document.querySelector("[data-label=taskbar]")?.getBoundingClientRect().height || 0;
const applications = applicationsJSON as unknown as Record<string, Application>;

const Window = ({ ...props }: WindowProps) => {
    const { id, appId, children, active = false, hidden = false } = props;
    const { currentWindows, customApplications, dispatch } = useContext();
    const { title, windowTitle, component, icon, iconLarge, showOnTaskbar = true, width = 500, height = 350, top = 75, right = undefined, bottom = undefined, left = 100, resizable = true, autoFitHeight = true, clampHeightToViewport = true } = { ...(applications[appId] || {}), ...(customApplications[appId] || {}) };
    const resolvedWindowTitle = windowTitle || (component === "Paint" ? `${title === "Paint" ? "untitled" : title} - Paint` : title);
    const shouldAutoFitHeight = autoFitHeight && !NON_AUTO_FIT_COMPONENTS.has(component || "");

    const dragWindowPadding = (window.innerWidth < 500) ? 12 : 3;
    const activeWindowRef = useRef<HTMLDivElement | null>(null);
    const getWindowShellHorizontalPadding = () => {
        if (activeWindowRef.current) {
            const activeWindowStyles = window.getComputedStyle(activeWindowRef.current);
            return (parseFloat(activeWindowStyles.paddingLeft) || 0) + (parseFloat(activeWindowStyles.paddingRight) || 0);
        }

        const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
        const shellPaddingRem = window.innerWidth >= rootFontSize * 50 ? 0.3 : 1.2;
        return shellPaddingRem * rootFontSize * 2;
    };
    const shellHorizontalPadding = getWindowShellHorizontalPadding();
    const maxViewportWindowWidth = Math.max(220, Math.floor(window.innerWidth - dragWindowPadding * 2 - shellHorizontalPadding));
    const isBiggerThanViewport = (width > maxViewportWindowWidth);

    const [{ top: topPos, right: rightPos, bottom: bottomPos, left: leftPos }, setWindowPosition] = useState({ top: (isBiggerThanViewport) ? 0 : top, left: (isBiggerThanViewport) ? 0 : left, right: (isBiggerThanViewport) ? undefined : right , bottom });

    const [[windowWidth, windowHeight], setWindowSize] = useState([(isBiggerThanViewport) ? maxViewportWindowWidth : width, height]);
    const [isMaximized, setIsMaximized] = useState(false);
    const [unmaximizedValues, setUnmaximizedValues] = useState({ left: "", top: "", width: "", height: "" });
    const titleBarRef = useRef<HTMLDivElement | null>(null);
    const offset = (leftPos + width + shellHorizontalPadding) - window.innerWidth;
    const windowContentRef = useRef<HTMLDivElement | null>(null);
    const didApplyAutoFitHeightRef = useRef(false);
    const desiredWindowHeightRef = useRef(height);

    const getMinimumWindowHeight = () => (titleBarRef.current?.getBoundingClientRect().height || 0) + (dragWindowPadding * 1.5);

    const getClampedWindowHeight = (
        desiredHeight: number,
        nextTop: number | undefined = topPos,
        nextBottom: number | undefined = bottomPos,
    ) => {
        if (!clampHeightToViewport || isMaximized) return desiredHeight;

        const minWindowHeight = getMinimumWindowHeight();
        const topConstraint = typeof nextTop === "number" ? nextTop : 0;
        const bottomConstraint = typeof nextBottom === "number"
            ? nextBottom + VIEWPORT_BOTTOM_PADDING
            : taskBarHeight + VIEWPORT_BOTTOM_PADDING;
        const maxAllowedHeight = Math.max(
            minWindowHeight,
            Math.floor(window.innerHeight - topConstraint - bottomConstraint - dragWindowPadding),
        );

        return Math.max(
            minWindowHeight,
            Math.min(desiredHeight, maxAllowedHeight),
        );
    };

    const isWindowMaximized = (
        activeWindowRef.current?.style?.left === "0px"
        && activeWindowRef.current?.style?.top === "0px"
        && activeWindowRef.current?.style?.width === "100%"
        && activeWindowRef.current?.style?.height === (window.innerHeight - taskBarHeight) + "px"
    );

    useEffect(() => {
        const activeWindow = activeWindowRef.current;
        if (!activeWindow) return;
        if (!isWindowMaximized) setIsMaximized(false);
        activeWindow.dataset.maximized = isMaximized.toString();

    }, [isWindowMaximized, isMaximized, setIsMaximized]);

    useEffect(() => {
        const onResize = () => {
            setWindowSize(() => [
                Math.min(width, width - offset),
                getClampedWindowHeight(desiredWindowHeightRef.current),
            ]);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [bottomPos, clampHeightToViewport, dragWindowPadding, height, isMaximized, offset, topPos, width]);

    useEffect(() => {
        if (!clampHeightToViewport || isMaximized) return;
        const clampedHeight = getClampedWindowHeight(desiredWindowHeightRef.current);

        setWindowSize(([currentWidth, currentHeight]) => (
            Math.abs(currentHeight - clampedHeight) > 1
                ? [currentWidth, clampedHeight]
                : [currentWidth, currentHeight]
        ));
    }, [bottomPos, clampHeightToViewport, dragWindowPadding, isMaximized, topPos]);

    useEffect(() => {
        const activeWindow = activeWindowRef.current;
        const windowContent = windowContentRef.current;
        if (!shouldAutoFitHeight || didApplyAutoFitHeightRef.current || !activeWindow || !windowContent || isMaximized) return;

        const contentRoot = windowContent.firstElementChild as HTMLElement | null;
        if (!contentRoot) return;

        let frameId = 0;

        const measureHeight = () => {
            const currentWindow = activeWindowRef.current;
            const currentWindowContent = windowContentRef.current;
            if (!currentWindow || !currentWindowContent) return;

            const measureHost = document.createElement("div");
            measureHost.style.position = "fixed";
            measureHost.style.left = "-10000px";
            measureHost.style.top = "0";
            measureHost.style.width = `${currentWindowContent.clientWidth}px`;
            measureHost.style.height = "auto";
            measureHost.style.maxHeight = "none";
            measureHost.style.visibility = "hidden";
            measureHost.style.pointerEvents = "none";
            measureHost.style.overflow = "visible";

            const clone = contentRoot.cloneNode(true) as HTMLElement;
            clone.style.height = "auto";
            clone.style.minHeight = "0";
            clone.style.maxHeight = "none";
            clone.style.overflow = "visible";

            measureHost.appendChild(clone);
            document.body.appendChild(measureHost);

            const naturalContentHeight = Math.ceil(clone.getBoundingClientRect().height);
            document.body.removeChild(measureHost);
            if (!Number.isFinite(naturalContentHeight) || naturalContentHeight <= 0) return;

            const chromeHeight = currentWindow.offsetHeight - currentWindowContent.clientHeight;
            const activeWindowTop = currentWindow.getBoundingClientRect().top;
            const maxWindowHeight = Math.max(
                chromeHeight,
                Math.floor(window.innerHeight - taskBarHeight - activeWindowTop - dragWindowPadding - VIEWPORT_BOTTOM_PADDING),
            );
            const targetWindowHeight = Math.max(
                chromeHeight,
                Math.min(naturalContentHeight + chromeHeight, maxWindowHeight),
            );

            didApplyAutoFitHeightRef.current = true;
            desiredWindowHeightRef.current = targetWindowHeight;
            setWindowSize(([currentWidth, currentHeight]) => (
                Math.abs(currentHeight - targetWindowHeight) > 1
                    ? [currentWidth, targetWindowHeight]
                    : [currentWidth, currentHeight]
            ));
        };

        const scheduleMeasure = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(measureHeight);
        };

        scheduleMeasure();

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [dragWindowPadding, isMaximized, shouldAutoFitHeight]);

    const toggleMaximizeWindow = (activeWindow: HTMLElement | null) => {
        if (!activeWindow) return;
        if (isMaximized) setIsMaximized(false);
        else {
            setIsMaximized(true);
            setUnmaximizedValues({
                left: activeWindow.style.left,
                top: activeWindow.style.top,
                width: activeWindow.style.width,
                height: activeWindow.style.height,
            });
        }

        activeWindow.style.left = (isMaximized) ? unmaximizedValues.left : "0px";
        activeWindow.style.top = (isMaximized) ? unmaximizedValues.top : "0px";
        activeWindow.style.width = (isMaximized) ? unmaximizedValues.width : "100%";
        activeWindow.style.height = (isMaximized) ? unmaximizedValues.height : window.innerHeight - taskBarHeight + "px";
    };

    const onTitleBarPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        const activeWindow = activeWindowRef.current;
        const activeWindowRect = activeWindow?.getBoundingClientRect();
        if (!activeWindowRect) return;
        
        const windowOffsetX = event.clientX - activeWindowRect.left;
        const windowOffsetY = event.clientY - activeWindowRect.top;
        if (activeWindow) {
            activeWindow.style.transition = "none";

            const iframe = activeWindow.querySelector("iframe");
            if (iframe) iframe.style.pointerEvents = "none";
        }

        const onPointerMove = (event: PointerEvent) => {
            if (isMaximized || event.clientY <= 0 || event.clientY > window.innerHeight - taskBarHeight) return;

            const nextTop = event.clientY - windowOffsetY;
            const nextHeight = getClampedWindowHeight(desiredWindowHeightRef.current, nextTop, undefined);

            setWindowPosition({ top: nextTop, left: event.clientX - windowOffsetX, right: undefined, bottom: undefined });
            setWindowSize(([currentWidth, currentHeight]) => (
                Math.abs(currentHeight - nextHeight) > 1
                    ? [currentWidth, nextHeight]
                    : [currentWidth, currentHeight]
            ));
            document.body.style.userSelect = "none";
        };
        const onThrottledPointerMove = throttle(onPointerMove, THROTTLE_DELAY);

        const onPointerUp = () => {
            window.removeEventListener("pointermove", onThrottledPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            document.body.style.userSelect = "";
            if (activeWindow) {
                activeWindow.style.removeProperty("transition");

                const iframe = activeWindow.querySelector("iframe");
                if (iframe) iframe.style.removeProperty("pointer-events");
            }

        };
        window.addEventListener("pointermove", onThrottledPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const onWindowPointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const activeWindow = activeWindowRef.current;
        if (!activeWindow || !resizable) return;

        if (activeWindow !== event.target) {
            activeWindow.style.removeProperty("cursor");
            return;
        }

        const WINDOW_PADDING = getWindowPadding(activeWindow);
        const region = getWindowClickRegion(event as unknown as PointerEvent, activeWindow, WINDOW_PADDING);

        const vertical =
        region.includes("top") ? "n" :
            region.includes("bottom") ? "s" : "";

        const horizontal =
        region.includes("left") ? "w" :
            region.includes("right") ? "e" : "";

        const direction = vertical + horizontal;

        activeWindow.style.cursor =
        direction ? `${direction}-resize` : "";
    };

    const onWindowPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        const updatedCurrentWindows = updateCurrentActiveWindow(id, currentWindows);
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });

        if (event.currentTarget !== event.target || !resizable) return;
        
        const activeWindow = activeWindowRef.current;
        const activeWindowRect = activeWindow?.getBoundingClientRect();
        const activeTitleBarHeight = titleBarRef.current?.getBoundingClientRect().height || 0;
        
        if (!activeWindow || !activeWindowRect) return;

        activeWindow.style.left = `${activeWindowRect.left}px`;
        activeWindow.style.removeProperty("right");

        const WINDOW_PADDING = getWindowPadding(activeWindow);
        const MIN_WINDOW_WIDTH = getMinimumWindowSize(activeWindow);
        const MIN_WINDOW_HEIGHT = activeTitleBarHeight + (WINDOW_PADDING * 1.5);
        const activeWindowRegion = getWindowClickRegion(event as unknown as PointerEvent, activeWindow, WINDOW_PADDING);
        document.body.style.userSelect = "none";
        if (activeWindow) activeWindow.style.transition = "none";

        const iframe = activeWindow.querySelector("iframe");
        if (iframe) iframe.style.pointerEvents = "none";

        const onPointerMove = (event: MouseEvent) => {
            let width = windowWidth;
            let height = windowHeight;
            let x = leftPos;
            let y = topPos;

            if (activeWindowRegion.includes("right")) {
                width = event.clientX - activeWindowRect.left;
                x = activeWindowRect.left;
            }
            
            if (activeWindowRegion.includes("bottom")) {
                height = Math.max((event.clientY - activeWindowRect.top), MIN_WINDOW_HEIGHT);
                x = activeWindowRect.left;
            }
            
            if (activeWindowRegion.includes("top")) {
                height = Math.max((activeWindowRect.bottom - event.clientY), MIN_WINDOW_HEIGHT);
                y = activeWindowRect.bottom - (height + WINDOW_PADDING);;
                x = activeWindowRect.left;
            }
            
            if (activeWindowRegion.includes("left")) {
                width = Math.max((activeWindowRect.right - event.clientX), MIN_WINDOW_WIDTH);
                x = activeWindowRect.right - (width + WINDOW_PADDING);
            }

            const clampedHeight = getClampedWindowHeight(height, y, undefined);

            desiredWindowHeightRef.current = height;
            setWindowPosition({ top: y, left: x, right: undefined, bottom: undefined });
            setWindowSize([width, clampedHeight]);
        };
        const onThrottledPointerMove = throttle(onPointerMove, THROTTLE_DELAY);

        const onPointerUp = () => {
            window.removeEventListener("pointermove", onThrottledPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            document.body.style.userSelect = "";
            if (activeWindow) {
                activeWindow.style.removeProperty("transition");

                const iframe = activeWindow.querySelector("iframe");
                if (iframe) iframe.style.removeProperty("pointer-events");
            }
        };

        window.addEventListener("pointermove", onThrottledPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const onButtonClick = (event: React.MouseEvent<HTMLElement>) => {
        const activeWindow = activeWindowRef.current;
        const buttonType = event.currentTarget.dataset.button;
        if (!activeWindow) return;

        if (buttonType === "close") {
            const updatedCurrentWindows = currentWindows.filter(item => item.id !== activeWindow?.dataset.windowId);
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
        }

        if (buttonType === "minimize") {
            const updatedCurrentWindows = [...currentWindows];
            const currentWindow = updatedCurrentWindows.find((currentWindow) => currentWindow.id === id);

            if (currentWindow) {
                currentWindow.hidden = true;
                currentWindow.active = false;
            }

            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
        }

        if (buttonType === "maximize") {
            toggleMaximizeWindow(activeWindow);
        }
    };

    return (
        <>
            <div ref={activeWindowRef} data-window-id={id} data-active={active} data-hidden={hidden} data-label="window" className={`${styles.window} absolute`} style={{ top: (!bottomPos) ? topPos : undefined, right: rightPos, bottom: bottomPos, left: (!rightPos) ? leftPos : undefined, height: windowHeight + "px", width: windowWidth + "px", touchAction: "none" }} onPointerDown={onWindowPointerDown} onPointerMove={onWindowPointerMove}>
                <div className="w-full h-full pointer-events-none">
                    <div ref={titleBarRef} className={`${styles.titleBar} flex justify-between pointer-events-auto`} data-label="titlebar" style={{ touchAction: "none" }} onPointerDown={onTitleBarPointerDown} onDoubleClick={() => toggleMaximizeWindow(activeWindowRef.current)}>
                        <div className="flex items-center">
                            {showOnTaskbar && (icon || iconLarge) && <img src={icon || iconLarge} width="14" height="14" className="mx-2 min-w-[1.4rem]"></img>}
                            <h3 className={(showOnTaskbar && (icon || iconLarge)) ? "" : "ml-2"}>{resolvedWindowTitle}</h3>
                        </div>
                        <div className="flex">
                            {resizable && (
                                <>
                                    <button onClick={onButtonClick} data-button="minimize">Minimise</button>
                                    <button onClick={onButtonClick} data-button="maximize" data-maximized={isMaximized}>Maximise</button>
                                </>
                            )}
                            <button onClick={onButtonClick} data-button="close">Close</button>
                        </div>
                    </div>
                    <div ref={windowContentRef} className={`${styles.windowContent} pointer-events-auto flex flex-col`} style={{ height: "calc(100% - 2.5rem)", width: "100%", background: "#fff" }}>{children}</div>
                </div>
            </div>
        </>
    );
};

export default Window;
