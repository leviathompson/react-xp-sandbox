import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useContext } from "../../../context/context";
import { avatarOptions } from "../../../data/avatars";
import { fileToAvatarDataUrl, saveUserProfile } from "../../../utils/userProfile";
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
    const isCustomPicture = useMemo(
        () => !avatarOptions.some((option) => option.src === draftAvatarSrc),
        [draftAvatarSrc],
    );

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
            <header className={styles.hero}>
                <img src="/icon__switch_users--large.png" width="48" height="48" />
                <div>
                    <h1>User Accounts</h1>
                    <p>Choose the picture shown for your account across this XP session.</p>
                </div>
            </header>

            <main className={styles.content}>
                <section className={styles.previewCard}>
                    <div className={styles.previewHeader}>
                        <img src={draftAvatarSrc} alt={`${trimmedUsername || "User"} avatar preview`} />
                        <div>
                            <p className={styles.label}>Current user name</p>
                            <h2>{trimmedUsername || "User"}</h2>
                            <p className={styles.subtle}>
                                {isCustomPicture ? "Custom picture" : "Built-in picture"}
                            </p>
                        </div>
                    </div>

                    <div className={styles.accountField}>
                        <label htmlFor="user-account-name">Account name</label>
                        <input id="user-account-name" type="text" value={trimmedUsername} readOnly />
                    </div>

                    <p className={styles.helpText}>
                        This picture is reused on the login screen, in the Start menu, and anywhere the public profile is shown later.
                    </p>

                    <div className={styles.actions}>
                        <button type="button" onClick={onSave} disabled={!hasChanges || isSaving || !trimmedUsername}>
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={onCancel} disabled={!hasChanges || isSaving}>
                            Cancel
                        </button>
                    </div>

                    <p className={styles.status} data-state={saveState.type}>
                        {saveState.message}
                    </p>
                </section>

                <section className={styles.pickerCard}>
                    <div className={styles.pickerHeader}>
                        <div>
                            <h2>Choose a picture</h2>
                            <p>Select one of the built-in avatars or upload your own image.</p>
                        </div>
                        <button type="button" className={styles.browseButton} onClick={onBrowseForPicture}>
                            Browse for more pictures
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className={styles.fileInput}
                            onChange={onFileChange}
                        />
                    </div>

                    <div className={styles.avatarGrid}>
                        {avatarOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={styles.avatarOption}
                                data-selected={draftAvatarSrc === option.src}
                                onClick={() => onPickBuiltInAvatar(option.src)}
                            >
                                <img src={option.src} alt="" />
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default UserAccounts;
