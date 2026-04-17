import { useMemo } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./MediaPlayer.module.scss";
import type { Application } from "../../../context/types";

interface MediaPlayerProps {
    appId: string;
}

const baseApplications = applicationsJSON as unknown as Record<string, Application>;

const MediaPlayer = ({ appId }: MediaPlayerProps) => {
    const { customApplications } = useContext();
    const applications = useMemo(
        () => ({ ...baseApplications, ...customApplications }),
        [customApplications],
    );

    const application = applications[appId];
    const title = application?.title || "Windows Media Player";
    const artist = application?.artist || "No media selected";
    const album = application?.album || "Media Library";
    const embedUrl = application?.embedUrl;
    const artwork = application?.iconLarge || application?.icon;

    return (
        <div className={styles.mediaPlayer}>
            <WindowMenu menuItems={["File", "View", "Play", "Tools", "Help"]} />

            <div className={styles.shell}>
                <aside className={styles.leftRail}>
                    {["Now Playing", "Media Guide", "Copy from CD", "Media Library", "Radio Tuner", "Copy to CD or Device", "Skin Chooser"].map((label) => (
                        <button key={label} type="button" data-active={label === "Now Playing"}>{label}</button>
                    ))}
                </aside>

                <main className={styles.mainPanel}>
                    <div className={styles.nowPlayingBar}>
                        <span>Now Playing</span>
                    </div>

                    <div className={styles.contentRow}>
                        <section className={styles.stagePanel}>
                            <header className={styles.trackHeader}>
                                <p>{artist}</p>
                                <h2>{title}</h2>
                            </header>

                            <div className={styles.visualStage}>
                                {embedUrl ? (
                                    <iframe
                                        src={embedUrl}
                                        title={title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className={styles.emptyState}>
                                        <img src={application?.iconLarge || "/icon__media_player--large.png"} width="96" height="96" alt="" />
                                        <p>Select a media file to begin.</p>
                                    </div>
                                )}
                            </div>

                            <div className={styles.statusStrip}>
                                <span>{embedUrl ? "Now Playing" : "Ready"}</span>
                                <span>{album}</span>
                            </div>
                        </section>

                        <aside className={styles.infoPanel}>
                            <div className={styles.infoHeader}>Find Album Info</div>
                            <div className={styles.infoArtwork}>
                                {artwork ? <img src={artwork} width="82" height="82" alt="" /> : <span>♪</span>}
                            </div>
                            <div className={styles.playlistMeta}>
                                <p>{title}</p>
                                <span>{artist}</span>
                            </div>
                            <div className={styles.playlistRow}>
                                <span>{title}</span>
                                <span>{embedUrl ? "3:39" : "--:--"}</span>
                            </div>
                        </aside>
                    </div>
                </main>
            </div>

            <footer className={styles.transport}>
                <div className={styles.transportTop}>
                    <div className={styles.progressTrack}>
                        <span className={styles.progressFill}></span>
                    </div>
                </div>

                <div className={styles.transportBottom}>
                    <div className={styles.controls}>
                        {["⏮", "⏯", "⏹", "⏭", "🔊"].map((label) => (
                            <button key={label} type="button" disabled={!embedUrl}>{label}</button>
                        ))}
                    </div>

                    <div className={styles.volumeGroup}>
                        <span>Volume</span>
                        <div className={styles.volumeTrack}>
                            <span></span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MediaPlayer;
