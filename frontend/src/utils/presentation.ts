import { getReadmeSpeechText, speakBonziText } from "./bonziBuddy";
import { resetCryptoWalletDoomsday, startCryptoWalletDoomsday } from "./cryptoWallet";
import type { Action, currentWindow } from "../context/types";
import { generateUniqueId, updateCurrentActiveWindow } from "./general";

const focusOrOpenWindowState = (appId: string, windows: currentWindow[]) => {
    const existingWindow = windows.find((window) => window.appId === appId);
    if (existingWindow) {
        return updateCurrentActiveWindow(existingWindow.id, windows);
    }

    return [
        ...windows.map((window) => ({ ...window, active: false })),
        {
            id: generateUniqueId(),
            appId,
            active: true,
            history: [],
            forward: [],
        },
    ];
};

export const runPresentationSequence = async (
    currentUserId: string,
    windows: currentWindow[],
    dispatch: (value: Action) => void,
) => {
    const resetResult = await resetCryptoWalletDoomsday(currentUserId);
    if (resetResult.error) return;

    let nextWindows = focusOrOpenWindowState("bonziBuddy", windows);
    dispatch({ type: "SET_CURRENT_WINDOWS", payload: nextWindows });

    await speakBonziText(getReadmeSpeechText());

    nextWindows = focusOrOpenWindowState("cryptoWallet", nextWindows);
    dispatch({ type: "SET_CURRENT_WINDOWS", payload: nextWindows });

    await startCryptoWalletDoomsday(currentUserId, 10);
    dispatch({ type: "SET_CURRENT_WINDOWS", payload: focusOrOpenWindowState("cryptoWallet", nextWindows) });
};
