export interface UserProfile {
    userId: string;
    avatarSrc: string | null;
    personalMessage: string | null;
}

const AVATAR_CANVAS_SIZE = 128;

export const fetchUserProfile = async (userId: string, signal?: AbortSignal): Promise<UserProfile | null> => {
    const response = await fetch(`/api/profile/${encodeURIComponent(userId)}`, { signal });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error("Failed to load profile.");
    }

    return response.json() as Promise<UserProfile>;
};

export interface SaveUserProfileInput {
    avatarSrc?: string;
    personalMessage?: string;
}

export const saveUserProfile = async (userId: string, profile: SaveUserProfileInput) => {
    const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userId,
            ...profile,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to save profile." })) as { error?: string };
        throw new Error(error.error || "Failed to save profile.");
    }

    return response.json() as Promise<UserProfile>;
};

export const fileToAvatarDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.onload = () => {
        const image = new Image();

        image.onerror = () => reject(new Error("The selected file is not a valid image."));
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) {
                reject(new Error("Unable to prepare the selected image."));
                return;
            }

            canvas.width = AVATAR_CANVAS_SIZE;
            canvas.height = AVATAR_CANVAS_SIZE;

            const sourceSize = Math.min(image.width, image.height);
            const sourceX = Math.max((image.width - sourceSize) / 2, 0);
            const sourceY = Math.max((image.height - sourceSize) / 2, 0);

            context.drawImage(
                image,
                sourceX,
                sourceY,
                sourceSize,
                sourceSize,
                0,
                0,
                AVATAR_CANVAS_SIZE,
                AVATAR_CANVAS_SIZE,
            );

            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };

        image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
});
