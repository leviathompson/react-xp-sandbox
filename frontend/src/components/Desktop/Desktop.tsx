import { useRef, useState } from "react";
import { useContext } from "../../context/context";
import filesJSON from "../../data/files.json";
import { buildShellContextMenu, createShellItemPayload } from "../../utils/shell";
import DesktopIcon from "../DesktopIcon/DesktopIcon";
import styles from "./Desktop.module.scss";
import applicationsJSON from "../../data/applications.json";
import type { AbsoluteObject, Application, ShellEntry } from "../../context/types";

const Files = filesJSON as unknown as Record<string, [string, AbsoluteObject][]>;
const Applications = applicationsJSON as unknown as Record<string, Application>;

const Desktop = () => {
    const { customFiles, customApplications, dispatch, openContextMenu } = useContext();
    const [selectedId, setSelectedId] = useState<number | string>("");
    const desktopRef = useRef<HTMLDivElement | null>(null);

    const applications = { ...Applications, ...customApplications };
    const desktopItems = [...Files.desktop, ...(customFiles.desktop || [])] as ShellEntry[];

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

    return (
        <div ref={desktopRef} className={styles.desktop} onContextMenu={onDesktopContextMenu}>
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
