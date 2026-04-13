import { useReducer, useEffect, useState } from "react";
import { Context } from "./context";
import { reducer, initialState } from "./reducer";
import { DEFAULT_AVATAR_SRC } from "../data/avatars";
import { fetchUserProfile } from "../utils/userProfile";
import type { ContextMenuState } from "./types";
import type { ReactNode } from "react";

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const openContextMenu = (menu: ContextMenuState) => {
        setContextMenu(menu);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

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
        sessionStorage.setItem("isTaskbarLocked", String(state.isTaskbarLocked));
    }, [state.isTaskbarLocked]);

    useEffect(() => {
        sessionStorage.setItem("avatarSrc", state.avatarSrc);
    }, [state.avatarSrc]);

    useEffect(() => {
        sessionStorage.setItem("personalMessage", state.personalMessage);
    }, [state.personalMessage]);

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

        const wallpaper = sessionStorage.getItem("wallpaper");
        if (wallpaper) {
            try {
                if(!wallpaper) return;
                
                dispatch({ type: "SET_WALLPAPER", payload: wallpaper});
            } catch (error) {
                console.error("Failed to parse wallpaper from localStorage", error);
            }
        }
    }, []);

    useEffect(() => {
        const userId = state.username.trim();
        if (!userId) {
            dispatch({ type: "SET_AVATAR_SRC", payload: DEFAULT_AVATAR_SRC });
            dispatch({ type: "SET_PERSONAL_MESSAGE", payload: "" });
            return;
        }

        let isCancelled = false;
        const controller = new AbortController();

        const loadProfile = async () => {
            try {
                const profile = await fetchUserProfile(userId, controller.signal);
                if (isCancelled) return;

                dispatch({
                    type: "SET_AVATAR_SRC",
                    payload: profile?.avatarSrc || DEFAULT_AVATAR_SRC,
                });
                dispatch({
                    type: "SET_PERSONAL_MESSAGE",
                    payload: profile?.personalMessage || "",
                });
            } catch (error) {
                if (isCancelled || controller.signal.aborted) return;
                console.error("Failed to load user profile", error);
                dispatch({ type: "SET_AVATAR_SRC", payload: DEFAULT_AVATAR_SRC });
                dispatch({ type: "SET_PERSONAL_MESSAGE", payload: "" });
            }
        };

        const delay = window.setTimeout(loadProfile, 250);

        return () => {
            isCancelled = true;
            controller.abort();
            window.clearTimeout(delay);
        };
    }, [state.username]);

    return (
        <Context value={{ ...state, dispatch, contextMenu, openContextMenu, closeContextMenu }}>
            {children}
        </Context>
    );
};
