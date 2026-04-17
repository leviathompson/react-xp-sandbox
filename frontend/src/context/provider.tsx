import { useReducer, useEffect, useMemo, useRef, useState } from "react";
import { Context } from "./context";
import {
    createDefaultAccountState,
    createDefaultWindows,
    defaultShellFiles,
    getCurrentWindowsStorageKey,
    loadPersistedCurrentWindows,
    mergeShellFilesWithDefaults,
    reducer,
    initialState,
} from "./reducer";
import { DEFAULT_AVATAR_SRC } from "../data/avatars";
import { subscribeToMessengerRealtime } from "../utils/messengerRealtime";
import { fetchUserProfile, saveUserProfile, startUserSession, authorizePresentationPopup, type UserProfile } from "../utils/userProfile";
import { defaultWallpaper } from "./defaults";
import { openOrFocusApplication } from "../utils/general";
import type { ContextMenuState } from "./types";
import type { ReactNode } from "react";

const SAVE_DEBOUNCE_MS = 400;

const normalizeProfileState = (profile: UserProfile | null) => {
    const customFiles = profile?.customFiles ?? {};

    return {
        avatarSrc: profile?.avatarSrc || DEFAULT_AVATAR_SRC,
        personalMessage: profile?.personalMessage || "",
        wallpaper: profile?.wallpaper || defaultWallpaper,
        currentTime: new Date(profile?.firstLoginAt || Date.now()),
        isTaskbarLocked: profile?.isTaskbarLocked ?? false,
        shellFiles: mergeShellFilesWithDefaults(defaultShellFiles, profile?.shellFiles ?? defaultShellFiles, customFiles),
        customFiles,
        customApplications: profile?.customApplications ?? {},
    };
};

const serializeAccountSnapshot = (snapshot: {
    avatarSrc: string;
    personalMessage: string;
    wallpaper: string;
    isTaskbarLocked: boolean;
    shellFiles: unknown;
    customFiles: unknown;
    customApplications: unknown;
}) => JSON.stringify(snapshot);

const clearAppSessionStorage = () => {
    if (typeof window === "undefined") return;

    const keysToRemove = Object.keys(sessionStorage).filter((key) => (
        key === "loggedIn"
        || key === "username"
        || key.startsWith("xp_current_windows_v1:")
    ));

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
};

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const hydratedUserRef = useRef<string | null>(null);
    const lastSavedAccountRef = useRef("");
    const pendingPresentationPopupUserRef = useRef<string | null>(null);
    const currentWindowsRef = useRef(state.currentWindows);

    const openContextMenu = (menu: ContextMenuState) => {
        setContextMenu(menu);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    useEffect(() => {
        currentWindowsRef.current = state.currentWindows;
    }, [state.currentWindows]);

    useEffect(() => {
        if (state.isCRTEnabled) {
            document.body.classList.add("crt-effect");
        } else {
            document.body.classList.remove("crt-effect");
        }
    }, [state.isCRTEnabled]);

    useEffect(() => {
        if (state.themeColor) {
            document.body.setAttribute("data-theme", state.themeColor);
        } else {
            document.body.removeAttribute("data-theme");
        }
    }, [state.themeColor]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const loggedInJSON = sessionStorage.getItem("loggedIn");
        if (loggedInJSON) {
            try {
                const loggedIn = JSON.parse(loggedInJSON);
                if(!loggedIn) return;
                
                dispatch({ type: "SET_WINDOWS_INITIATION_STATE", payload: "loggedIn"});
            } catch (error) {
                console.error("Failed to parse windowColor from localStorage", error);
            }
        }
    }, []);

    useEffect(() => {
        const userId = state.username.trim();
        if (!userId) {
            hydratedUserRef.current = null;
            lastSavedAccountRef.current = "";
            dispatch({ type: "HYDRATE_ACCOUNT_STATE", payload: createDefaultAccountState() });
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: createDefaultWindows() });
            return;
        }

        dispatch({ type: "SET_CURRENT_WINDOWS", payload: loadPersistedCurrentWindows(userId) });

        let isCancelled = false;
        const controller = new AbortController();

        const loadProfile = async () => {
            try {
                const profile = await fetchUserProfile(userId, controller.signal);
                if (isCancelled) return;

                const nextState = normalizeProfileState(profile);
                dispatch({ type: "HYDRATE_ACCOUNT_STATE", payload: nextState });
            } catch (error) {
                if (isCancelled || controller.signal.aborted) return;
                console.error("Failed to load user profile", error);
                dispatch({ type: "HYDRATE_ACCOUNT_STATE", payload: createDefaultAccountState() });
            }
        };

        const delay = window.setTimeout(loadProfile, 250);

        return () => {
            isCancelled = true;
            controller.abort();
            window.clearTimeout(delay);
        };
    }, [state.username]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const userId = state.username.trim();
        if (!userId || state.windowsInitiationState !== "loggedIn") return;

        sessionStorage.setItem(
            getCurrentWindowsStorageKey(userId),
            JSON.stringify(state.currentWindows),
        );
    }, [state.currentWindows, state.username, state.windowsInitiationState]);

    useEffect(() => {
        const userId = state.username.trim();
        if (!userId || state.windowsInitiationState !== "loggedIn") return;

        let isCancelled = false;
        const controller = new AbortController();

        const loadAccountSession = async () => {
            try {
                const profile = await startUserSession(userId, controller.signal);
                if (isCancelled) return;

                const nextState = normalizeProfileState(profile);
                dispatch({ type: "HYDRATE_ACCOUNT_STATE", payload: nextState });
                hydratedUserRef.current = userId;
                lastSavedAccountRef.current = serializeAccountSnapshot({
                    avatarSrc: nextState.avatarSrc,
                    personalMessage: nextState.personalMessage,
                    wallpaper: nextState.wallpaper,
                    isTaskbarLocked: nextState.isTaskbarLocked,
                    shellFiles: nextState.shellFiles,
                    customFiles: nextState.customFiles,
                    customApplications: nextState.customApplications,
                });

                if (profile.isAdmin && !profile.hasSeenPresentationPopup && pendingPresentationPopupUserRef.current !== userId) {
                    pendingPresentationPopupUserRef.current = userId;
                    openOrFocusApplication("presentationUrlPopup", currentWindowsRef.current, dispatch);
                    try {
                        await authorizePresentationPopup(userId, true);
                    } catch (popupError) {
                        console.error("Failed to acknowledge presentation popup", popupError);
                    } finally {
                        pendingPresentationPopupUserRef.current = null;
                    }
                }
            } catch (error) {
                if (isCancelled || controller.signal.aborted) return;
                console.error("Failed to load account session", error);
            }
        };

        void loadAccountSession();

        return () => {
            isCancelled = true;
            controller.abort();
        };
    }, [state.username, state.windowsInitiationState]);

    const accountSnapshot = useMemo(() => ({
        avatarSrc: state.avatarSrc,
        personalMessage: state.personalMessage,
        wallpaper: state.wallpaper,
        isTaskbarLocked: state.isTaskbarLocked,
        shellFiles: state.shellFiles,
        customFiles: state.customFiles,
        customApplications: state.customApplications,
    }), [
        state.avatarSrc,
        state.personalMessage,
        state.wallpaper,
        state.isTaskbarLocked,
        state.shellFiles,
        state.customFiles,
        state.customApplications,
    ]);

    useEffect(() => {
        const userId = state.username.trim();
        if (!userId || state.windowsInitiationState !== "loggedIn") return;
        if (hydratedUserRef.current !== userId) return;

        const serializedSnapshot = serializeAccountSnapshot(accountSnapshot);
        if (serializedSnapshot === lastSavedAccountRef.current) return;

        const timeoutId = window.setTimeout(async () => {
            try {
                await saveUserProfile(userId, accountSnapshot);
                lastSavedAccountRef.current = serializedSnapshot;
            } catch (error) {
                console.error("Failed to save account state", error);
            }
        }, SAVE_DEBOUNCE_MS);

        return () => window.clearTimeout(timeoutId);
    }, [accountSnapshot, state.username, state.windowsInitiationState]);

    useEffect(() => {
        const userId = state.username.trim();
        if (!userId) return;

        return subscribeToMessengerRealtime(userId, (event) => {
            if (event.type !== "system_reset") return;

            hydratedUserRef.current = null;
            lastSavedAccountRef.current = "";
            clearAppSessionStorage();

            dispatch({ type: "SET_IS_START_VISIBLE", payload: false });
            dispatch({ type: "SET_IS_ALL_PROGRAMS_OPEN", payload: false });
            dispatch({ type: "SET_IS_RECENT_DOCUMENTS_OPEN", payload: false });
            dispatch({ type: "SET_IS_SHUTDOWN_MODAL_OPEN", payload: false });
            dispatch({ type: "SET_TRANSITION_LABEL", payload: "" });
            dispatch({ type: "SET_INITIATION_STAGE", payload: 0 });
            dispatch({ type: "SET_IS_INITIAL_BOOT", payload: true });
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: createDefaultWindows() });
            dispatch({ type: "SET_USERNAME", payload: "" });
            dispatch({ type: "SET_WINDOWS_INITIATION_STATE", payload: "bios" });
        });
    }, [state.username]);

    return (
        <Context value={{ ...state, dispatch, contextMenu, openContextMenu, closeContextMenu }}>
            {children}
        </Context>
    );
};
