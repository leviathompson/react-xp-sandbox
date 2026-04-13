export interface ActiveSession {
    user_id: string;
    avatar_src: string | null;
    personal_message: string | null;
    first_login_at: string;
    updated_at: string;
}

export interface DirectMessage {
    id: number;
    sender_id: string;
    recipient_id: string;
    body: string;
    attachment_src: string | null;
    attachment_name: string | null;
    created_at: string;
}

export const buildChatAppId = (peerId: string) => `messengerChat:${peerId}`;

export const fetchActiveSessions = async (limit = 100) => {
    const response = await fetch(`/api/sessions/active?limit=${limit}`);
    if (!response.ok) {
        throw new Error("Unable to load active sessions.");
    }

    return response.json() as Promise<{ sessions: ActiveSession[] }>;
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
