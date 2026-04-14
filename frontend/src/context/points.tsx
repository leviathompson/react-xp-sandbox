import { createContext, useCallback, useContext as useReactContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import pointRules, { type PointRule } from "../data/pointRules";
import { useContext as useXPContext } from "./context";
import { generateUniqueId } from "../utils/general";

type AwardStatus =
    | { success: true; award: PointsAward; rule: PointRule }
    | { success: false; reason: string; rule?: PointRule };

type AwardPointsOptions = {
    metadata?: Record<string, unknown>;
    eventKey?: string;
    timestamp?: number;
};

type PointsAward = {
    id: string;
    ruleId: string;
    points: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
    eventKey?: string;
};

type StoredPointsState = {
    lifetimePoints: number;
    lifetimeAwardCounts: Record<string, number>;
    awards: PointsAward[];
};

type PointsState = {
    sessionPoints: number;
    sessionAwardCounts: Record<string, number>;
    lifetimePoints: number;
    lifetimeAwardCounts: Record<string, number>;
    awards: PointsAward[];
    recentAwards: PointsAward[];
};

type PointsAction =
    | { type: "AWARD_POINTS"; payload: PointsAward }
    | { type: "HYDRATE_STATE"; payload: PointsState }
    | { type: "RESET_SESSION" };

interface PointsContextValue {
    rules: PointRule[];
    sessionPoints: number;
    lifetimePoints: number;
    awards: PointsAward[];
    recentAwards: PointsAward[];
    pendingSyncCount: number;
    awardPoints: (ruleId: PointRule["id"], options?: AwardPointsOptions) => AwardStatus;
    getRule: (ruleId: PointRule["id"]) => PointRule | undefined;
    resetSession: () => void;
}

const STORAGE_KEY = "xp_points_state_v1";
const MAX_RECENT_AWARDS = 20;
const defaultState: PointsState = {
    sessionPoints: 0,
    sessionAwardCounts: {},
    lifetimePoints: 0,
    lifetimeAwardCounts: {},
    awards: [],
    recentAwards: [],
};

const ruleMap: Record<string, PointRule> = pointRules.reduce((map, rule) => {
    map[rule.id] = rule;
    return map;
}, {} as Record<string, PointRule>);

// ---------------------------------------------------------------------------
// Backend sync helpers (managed outside React state to avoid re-renders)
// ---------------------------------------------------------------------------

const SYNC_QUEUE_KEY = "xp_sync_queue_v1";

const getStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`;
const getSyncQueueKey = (userId: string) => `${SYNC_QUEUE_KEY}:${userId}`;

const loadSyncQueue = (userId: string): PointsAward[] => {
    if (!userId || typeof window === "undefined") return [];
    const storageKey = getSyncQueueKey(userId);
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"); }
    catch { return []; }
};

const saveSyncQueue = (userId: string, queue: PointsAward[]) => {
    if (!userId || typeof window === "undefined") return;
    window.localStorage.setItem(getSyncQueueKey(userId), JSON.stringify(queue));
};

const postEvent = async (award: PointsAward, userId: string): Promise<boolean> => {
    try {
        const res = await fetch("/api/points/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                clientId: award.id,
                ruleId: award.ruleId,
                points: award.points,
                awardedAt: new Date(award.timestamp).toISOString(),
                metadata: award.metadata ?? {},
            }),
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    } catch {
        return false;
    }
};

const PointsContext = createContext<PointsContextValue | undefined>(undefined);

const loadStoredState = (userId: string): StoredPointsState | null => {
    if (!userId || typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;

    try {
        return JSON.parse(raw) as StoredPointsState;
    } catch (error) {
        console.warn("Unable to parse stored points state", error);
        return null;
    }
};

const createInitialState = (userId: string): PointsState => {
    const stored = loadStoredState(userId);
    if (!stored) return { ...defaultState };

    return {
        ...defaultState,
        lifetimePoints: stored.lifetimePoints,
        lifetimeAwardCounts: stored.lifetimeAwardCounts,
        awards: stored.awards,
        recentAwards: stored.awards.slice(-MAX_RECENT_AWARDS),
    };
};

const pointsReducer = (state: PointsState, action: PointsAction): PointsState => {
    switch (action.type) {
    case "HYDRATE_STATE":
        return action.payload;
    case "AWARD_POINTS": {
        const award = action.payload;
        const updatedAwards = [...state.awards, award];
        const updatedRecentAwards = [...state.recentAwards.slice(-(MAX_RECENT_AWARDS - 1)), award];

        return {
            sessionPoints: state.sessionPoints + award.points,
            sessionAwardCounts: {
                ...state.sessionAwardCounts,
                [award.ruleId]: (state.sessionAwardCounts[award.ruleId] ?? 0) + 1,
            },
            lifetimePoints: state.lifetimePoints + award.points,
            lifetimeAwardCounts: {
                ...state.lifetimeAwardCounts,
                [award.ruleId]: (state.lifetimeAwardCounts[award.ruleId] ?? 0) + 1,
            },
            awards: updatedAwards,
            recentAwards: updatedRecentAwards,
        };
    }

    case "RESET_SESSION":
        return {
            ...state,
            sessionPoints: 0,
            sessionAwardCounts: {},
            recentAwards: state.recentAwards,
        };

    default:
        return state;
    }
};

const isSameDay = (timestamp: number, now: number) => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return timestamp >= dayStart.getTime();
};

const evaluateLimit = (
    rule: PointRule,
    state: PointsState,
    options: AwardPointsOptions,
    now: number
): { allowed: boolean; reason?: string } => {
    if (!rule.limit) return { allowed: true };

    const { type, maxAwards } = rule.limit;

    if (type === "perSession") {
        const awardedCount = state.sessionAwardCounts[rule.id] ?? 0;
        if (awardedCount >= maxAwards) return { allowed: false, reason: "session-limit-reached" };
    }

    if (type === "perLifetime") {
        const lifetimeCount = state.lifetimeAwardCounts[rule.id] ?? 0;
        if (lifetimeCount >= maxAwards) return { allowed: false, reason: "lifetime-limit-reached" };
    }

    if (type === "perDay") {
        const todayCount = state.awards.reduce((count, award) => {
            if (award.ruleId !== rule.id) return count;
            return isSameDay(award.timestamp, now) ? count + 1 : count;
        }, 0);
        if (todayCount >= maxAwards) return { allowed: false, reason: "daily-limit-reached" };
    }

    if (type === "perEvent") {
        const eventKey = options.eventKey;
        if (!eventKey) return { allowed: false, reason: "event-key-required" };

        const matchingAwards = state.awards.filter((award) => award.ruleId === rule.id && award.eventKey === eventKey).length;
        if (matchingAwards >= maxAwards) return { allowed: false, reason: "event-limit-reached" };
    }

    return { allowed: true };
};

const AWARD_DEBOUNCE_MS = 500;

export const PointsProvider = ({ children }: { children: ReactNode }) => {
    const { username } = useXPContext();
    const userId = username.trim();
    const [state, dispatch] = useReducer(pointsReducer, { ...defaultState });
    const lastAwardTimeRef = useRef<Map<string, number>>(new Map());
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    useEffect(() => {
        if (!userId) {
            dispatch({ type: "HYDRATE_STATE", payload: { ...defaultState } });
            setPendingSyncCount(0);
            lastAwardTimeRef.current.clear();
            return;
        }

        dispatch({ type: "HYDRATE_STATE", payload: createInitialState(userId) });
        setPendingSyncCount(loadSyncQueue(userId).length);
        lastAwardTimeRef.current.clear();
    }, [userId]);

    const syncEvent = useCallback(async (award: PointsAward) => {
        if (!userId) return;

        const success = await postEvent(award, userId);
        if (!success) {
            const queue = loadSyncQueue(userId);
            if (!queue.find((a) => a.id === award.id)) {
                queue.push(award);
                saveSyncQueue(userId, queue);
                setPendingSyncCount(queue.length);
            }
        }
    }, [userId]);

    const drainSyncQueue = useCallback(async () => {
        if (!userId) return;

        const queue = loadSyncQueue(userId);
        if (queue.length === 0) return;

        const remaining: PointsAward[] = [];
        for (const award of queue) {
            const success = await postEvent(award, userId);
            if (!success) remaining.push(award);
        }
        saveSyncQueue(userId, remaining);
        setPendingSyncCount(remaining.length);
    }, [userId]);

    useEffect(() => {
        drainSyncQueue();
    }, [drainSyncQueue]);

    const persistableSnapshot = useMemo<StoredPointsState>(() => ({
        lifetimePoints: state.lifetimePoints,
        lifetimeAwardCounts: state.lifetimeAwardCounts,
        awards: state.awards,
    }), [state.lifetimePoints, state.lifetimeAwardCounts, state.awards]);

    useEffect(() => {
        if (!userId || typeof window === "undefined") return;
        window.localStorage.setItem(getStorageKey(userId), JSON.stringify(persistableSnapshot));
    }, [persistableSnapshot, userId]);

    const awardPoints = useCallback((ruleId: PointRule["id"], options: AwardPointsOptions = {}): AwardStatus => {
        const rule = ruleMap[ruleId];
        if (!rule) return { success: false, reason: "rule-not-found" };

        const wallNow = Date.now();
        const lastAwardTime = lastAwardTimeRef.current.get(ruleId) ?? 0;
        if (wallNow - lastAwardTime < AWARD_DEBOUNCE_MS) return { success: false, reason: "debounced", rule };

        const now = options.timestamp ?? wallNow;
        const limitCheck = evaluateLimit(rule, state, options, now);
        if (!limitCheck.allowed) return { success: false, reason: limitCheck.reason ?? "limit-reached", rule };

        const award: PointsAward = {
            id: generateUniqueId(),
            ruleId: rule.id,
            points: rule.points,
            timestamp: now,
            metadata: options.metadata,
            eventKey: options.eventKey,
        };

        dispatch({ type: "AWARD_POINTS", payload: award });
        lastAwardTimeRef.current.set(ruleId, wallNow);
        void syncEvent(award);
        return { success: true, award, rule };
    }, [state, syncEvent]);

    const getRule = useCallback((ruleId: PointRule["id"]) => ruleMap[ruleId], []);

    const resetSession = useCallback(() => {
        dispatch({ type: "RESET_SESSION" });
    }, []);

    const value = useMemo<PointsContextValue>(() => ({
        rules: pointRules,
        sessionPoints: state.sessionPoints,
        lifetimePoints: state.lifetimePoints,
        awards: state.awards,
        recentAwards: state.recentAwards,
        pendingSyncCount,
        awardPoints,
        getRule,
        resetSession,
    }), [awardPoints, getRule, pendingSyncCount, resetSession, state.awards, state.lifetimePoints, state.recentAwards, state.sessionPoints]);

    return (
        <PointsContext.Provider value={value}>
            {children}
        </PointsContext.Provider>
    );
};

export const usePoints = () => {
    const context = useReactContext(PointsContext);
    if (!context) {
        throw new Error("usePoints must be used within a PointsProvider");
    }
    return context;
};

export type { PointsAward, AwardPointsOptions, AwardStatus };
