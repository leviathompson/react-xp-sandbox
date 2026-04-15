import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useContext } from "../../../context/context";
import { avatarOptions } from "../../../data/avatars";
import { fileToAvatarDataUrl, saveUserProfile } from "../../../utils/userProfile";
import CollapseBox from "../../CollapseBox/CollapseBox";
import explorerStyles from "../FileExplorer/FileExplorer.module.scss";
import styles from "./UserAccounts.module.scss";

type SaveState =
    | { type: "idle"; message: string }
    | { type: "success"; message: string }
    | { type: "error"; message: string };

const UserAccounts = () => {
    const { username, avatarSrc, dispatch } = useContext();
    const [draftAvatarSrc, setDraftAvatarSrc] = useState(avatarSrc);
    const [isSaving, setIsSaving] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>({
        type: "idle",
        message: "Your picture appears on the login screen and in the Start menu.",
    });
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const trimmedUsername = username.trim();

    useEffect(() => {
        setDraftAvatarSrc(avatarSrc);
    }, [avatarSrc]);

    useEffect(() => {
        setSaveState({
            type: "idle",
            message: "Your picture appears on the login screen and in the Start menu.",
        });
    }, [trimmedUsername]);

    const hasChanges = draftAvatarSrc !== avatarSrc;
    const onPickBuiltInAvatar = (nextAvatarSrc: string) => {
        setDraftAvatarSrc(nextAvatarSrc);
        setSaveState({
            type: "idle",
            message: "Review your change, then save it when you're ready.",
        });
    };

    const onBrowseForPicture = () => {
        fileInputRef.current?.click();
    };

    const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setSaveState({ type: "error", message: "Choose an image file." });
            return;
        }

        try {
            const customAvatarSrc = await fileToAvatarDataUrl(file);
            setDraftAvatarSrc(customAvatarSrc);
            setSaveState({
                type: "idle",
                message: `Selected ${file.name}. Save to keep it for future sessions.`,
            });
        } catch (error) {
            setSaveState({
                type: "error",
                message: error instanceof Error ? error.message : "Unable to prepare that picture.",
            });
        }
    };

    const onCancel = () => {
        setDraftAvatarSrc(avatarSrc);
        setSaveState({
            type: "idle",
            message: "Unsaved changes were discarded.",
        });
    };

    const onSave = async () => {
        if (!trimmedUsername || !hasChanges) return;

        setIsSaving(true);
        setSaveState({
            type: "idle",
            message: "Saving your account picture...",
        });

        try {
            const profile = await saveUserProfile(trimmedUsername, { avatarSrc: draftAvatarSrc });
            dispatch({
                type: "SET_AVATAR_SRC",
                payload: profile.avatarSrc || draftAvatarSrc,
            });
            setSaveState({
                type: "success",
                message: "Your new account picture was saved.",
            });
        } catch (error) {
            setSaveState({
                type: "error",
                message: error instanceof Error ? error.message : "Unable to save your changes.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.userAccounts}>
            <header className={styles.toolbar}>
                <button type="button" className={styles.toolbarButton}>
                    <img src="/icon__back.png" width="22" height="22" alt="" />
                    <span>Back</span>
                </button>
                <button type="button" className={styles.toolbarButton}>
                    <img src="/icon__home--large.png" width="22" height="22" alt="" />
                    <span>Home</span>
                </button>
            </header>

            <main className={styles.content}>
                <aside className={`${explorerStyles.sidebar} ${styles.sidebar}`}>
                    <CollapseBox title="Current Picture">
                        <div className={styles.currentPicture}>
                            <img src={draftAvatarSrc} alt={`${trimmedUsername || "User"} avatar preview`} />
                            <div>
                                <strong>{trimmedUsername || "User"}</strong>
                            </div>
                        </div>
                    </CollapseBox>

                    <CollapseBox title="Learn About">
                        <p className={styles.sidebarInfo}>
                            <img src="/icon__info.png" width="16" height="16" alt="" />
                            <span>Your picture appears on the Welcome screen and in the Start menu.</span>
                        </p>
                    </CollapseBox>
                </aside>

                <section className={styles.mainPanel}>
                    <div className={styles.hero}>
                        <img src="/icon__switch_users--large.png" width="38" height="38" alt="" />
                        <div>
                            <h1>Pick a new picture for your account</h1>
                            <p>
                                The picture you choose will appear on the Welcome screen for{" "}
                                <strong>{trimmedUsername || "User"}</strong>.
                            </p>
                        </div>
                    </div>

                    <div className={styles.avatarPicker}>
                        <div className={styles.avatarGrid}>
                            {avatarOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={styles.avatarOption}
                                    data-selected={draftAvatarSrc === option.src}
                                    onClick={() => onPickBuiltInAvatar(option.src)}
                                    title={option.label}
                                >
                                    <img src={option.src} alt={option.label} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="button" className={styles.browseLink} onClick={onBrowseForPicture}>
                        <img src="/icon__pictures.png" width="18" height="18" alt="" />
                        <span>Browse for more pictures</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.fileInput}
                        onChange={onFileChange}
                    />

                    <div className={styles.footer}>
                        <p className={styles.status} data-state={saveState.type}>
                            {saveState.message}
                        </p>

                        <div className={styles.actions}>
                            <button type="button" onClick={onSave} disabled={!hasChanges || isSaving || !trimmedUsername}>
                                {isSaving ? "Saving..." : "Change Picture"}
                            </button>
                            <button type="button" onClick={onCancel} disabled={!hasChanges || isSaving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default UserAccounts;
