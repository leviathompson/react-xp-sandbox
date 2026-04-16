import type { ReactNode } from "react";

export type ShellEntry = string | [string, AbsoluteObject];

export interface startMenuItem {
    title: string;
    icon: string;
    content: ReactNode | string;
    hasSubMenu?: boolean;
}

export interface currentWindow {
    appId: string;
    id: string | number;
    width?: number;
    height?: number;
    top?: number;
    left?: number;
    active?: boolean;
    hidden?: boolean;
    history?: string[];
    forward?: string[];
    landingUrl?: string | null;
    homePage?: string | null;
    currentUrl?: string | null;
    parentWindowId?: string | number;
    showOnTaskbar?: boolean;
}
export type currentWindows = currentWindow[];

export interface AbsoluteObject {
    top?: number | undefined;
    right?: number | undefined;
    bottom?: number | undefined;
    left?: number | undefined;
}

export interface Application {
    title: string;
    windowTitle?: string;
    icon?: string;
    iconLarge?: string;
    assetSrc?: string;
    embedUrl?: string;
    artist?: string;
    album?: string;
    content?: unknown;
    component?: string | undefined;
    link?: string;
    disabled?: boolean;
    redirect?: string;
    resizable?: boolean;
    showOnTaskbar?: boolean;
    userFolder?: boolean;
    width?: number;
    height?: number;
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    shortcut?: boolean;
    clampHeightToViewport?: boolean;
}

export interface ContextMenuItem {
    id: string;
    label?: string;
    disabled?: boolean;
    checked?: boolean;
    separator?: boolean;
    submenu?: ContextMenuItem[];
    onSelect?: () => void;
}

export interface ContextMenuState {
    x: number;
    y: number;
    items: ContextMenuItem[];
}

export type File = AbsoluteObject & {
    id: string;
}

export type windowsInitiationState = "shutDown" | "bios" | "welcome" | "transition" | "login" | "loggingIn" | "loggedIn" | "bsod";
export type themeColor = "blue" | "green" | "silver";

export interface State {
    wallpaper: string;
    currentTime: Date;
    currentWindows: currentWindow[];
    username: string;
    avatarSrc: string;
    personalMessage: string;
    isStartVisible: boolean;
    isAllProgramsOpen: boolean;
    isRecentDocumentsOpen: boolean;
    isShutDownModalOpen: boolean;
    windowsInitiationState: windowsInitiationState;
    initiationStage: number;
    isInitialBoot: boolean;
    transitionLabel: string;
    isCRTEnabled: boolean;
    themeColor: themeColor;
    isTaskbarLocked: boolean;
    shellFiles: Record<string, ShellEntry[]>;
    customFiles: Record<string, ShellEntry[]>;
    customApplications: Record<string, Application>;
}

export interface AccountStateSnapshot {
    avatarSrc: string;
    personalMessage: string;
    wallpaper: string;
    currentTime: Date;
    isTaskbarLocked: boolean;
    shellFiles: Record<string, ShellEntry[]>;
    customFiles: Record<string, ShellEntry[]>;
    customApplications: Record<string, Application>;
}

export type Action =
    | { type: "SET_WALLPAPER"; payload: string }
    | { type: "SET_CURRENT_TIME"; payload: Date }
    | { type: "SET_CURRENT_WINDOWS"; payload: currentWindow[] }
    | { type: "SET_IS_START_VISIBLE"; payload: boolean }
    | { type: "SET_AVATAR_SRC"; payload: string }
    | { type: "SET_PERSONAL_MESSAGE"; payload: string }
    | { type: "SET_IS_ALL_PROGRAMS_OPEN"; payload: boolean }
    | { type: "SET_IS_RECENT_DOCUMENTS_OPEN"; payload: boolean }
    | { type: "SET_IS_SHUTDOWN_MODAL_OPEN"; payload: boolean }
    | { type: "SET_WINDOWS_INITIATION_STATE"; payload: windowsInitiationState; }
    | { type: "SET_INITIATION_STAGE"; payload: number; }
    | { type: "SET_IS_INITIAL_BOOT"; payload: boolean; }
    | { type: "SET_TRANSITION_LABEL"; payload: string; }
    | { type: "SET_IS_CRT_ENABLED"; payload: boolean; }
    | { type: "SET_THEME_COLOR"; payload: themeColor;}
    | { type: "SET_USERNAME"; payload: string; }
    | { type: "SET_IS_TASKBAR_LOCKED"; payload: boolean; }
    | { type: "HYDRATE_ACCOUNT_STATE"; payload: AccountStateSnapshot }
    | {
        type: "CREATE_SHELL_ITEM";
        payload: {
            containerId: string;
            appId: string;
            entry: ShellEntry;
            application: Application;
            contents?: ShellEntry[];
        };
    }
    | {
        type: "DELETE_SHELL_ITEM";
        payload: {
            containerId: string;
            appId: string;
        };
    }
    | {
        type: "UPDATE_SHELL_ITEM";
        payload: {
            appId: string;
            application: Partial<Application>;
        };
    }
    | {
        type: "REGISTER_CUSTOM_APPLICATION";
        payload: {
            appId: string;
            application: Application;
        };
    }
    | {
        type: "MOVE_SHELL_ITEM";
        payload: {
            appId: string;
            sourceContainerId: string;
            targetContainerId: string;
            targetPosition?: AbsoluteObject;
        };
    }
    | {
        type: "UPDATE_SHELL_ITEM_POSITION";
        payload: {
            appId: string;
            containerId: string;
            position: AbsoluteObject;
        };
    }


export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
    contextMenu: ContextMenuState | null;
    openContextMenu: (menu: ContextMenuState) => void;
    closeContextMenu: () => void;
}
