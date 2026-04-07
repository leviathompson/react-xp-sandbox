import { useRef, useState } from "react";
import { useContext } from "../../context/context";
import { buildShellContextMenu, createShellItemPayload } from "../../utils/shell";
import DesktopIcon from "../DesktopIcon/DesktopIcon";
import styles from "./Desktop.module.scss";
import applicationsJSON from "../../data/applications.json";
import type { Application } from "../../context/types";
const Applications = applicationsJSON as unknown as Record<string, Application>;

const Desktop = () => {
    const { shellFiles, customApplications, dispatch, openContextMenu } = useContext();
    const [selectedId, setSelectedId] = useState<number | string>("");
    const [isDragOver, setIsDragOver] = useState(false);
    const desktopRef = useRef<HTMLDivElement | null>(null);

    const applications = { ...Applications, ...customApplications };
    const desktopItems = shellFiles.desktop || [];

    const onDesktopContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest("[data-label=desktop-icon]")) return;

        event.preventDefault();

        const rect = desktopRef.current?.getBoundingClientRect();
        const position = rect ? {
            top: event.clientY - rect.top - 20,
            left: event.clientX - rect.left - 20,
        } : undefined;

        openContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: buildShellContextMenu("desktop", {
                onCreateItem: (kind) => {
                    dispatch({
                        type: "CREATE_SHELL_ITEM",
                        payload: createShellItemPayload(kind, "desktop", applications, position),
                    });
                },
            }),
        });
    };

    const onDesktopDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (!Array.from(event.dataTransfer.types).includes("text/x-shell-item")) return;

        const targetIcon = (event.target as HTMLElement).closest("[data-label=desktop-icon]");
        if (targetIcon) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
    };

    const onDesktopDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
            setIsDragOver(false);
        }
    };

    const onDesktopDrop = (event: React.DragEvent<HTMLDivElement>) => {
        const payload = event.dataTransfer.getData("text/x-shell-item");
        setIsDragOver(false);
        if (!payload) return;

        const targetIcon = (event.target as HTMLElement).closest("[data-label=desktop-icon]");
        if (targetIcon) return;

        event.preventDefault();

        const draggedItem = JSON.parse(payload) as { appId: string; sourceContainerId: string };
        const rect = desktopRef.current?.getBoundingClientRect();
        const targetPosition = rect ? {
            top: event.clientY - rect.top - 20,
            left: event.clientX - rect.left - 20,
        } : undefined;

        dispatch({
            type: "MOVE_SHELL_ITEM",
            payload: {
                appId: draggedItem.appId,
                sourceContainerId: draggedItem.sourceContainerId,
                targetContainerId: "desktop",
                targetPosition,
            },
        });
    };

    return (
        <div
            ref={desktopRef}
            className={styles.desktop}
            data-drag-over={isDragOver}
            onContextMenu={onDesktopContextMenu}
            onDragLeave={onDesktopDragLeave}
            onDragOver={onDesktopDragOver}
            onDrop={onDesktopDrop}
        >
            {desktopItems.map((item, index) => {
                const [appId, { top = undefined, right = undefined, bottom = undefined, left = undefined }] = Array.isArray(item) ? item : [item, {}];
                
                return (
                    <DesktopIcon key={`${appId}-${index}`} id={appId} appId={appId} top={top} right={right} bottom={bottom} left={left} selectedId={selectedId} setSelectedId={setSelectedId} />
                );
            })}
        </div>
    );
};

export default Desktop;
