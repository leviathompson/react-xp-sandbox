import { useEffect, useMemo, useState } from "react";
import { useContext } from "../../context/context";
import applicationsJSON from "../../data/applications.json";
import { getShellEntryId } from "../../utils/shell";
import styles from "./ShellBrowserDialog.module.scss";
import type { Application } from "../../context/types";

interface ShellBrowserDialogProps {
    title: string;
    confirmLabel: string;
    mode: "open" | "save";
    initialContainerId?: string;
    initialFileName?: string;
    filterFile?: (appId: string, application: Application) => boolean;
    onClose: () => void;
    onConfirm: (selection: {
        containerId: string;
        appId?: string;
        fileName?: string;
        application?: Application;
    }) => void;
}

const baseApplications = applicationsJSON as unknown as Record<string, Application>;
const commonPlaces = ["desktop", "documents", "pictures", "computer"];
const saveTypeLabel = "24-bit Bitmap (*.bmp)";

const ShellBrowserDialog = ({
    title,
    confirmLabel,
    mode,
    initialContainerId = "pictures",
    initialFileName = "",
    filterFile,
    onClose,
    onConfirm,
}: ShellBrowserDialogProps) => {
    const { username, shellFiles, customApplications } = useContext();
    const applications = useMemo(
        () => ({ ...baseApplications, ...customApplications }),
        [customApplications],
    );
    const [currentContainerId, setCurrentContainerId] = useState(initialContainerId);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [fileName, setFileName] = useState(initialFileName);

    useEffect(() => {
        setCurrentContainerId(initialContainerId);
        setSelectedAppId(null);
    }, [initialContainerId]);

    useEffect(() => {
        setFileName(initialFileName);
    }, [initialFileName]);

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
        .map((appId) => ({ appId, application: applications[appId] }))
        .filter((item): item is { appId: string; application: Application } => !!item.application);

    const isFolder = (application: Application) => application.component === "FileExplorer" && !application.shortcut && !application.link;
    const visibleItems = items.filter(({ appId, application }) => (
        isFolder(application) || !filterFile || filterFile(appId, application)
    ));

    const openFolder = (nextContainerId: string) => {
        setCurrentContainerId(nextContainerId);
        setSelectedAppId(null);
    };

    const onItemClick = (appId: string, application: Application) => {
        setSelectedAppId(appId);
        if (mode === "save" && !isFolder(application)) {
            setFileName(resolveTitle(appId).replace(/\.[^.]+$/, ""));
        }
    };

    const onItemDoubleClick = (appId: string, application: Application) => {
        if (isFolder(application)) {
            openFolder(appId);
            return;
        }

        if (mode === "open") {
            onConfirm({
                containerId: currentContainerId,
                appId,
                application,
            });
            return;
        }

        setSelectedAppId(appId);
        setFileName(resolveTitle(appId).replace(/\.[^.]+$/, ""));
    };

    const onConfirmClick = () => {
        if (mode === "open") {
            if (!selectedAppId) return;
            onConfirm({
                containerId: currentContainerId,
                appId: selectedAppId,
                application: applications[selectedAppId],
            });
            return;
        }

        const trimmedFileName = fileName.trim();
        if (!trimmedFileName) return;

        onConfirm({
            containerId: currentContainerId,
            appId: selectedAppId || undefined,
            application: selectedAppId ? applications[selectedAppId] : undefined,
            fileName: trimmedFileName,
        });
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
        <div className={styles.overlay}>
            <div className={styles.dialog}>
                <header className={styles.titleBar}>
                    <div className={styles.titleBarContent}>
                        <img src="/icon__paint.webp" alt="" />
                        <strong>{title}</strong>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </header>

                <div className={styles.topRow}>
                    <label className={styles.locationField}>
                        <span>{locationLabel}</span>
                        <select value={currentContainerId} onChange={(event) => openFolder(event.target.value)}>
                            {locationOptions.map((appId) => (
                                <option key={appId} value={appId}>{resolveTitle(appId)}</option>
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
                        {commonPlaces.map((appId) => (
                            <button
                                key={appId}
                                type="button"
                                className={styles.placeButton}
                                data-selected={currentContainerId === appId}
                                onClick={() => openFolder(appId)}
                            >
                                <img src={applications[appId]?.iconLarge || applications[appId]?.icon || "/icon__folder_open.png"} alt="" />
                                <span>{resolveTitle(appId)}</span>
                            </button>
                        ))}
                    </aside>

                    <section className={styles.listPane}>
                        <div className={styles.listHeader}>
                            <span>Name</span>
                            <span>Type</span>
                        </div>

                        <div className={styles.listBody}>
                            {visibleItems.map(({ appId, application }) => {
                                const folder = isFolder(application);

                                return (
                                    <button
                                        key={appId}
                                        type="button"
                                        className={styles.listRow}
                                        data-selected={selectedAppId === appId}
                                        onClick={() => onItemClick(appId, application)}
                                        onDoubleClick={() => onItemDoubleClick(appId, application)}
                                    >
                                        <span className={styles.nameCell}>
                                            <img src={application.iconLarge || application.icon || (folder ? "/icon__folder_open.png" : "/icon__pictures.png")} alt="" />
                                            <span>{resolveTitle(appId)}</span>
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
                            <button type="button" onClick={onClose}>
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
                            <button type="button" onClick={onClose}>
                                Cancel
                            </button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default ShellBrowserDialog;
