import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import { getThumbnailIconSrc } from "../../../utils/applicationIcon";
import { emitShellBrowserResult, matchesShellBrowserFilter } from "../../../utils/shellBrowser";
import { getShellEntryId } from "../../../utils/shell";
import styles from "./ShellBrowser.module.scss";
import type { Application } from "../../../context/types";
import type { ShellBrowserWindowContent } from "../../../utils/shellBrowser";

interface ShellBrowserProps {
    appId: string;
    id?: string | number;
    content?: unknown;
}

const baseApplications = applicationsJSON as unknown as Record<string, Application>;
const commonPlaces = ["desktop", "documents", "pictures", "computer"];
const saveTypeLabel = "24-bit Bitmap (*.bmp)";

const ShellBrowser = ({ id, content }: ShellBrowserProps) => {
    const { username, shellFiles, customApplications, currentWindows, dispatch } = useContext();
    const {
        dialogId,
        confirmLabel,
        mode,
        initialContainerId = "pictures",
        initialFileName = "",
        filter = null,
    } = (content || {}) as ShellBrowserWindowContent;
    const applications = useMemo(
        () => ({ ...baseApplications, ...customApplications }),
        [customApplications],
    );
    const [currentContainerId, setCurrentContainerId] = useState(initialContainerId);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [fileName, setFileName] = useState(initialFileName);
    const didSubmitRef = useRef(false);
    const isLifecycleReadyRef = useRef(false);

    useEffect(() => {
        setCurrentContainerId(initialContainerId);
        setSelectedAppId(null);
    }, [initialContainerId]);

    useEffect(() => {
        setFileName(initialFileName);
    }, [initialFileName]);

    useEffect(() => {
        const readyTimer = window.setTimeout(() => {
            isLifecycleReadyRef.current = true;
        }, 0);

        return () => {
            window.clearTimeout(readyTimer);
            if (!isLifecycleReadyRef.current || didSubmitRef.current || !dialogId) return;

            emitShellBrowserResult({
                dialogId,
                cancelled: true,
            });
        };
    }, [dialogId]);

    const closeWindow = () => {
        if (id === undefined) return;
        dispatch({
            type: "SET_CURRENT_WINDOWS",
            payload: currentWindows.filter((window) => window.id !== id),
        });
    };

    const resolveTitle = (appId: string) => {
        const application = applications[appId];
        if (!application) return appId;
        return application.userFolder ? username : application.title;
    };

    const parentMap = useMemo(() => {
        const nextParentMap = new Map<string, string>();

        Object.entries(shellFiles).forEach(([containerId, entries]) => {
            entries.forEach((entry) => {
                nextParentMap.set(getShellEntryId(entry), containerId);
            });
        });

        return nextParentMap;
    }, [shellFiles]);

    const currentParentId = parentMap.get(currentContainerId) || null;
    const locationOptions = commonPlaces.includes(currentContainerId)
        ? commonPlaces
        : [currentContainerId, ...commonPlaces];

    const items = (shellFiles[currentContainerId] || [])
        .map(getShellEntryId)
        .map((entryAppId) => ({ appId: entryAppId, application: applications[entryAppId] }))
        .filter((item): item is { appId: string; application: Application } => !!item.application);

    const isFolder = (application: Application) => application.component === "FileExplorer" && !application.shortcut && !application.link;
    const visibleItems = items.filter(({ appId, application }) => (
        isFolder(application) || matchesShellBrowserFilter(filter, appId, application)
    ));

    const openFolder = (nextContainerId: string) => {
        setCurrentContainerId(nextContainerId);
        setSelectedAppId(null);
    };

    const onItemClick = (nextAppId: string, application: Application) => {
        setSelectedAppId(nextAppId);
        if (mode === "save" && !isFolder(application)) {
            setFileName(resolveTitle(nextAppId).replace(/\.[^.]+$/, ""));
        }
    };

    const submitSelection = (selection: {
        containerId: string;
        appId?: string;
        fileName?: string;
        application?: Application;
    }) => {
        if (!dialogId) return;
        didSubmitRef.current = true;
        closeWindow();
        window.setTimeout(() => {
            emitShellBrowserResult({
                dialogId,
                selection,
            });
        }, 0);
    };

    const onItemDoubleClick = (nextAppId: string, application: Application) => {
        if (isFolder(application)) {
            openFolder(nextAppId);
            return;
        }

        if (mode === "open") {
            submitSelection({
                containerId: currentContainerId,
                appId: nextAppId,
                application,
            });
            return;
        }

        setSelectedAppId(nextAppId);
        setFileName(resolveTitle(nextAppId).replace(/\.[^.]+$/, ""));
    };

    const onConfirmClick = () => {
        if (mode === "open") {
            if (!selectedAppId) return;
            submitSelection({
                containerId: currentContainerId,
                appId: selectedAppId,
                application: applications[selectedAppId],
            });
            return;
        }

        const trimmedFileName = fileName.trim();
        if (!trimmedFileName) return;

        submitSelection({
            containerId: currentContainerId,
            appId: selectedAppId || undefined,
            application: selectedAppId ? applications[selectedAppId] : undefined,
            fileName: trimmedFileName,
        });
    };

    const onCancel = () => {
        closeWindow();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        onConfirmClick();
    };

    const canConfirm = mode === "open"
        ? !!selectedAppId && visibleItems.some((item) => item.appId === selectedAppId && !isFolder(item.application))
        : fileName.trim().length > 0;

    const locationLabel = mode === "save" ? "Save in:" : "Look in:";

    return (
        <div className={styles.browserWindow}>
            <div className={styles.topRow}>
                <label className={styles.locationField}>
                    <span>{locationLabel}</span>
                    <select value={currentContainerId} onChange={(event) => openFolder(event.target.value)}>
                        {locationOptions.map((placeAppId) => (
                            <option key={placeAppId} value={placeAppId}>{resolveTitle(placeAppId)}</option>
                        ))}
                    </select>
                </label>

                <div className={styles.toolbarButtons}>
                    <button type="button" onClick={() => currentParentId && openFolder(currentParentId)} disabled={!currentParentId}>Up</button>
                    <button type="button" onClick={() => setSelectedAppId(null)}>Clear</button>
                </div>
            </div>

            <div className={styles.browser}>
                <aside className={styles.sidebar}>
                    {commonPlaces.map((placeAppId) => (
                        <button
                            key={placeAppId}
                            type="button"
                            className={styles.placeButton}
                            data-selected={currentContainerId === placeAppId}
                            onClick={() => openFolder(placeAppId)}
                        >
                            <img src={getThumbnailIconSrc(applications[placeAppId]) || "/icon__folder_open.png"} alt="" />
                            <span>{resolveTitle(placeAppId)}</span>
                        </button>
                    ))}
                </aside>

                <section className={styles.listPane}>
                    <div className={styles.listHeader}>
                        <span>Name</span>
                        <span>Type</span>
                    </div>

                    <div className={styles.listBody}>
                        {visibleItems.map(({ appId: itemAppId, application }) => {
                            const folder = isFolder(application);

                            return (
                                <button
                                    key={itemAppId}
                                    type="button"
                                    className={styles.listRow}
                                    data-selected={selectedAppId === itemAppId}
                                    onClick={() => onItemClick(itemAppId, application)}
                                    onDoubleClick={() => onItemDoubleClick(itemAppId, application)}
                                >
                                    <span className={styles.nameCell}>
                                        <img src={getThumbnailIconSrc(application) || (folder ? "/icon__folder_open.png" : "/icon__pictures.png")} alt="" />
                                        <span>{resolveTitle(itemAppId)}</span>
                                    </span>
                                    <span className={styles.typeCell}>{folder ? "File Folder" : "Bitmap Image"}</span>
                                </button>
                            );
                        })}

                        {visibleItems.length === 0 && (
                            <p className={styles.emptyState}>No files available here.</p>
                        )}
                    </div>
                </section>
            </div>

            {mode === "save" && (
                <footer className={styles.footer}>
                    <label className={styles.footerField}>
                        <span>File name:</span>
                        <input
                            type="text"
                            value={fileName}
                            onChange={(event) => setFileName(event.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="untitled"
                        />
                    </label>

                    <label className={styles.footerField}>
                        <span>Save as type:</span>
                        <select value={saveTypeLabel} disabled>
                            <option>{saveTypeLabel}</option>
                        </select>
                    </label>

                    <div className={styles.actions}>
                        <button type="button" onClick={onConfirmClick} disabled={!canConfirm}>
                            {confirmLabel}
                        </button>
                        <button type="button" onClick={onCancel}>
                            Cancel
                        </button>
                    </div>
                </footer>
            )}

            {mode === "open" && (
                <footer className={styles.openFooter}>
                    <div className={styles.actions}>
                        <button type="button" onClick={onConfirmClick} disabled={!canConfirm}>
                            {confirmLabel}
                        </button>
                        <button type="button" onClick={onCancel}>
                            Cancel
                        </button>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default ShellBrowser;
