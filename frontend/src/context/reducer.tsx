import { generateUniqueId } from "../utils/general";
import { defaultWallpaper } from "./defaults";
import type { State, Action } from "./types";

const getShellEntryId = (entry: State["customFiles"][string][number]) => Array.isArray(entry) ? entry[0] : entry;

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
    case "SET_WALLPAPER":
        return { ...state, wallpaper: action.payload };
    case "SET_CURRENT_TIME":
        return { ...state, currentTime: action.payload };
    case "SET_CURRENT_WINDOWS":
        return { ...state, currentWindows: action.payload };
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
        delete remainingApplications[appId];
        delete remainingFiles[appId];

        return {
            ...state,
            customFiles: {
                ...remainingFiles,
                [containerId]: (state.customFiles[containerId] || []).filter((entry) => getShellEntryId(entry) !== appId),
            },
            customApplications: remainingApplications,
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
    default:
        return state;
    }
};

export const initialState: State = {
    wallpaper: sessionStorage.getItem("wallpaper") || defaultWallpaper,
    currentTime: new Date(),
    currentWindows: [{
        id: generateUniqueId(),
        appId: "readme",
    },
    ],
    username: sessionStorage.getItem("username") || "",
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
    isTaskbarLocked: sessionStorage.getItem("isTaskbarLocked") === "true",
    customFiles: {},
    customApplications: {},
};
