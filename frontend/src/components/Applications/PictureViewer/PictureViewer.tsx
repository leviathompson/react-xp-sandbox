import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import { getShellEntryId } from "../../../utils/shell";
import styles from "./PictureViewer.module.scss";
import type { Application, currentWindow } from "../../../context/types";

interface PictureViewerProps {
    appId: string;
    id?: string | number;
}

const baseApplications = applicationsJSON as unknown as Record<string, Application>;

const PictureViewer = ({ appId, id }: PictureViewerProps) => {
    const { currentWindows, customApplications, shellFiles, dispatch } = useContext();
    const applications = { ...baseApplications, ...customApplications };
    const application = applications[appId];

    const parentContainerId = Object.entries(shellFiles).find(([, entries]) =>
        entries.some((entry) => getShellEntryId(entry) === appId)
    )?.[0];

    const relatedImages = parentContainerId
        ? (shellFiles[parentContainerId] || [])
            .map(getShellEntryId)
            .filter((entryAppId) => applications[entryAppId]?.component === "PictureViewer")
        : [appId];

    const currentIndex = relatedImages.indexOf(appId);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < relatedImages.length - 1;

    const updateActiveViewerWindow = (nextAppId: string) => {
        if (id === undefined) return;

        const updatedWindows = currentWindows.map((window) => {
            if (window.id !== id) return window;
            return {
                ...window,
                appId: nextAppId,
            } satisfies currentWindow;
        });

        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedWindows });
    };

    const onPrevious = () => {
        if (!hasPrevious) return;
        updateActiveViewerWindow(relatedImages[currentIndex - 1]);
    };

    const onNext = () => {
        if (!hasNext) return;
        updateActiveViewerWindow(relatedImages[currentIndex + 1]);
    };

    const imageSrc = application?.assetSrc || application?.iconLarge;

    return (
        <div className={styles.pictureViewer}>
            <main className={styles.stage}>
                {imageSrc ? (
                    <img src={imageSrc} alt={application?.title || "Picture preview"} />
                ) : (
                    <p>No preview available.</p>
                )}
            </main>

            <footer className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    <button type="button" onClick={onPrevious} disabled={!hasPrevious} aria-label="Previous picture">
                        ◀
                    </button>
                    <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Next picture">
                        ▶
                    </button>
                </div>

                <div className={styles.toolbarGroup}>
                    <button type="button" disabled aria-label="Rotate counterclockwise">⟲</button>
                    <button type="button" disabled aria-label="Delete">✕</button>
                    <button type="button" disabled aria-label="Rotate clockwise">⟳</button>
                </div>

                <div className={styles.toolbarGroup}>
                    <button type="button" disabled aria-label="Zoom in">＋</button>
                    <button type="button" disabled aria-label="Zoom out">－</button>
                    <button type="button" disabled aria-label="Help">?</button>
                </div>
            </footer>
        </div>
    );
};

export default PictureViewer;
