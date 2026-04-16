import filesJSON from "../data/files.json";
import { DEFAULT_AVATAR_SRC } from "../data/avatars";
import { generateUniqueId } from "../utils/general";
import { defaultWallpaper } from "./defaults";
import type { AbsoluteObject, Action, AccountStateSnapshot, ShellEntry, State } from "./types";

const cloneJSON = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getShellEntryId = (entry: ShellEntry) => Array.isArray(entry) ? entry[0] : entry;
const DEFAULT_WINDOW_APPS = ["cryptoWallet", "readme", "winMessenger", "userAccounts"] as const;

export const mergeShellFilesWithDefaults = (
    defaults: Record<string, ShellEntry[]>,
    current: Record<string, ShellEntry[]>,
    customFiles: Record<string, ShellEntry[]>,
) => {
    const merged: Record<string, ShellEntry[]> = {};
    const containerIds = new Set([
        ...Object.keys(defaults),
        ...Object.keys(current),
        ...Object.keys(customFiles),
    ]);

    containerIds.forEach((containerId) => {
        const defaultEntries = defaults[containerId] || [];
        const currentEntries = current[containerId] || [];
        const customEntries = customFiles[containerId] || [];
        const defaultEntryIds = new Set(defaultEntries.map(getShellEntryId));
        const customEntryIds = new Set(customEntries.map(getShellEntryId));

        if (
            currentEntries.length === 0
            && defaultEntries.length === 0
            && customEntries.length === 0
            && !Object.prototype.hasOwnProperty.call(customFiles, containerId)
        ) {
            return;
        }

        const nextEntries = currentEntries
            .filter((entry) => defaultEntryIds.has(getShellEntryId(entry)) || customEntryIds.has(getShellEntryId(entry)))
            .map((entry) => cloneJSON(entry));
        const knownEntryIds = new Set(nextEntries.map(getShellEntryId));

        [...defaultEntries, ...customEntries].forEach((entry) => {
            if (knownEntryIds.has(getShellEntryId(entry))) return;
            nextEntries.push(cloneJSON(entry));
            knownEntryIds.add(getShellEntryId(entry));
        });

        merged[containerId] = nextEntries;
    });

    return merged;
};

export const defaultShellFiles = cloneJSON(filesJSON) as unknown as Record<string, ShellEntry[]>;
export const createDefaultAccountState = (): AccountStateSnapshot => ({
    avatarSrc: DEFAULT_AVATAR_SRC,
    personalMessage: "",
    wallpaper: defaultWallpaper,
    currentTime: new Date(),
    isTaskbarLocked: false,
    shellFiles: cloneJSON(defaultShellFiles),
    customFiles: {},
    customApplications: {},
});
const createInitialWindow = (appId: string, active = false) => ({
    id: generateUniqueId(),
    appId,
    active,
    history: [],
    forward: [],
});

export const createDefaultWindows = () => DEFAULT_WINDOW_APPS.map((appId, index) =>
    createInitialWindow(appId, index === DEFAULT_WINDOW_APPS.length - 1)
);

export const getCurrentWindowsStorageKey = (userId: string) => `xp_current_windows_v1:${userId}`;

export const loadPersistedCurrentWindows = (userId: string) => {
    if (typeof window === "undefined") return createDefaultWindows();

    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return createDefaultWindows();

    const persistedState = sessionStorage.getItem(getCurrentWindowsStorageKey(normalizedUserId));
    if (!persistedState) return createDefaultWindows();

    try {
        const parsed = JSON.parse(persistedState) as State["currentWindows"];
        if (!Array.isArray(parsed) || parsed.length === 0) return createDefaultWindows();
        return cloneJSON(parsed);
    } catch {
        return createDefaultWindows();
    }
};

const buildShellEntry = (appId: string, containerId: string, position?: AbsoluteObject): ShellEntry => {
    if (containerId !== "desktop") return appId;

    return [
        appId,
        {
            top: position?.top ?? 0,
            left: position?.left ?? 0,
        },
    ];
};

const isContainerInSubtree = (shellFiles: Record<string, ShellEntry[]>, rootAppId: string, candidateContainerId: string): boolean => {
    if (rootAppId === candidateContainerId) return true;

    const children = shellFiles[rootAppId] || [];
    return children.some((entry) => isContainerInSubtree(shellFiles, getShellEntryId(entry), candidateContainerId));
};

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
    case "SET_WALLPAPER":
        return { ...state, wallpaper: action.payload };
    case "SET_CURRENT_TIME":
        return { ...state, currentTime: action.payload };
    case "HYDRATE_ACCOUNT_STATE":
        return {
            ...state,
            avatarSrc: action.payload.avatarSrc,
            personalMessage: action.payload.personalMessage,
            wallpaper: action.payload.wallpaper,
            currentTime: action.payload.currentTime,
            isTaskbarLocked: action.payload.isTaskbarLocked,
            shellFiles: cloneJSON(action.payload.shellFiles),
            customFiles: cloneJSON(action.payload.customFiles),
            customApplications: cloneJSON(action.payload.customApplications),
        };
    case "SET_CURRENT_WINDOWS":
        return { ...state, currentWindows: action.payload };
    case "SET_AVATAR_SRC":
        return { ...state, avatarSrc: action.payload };
    case "SET_PERSONAL_MESSAGE":
        return { ...state, personalMessage: action.payload };
    case "SET_IS_START_VISIBLE":
        return { ...state, isStartVisible: action.payload };
    case "SET_IS_ALL_PROGRAMS_OPEN":
        return { ...state, isAllProgramsOpen: action.payload };
    case "SET_IS_RECENT_DOCUMENTS_OPEN":
        return { ...state, isRecentDocumentsOpen: action.payload };
    case "SET_IS_SHUTDOWN_MODAL_OPEN":
        return { ...state, isShutDownModalOpen: action.payload };
    case "SET_WINDOWS_INITIATION_STATE":
        return { ...state, windowsInitiationState: action.payload };
    case "SET_INITIATION_STAGE":
        return { ...state, initiationStage: action.payload };
    case "SET_IS_INITIAL_BOOT":
        return { ...state, isInitialBoot: action.payload };
    case "SET_TRANSITION_LABEL":
        return { ...state, transitionLabel: action.payload };
    case "SET_IS_CRT_ENABLED":
        return { ...state, isCRTEnabled: action.payload };
    case "SET_THEME_COLOR":
        return { ...state, themeColor: action.payload };
    case "SET_USERNAME":
        return { ...state, username: action.payload };
    case "SET_IS_TASKBAR_LOCKED":
        return { ...state, isTaskbarLocked: action.payload };
    case "CREATE_SHELL_ITEM": {
        const { containerId, appId, entry, application, contents } = action.payload;

        return {
            ...state,
            shellFiles: {
                ...state.shellFiles,
                [containerId]: [...(state.shellFiles[containerId] || []), entry],
                ...(contents ? { [appId]: contents } : {}),
            },
            customFiles: {
                ...state.customFiles,
                [containerId]: [...(state.customFiles[containerId] || []), entry],
                ...(contents ? { [appId]: contents } : {}),
            },
            customApplications: {
                ...state.customApplications,
                [appId]: application,
            },
        };
    }
    case "DELETE_SHELL_ITEM": {
        const { containerId, appId } = action.payload;
        const remainingApplications = { ...state.customApplications };
        const remainingFiles = { ...state.customFiles };
        const remainingShellFiles = { ...state.shellFiles };
        delete remainingApplications[appId];
        delete remainingFiles[appId];
        delete remainingShellFiles[appId];

        return {
            ...state,
            shellFiles: {
                ...remainingShellFiles,
                [containerId]: (state.shellFiles[containerId] || []).filter((entry) => getShellEntryId(entry) !== appId),
            },
            customFiles: {
                ...remainingFiles,
                [containerId]: (state.customFiles[containerId] || []).filter((entry) => getShellEntryId(entry) !== appId),
            },
            customApplications: remainingApplications,
        };
    }
    case "MOVE_SHELL_ITEM": {
        const { appId, sourceContainerId, targetContainerId, targetPosition } = action.payload;
        if (sourceContainerId === targetContainerId) return state;
        if (isContainerInSubtree(state.shellFiles, appId, targetContainerId)) return state;

        const sourceEntries = state.shellFiles[sourceContainerId] || [];
        const itemToMove = sourceEntries.find((entry) => getShellEntryId(entry) === appId);
        if (!itemToMove) return state;

        const targetEntries = state.shellFiles[targetContainerId] || [];
        if (targetEntries.some((entry) => getShellEntryId(entry) === appId)) return state;

        return {
            ...state,
            shellFiles: {
                ...state.shellFiles,
                [sourceContainerId]: sourceEntries.filter((entry) => getShellEntryId(entry) !== appId),
                [targetContainerId]: [...targetEntries, buildShellEntry(appId, targetContainerId, targetPosition)],
            },
        };
    }
    case "UPDATE_SHELL_ITEM_POSITION": {
        const { appId, containerId, position } = action.payload;
        const entries = state.shellFiles[containerId] || [];

        return {
            ...state,
            shellFiles: {
                ...state.shellFiles,
                [containerId]: entries.map((entry) => {
                    if (getShellEntryId(entry) !== appId) return entry;
                    return buildShellEntry(appId, containerId, position);
                }),
            },
        };
    }
    case "UPDATE_SHELL_ITEM": {
        const { appId, application } = action.payload;
        const existingApplication = state.customApplications[appId];
        if (!existingApplication) return state;

        return {
            ...state,
            customApplications: {
                ...state.customApplications,
                [appId]: {
                    ...existingApplication,
                    ...application,
                },
            },
        };
    }
    case "REGISTER_CUSTOM_APPLICATION": {
        const { appId, application } = action.payload;

        return {
            ...state,
            customApplications: {
                ...state.customApplications,
                [appId]: application,
            },
        };
    }
    default:
        return state;
    }
};

export const initialState: State = {
    wallpaper: defaultWallpaper,
    currentTime: new Date(),
    currentWindows: loadPersistedCurrentWindows(sessionStorage.getItem("username") || ""),
    username: sessionStorage.getItem("username") || "",
    avatarSrc: DEFAULT_AVATAR_SRC,
    personalMessage: "",
    isStartVisible: false,
    isAllProgramsOpen: false,
    isRecentDocumentsOpen: false,
    isShutDownModalOpen: false,
    windowsInitiationState: "bios",
    initiationStage: 0,
    isInitialBoot: true,
    transitionLabel: "",
    isCRTEnabled: true,
    themeColor: "blue",
    isTaskbarLocked: false,
    shellFiles: cloneJSON(defaultShellFiles),
    customFiles: {},
    customApplications: {},
};
