import type { IncomingDirectMessage } from "./messenger";

type ReadyEvent = {
    type: "ready";
    payload: {
        userId: string;
    };
};

type MessageCreatedEvent = {
    type: "message_created";
    payload: {
        message: IncomingDirectMessage;
    };
};

type CryptoWalletState = {
    remainingAttempts: number;
    isLocked: boolean;
    lockedUntil: string | null;
    failedAttempts: number;
    balanceUsd: number;
    doomsdayEndsAt: string | null;
    isDoomsdayActive: boolean;
    isPermanentlyLocked: boolean;
};

type CryptoWalletStateEvent = {
    type: "crypto_wallet_state";
    payload: {
        state: CryptoWalletState;
    };
};

type SystemResetEvent = {
    type: "system_reset";
    payload: {
        reason: "nuke";
    };
};

export type MessengerRealtimeEvent = ReadyEvent | MessageCreatedEvent | CryptoWalletStateEvent | SystemResetEvent;

interface RealtimeSubscriber {
    onEvent: (event: MessengerRealtimeEvent) => void;
    onConnectionChange?: (isConnected: boolean) => void;
}

const subscribers = new Set<RealtimeSubscriber>();
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let connected = false;
let activeUserId = "";

const notifyConnectionChange = () => {
    subscribers.forEach((subscriber) => subscriber.onConnectionChange?.(connected));
};

const dispatchRealtimeEvent = (event: MessengerRealtimeEvent) => {
    subscribers.forEach((subscriber) => subscriber.onEvent(event));
};

const clearReconnectTimer = () => {
    if (reconnectTimer == null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
};

const disconnectSocket = () => {
    clearReconnectTimer();

    if (!socket) {
        connected = false;
        return;
    }

    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
    socket = null;
    connected = false;
};

const buildRealtimeUrl = (userId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = new URL(`${protocol}//${window.location.host}/ws/messenger`);
    wsUrl.searchParams.set("userId", userId);
    return wsUrl.toString();
};

const scheduleReconnect = () => {
    if (!activeUserId || subscribers.size === 0 || reconnectTimer != null) return;

    const delay = Math.min(1000 * (2 ** reconnectAttempt), 10000);
    reconnectAttempt += 1;

    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        ensureMessengerRealtimeConnection();
    }, delay);
};

const ensureMessengerRealtimeConnection = () => {
    if (!activeUserId || subscribers.size === 0) return;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

    clearReconnectTimer();

    socket = new WebSocket(buildRealtimeUrl(activeUserId));

    socket.onopen = () => {
        connected = true;
        reconnectAttempt = 0;
        notifyConnectionChange();
    };

    socket.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data as string) as MessengerRealtimeEvent;
            dispatchRealtimeEvent(parsed);
        } catch {
            // Ignore malformed events from the server.
        }
    };

    socket.onerror = () => {
        socket?.close();
    };

    socket.onclose = () => {
        socket = null;

        if (connected) {
            connected = false;
            notifyConnectionChange();
        }

        scheduleReconnect();
    };
};

export const subscribeToMessengerRealtime = (
    userId: string,
    onEvent: (event: MessengerRealtimeEvent) => void,
    onConnectionChange?: (isConnected: boolean) => void,
) => {
    const normalizedUserId = userId.trim();
    const subscriber: RealtimeSubscriber = { onEvent, onConnectionChange };

    subscribers.add(subscriber);

    if (activeUserId && activeUserId !== normalizedUserId) {
        disconnectSocket();
    }

    activeUserId = normalizedUserId;
    subscriber.onConnectionChange?.(connected);
    ensureMessengerRealtimeConnection();

    return () => {
        subscribers.delete(subscriber);

        if (subscribers.size > 0) return;

        activeUserId = "";
        disconnectSocket();
    };
};
