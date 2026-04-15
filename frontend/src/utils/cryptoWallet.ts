export interface CryptoWalletState {
    remainingAttempts: number;
    isLocked: boolean;
    lockedUntil: string | null;
    failedAttempts: number;
    balanceUsd: number;
    doomsdayEndsAt: string | null;
    isDoomsdayActive: boolean;
    isPermanentlyLocked: boolean;
}

export interface CryptoWalletUnlockResponse {
    success?: boolean;
    balanceUsd?: number;
    state: CryptoWalletState;
    error?: string;
}

const parseJson = async <T>(response: Response): Promise<T> => {
    const data = await response.json() as T;
    return data;
};

export const fetchCryptoWalletState = async (): Promise<CryptoWalletState> => {
    const response = await fetch("/api/crypto-wallet/state");
    const data = await parseJson<CryptoWalletState | { error: string }>(response);

    if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Unable to load wallet state.");
    }

    return data;
};

export const unlockCryptoWallet = async (username: string, password: string): Promise<CryptoWalletUnlockResponse> => {
    const response = await fetch("/api/crypto-wallet/unlock", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
    });

    return parseJson<CryptoWalletUnlockResponse>(response);
};

export const startCryptoWalletDoomsday = async (minutes: number) => {
    const response = await fetch("/api/crypto-wallet/doomsday", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start", minutes }),
    });

    return parseJson<{ success?: boolean; state: CryptoWalletState; error?: string }>(response);
};

export const resetCryptoWalletDoomsday = async () => {
    const response = await fetch("/api/crypto-wallet/doomsday", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reset" }),
    });

    return parseJson<{ success?: boolean; state: CryptoWalletState; error?: string }>(response);
};
