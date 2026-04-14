import type { Dispatch } from "react";
import { DEFAULT_AVATAR_SRC } from "../data/avatars";
import type { Action, currentWindow } from "../context/types";
import { openApplication, updateCurrentActiveWindow } from "./general";

export interface ActiveSession {
    user_id: string;
    avatar_src: string | null;
    personal_message: string | null;
    first_login_at: string;
    updated_at: string;
    score: number;
}

export const ACTIVE_SESSIONS_POLL_MS = 4000;
export const DIRECT_MESSAGES_POLL_MS = 4000;

export interface DirectMessage {
    id: number;
    sender_id: string;
    recipient_id: string;
    body: string;
    attachment_src: string | null;
    attachment_name: string | null;
    created_at: string;
}

export interface IncomingDirectMessage extends DirectMessage {
    sender_avatar_src: string | null;
}

export const buildChatAppId = (peerId: string) => `messengerChat:${peerId}`;

export const openMessengerWindow = (
    currentWindows: currentWindow[],
    dispatch: Dispatch<Action>,
) => {
    const existingWindow = currentWindows.find((window) => window.appId === "winMessenger");

    if (existingWindow) {
        dispatch({
            type: "SET_CURRENT_WINDOWS",
            payload: updateCurrentActiveWindow(existingWindow.id, currentWindows),
        });
        return;
    }

    openApplication("winMessenger", currentWindows, dispatch);
};

export const openMessengerChatWindow = (
    peerId: string,
    peerAvatarSrc: string | null | undefined,
    currentWindows: currentWindow[],
    dispatch: Dispatch<Action>,
) => {
    const appId = buildChatAppId(peerId);

    dispatch({
        type: "REGISTER_CUSTOM_APPLICATION",
        payload: {
            appId,
            application: {
                title: peerId,
                icon: "/icon__messenger--large.png",
                iconLarge: "/icon__messenger--large.png",
                component: "MessengerChat",
                width: 440,
                height: 370,
                top: 65,
                left: 150,
                content: {
                    peerId,
                    peerAvatarSrc: peerAvatarSrc || DEFAULT_AVATAR_SRC,
                },
            },
        },
    });

    const existingWindow = currentWindows.find((window) => window.appId === appId);
    if (existingWindow) {
        dispatch({
            type: "SET_CURRENT_WINDOWS",
            payload: updateCurrentActiveWindow(existingWindow.id, currentWindows),
        });
        return;
    }

    openApplication(appId, currentWindows, dispatch);
};

export const fetchActiveSessions = async (limit = 100) => {
    const response = await fetch(`/api/sessions/active?limit=${limit}`);
    if (!response.ok) {
        throw new Error("Unable to load active sessions.");
    }

    const data = await response.json() as { sessions: Array<ActiveSession & { score: number | string }> };

    return {
        sessions: (data.sessions || []).map((session) => ({
            ...session,
            score: Number(session.score) || 0,
        })),
    };
};

export const fetchDirectMessages = async (userId: string, peerId: string, limit = 200) => {
    const response = await fetch(
        `/api/messages/thread?userId=${encodeURIComponent(userId)}&peerId=${encodeURIComponent(peerId)}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Unable to load messages.");
    }

    return response.json() as Promise<{ messages: DirectMessage[] }>;
};

export const fetchIncomingDirectMessages = async (userId: string, afterId = 0, limit = 50) => {
    const response = await fetch(
        `/api/messages/incoming?userId=${encodeURIComponent(userId)}&afterId=${afterId}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Unable to load incoming messages.");
    }

    return response.json() as Promise<{ messages: IncomingDirectMessage[] }>;
};

export interface DirectMessageAttachment {
    attachmentSrc?: string;
    attachmentName?: string;
}

export const sendDirectMessage = async (
    senderId: string,
    recipientId: string,
    body: string,
    attachment?: DirectMessageAttachment,
) => {
    const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            senderId,
            recipientId,
            body,
            ...attachment,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unable to send message." })) as { error?: string };
        throw new Error(error.error || "Unable to send message.");
    }

    return response.json() as Promise<{ message: DirectMessage }>;
};
