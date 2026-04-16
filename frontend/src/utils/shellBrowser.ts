import { openApplication, updateCurrentActiveWindow } from "./general";
import type { Action, Application, currentWindow } from "../context/types";

export type ShellBrowserMode = "open" | "save";
export type ShellBrowserFilter = "paintDocuments" | "imageAttachments" | null;

export interface ShellBrowserSelection {
    containerId: string;
    appId?: string;
    fileName?: string;
    application?: Application;
}

export interface ShellBrowserWindowContent {
    dialogId: string;
    confirmLabel: string;
    mode: ShellBrowserMode;
    initialContainerId?: string;
    initialFileName?: string;
    filter?: ShellBrowserFilter;
}

export interface ShellBrowserResultDetail {
    dialogId: string;
    selection?: ShellBrowserSelection;
    cancelled?: boolean;
}

const SHELL_BROWSER_RESULT_EVENT = "shell-browser-result";

export const buildShellBrowserAppId = (dialogId: string) => `shellBrowser:${dialogId}`;

export const emitShellBrowserResult = (detail: ShellBrowserResultDetail) => {
    window.dispatchEvent(new CustomEvent<ShellBrowserResultDetail>(SHELL_BROWSER_RESULT_EVENT, { detail }));
};

export const addShellBrowserResultListener = (
    listener: (detail: ShellBrowserResultDetail) => void,
) => {
    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<ShellBrowserResultDetail>;
        listener(customEvent.detail);
    };

    window.addEventListener(SHELL_BROWSER_RESULT_EVENT, handler);
    return () => window.removeEventListener(SHELL_BROWSER_RESULT_EVENT, handler);
};

export const matchesShellBrowserFilter = (
    filter: ShellBrowserFilter,
    appId: string,
    application: Application,
) => {
    if (!filter) return true;

    if (filter === "paintDocuments") {
        return application.component === "Paint";
    }

    if (filter === "imageAttachments") {
        const content = application.content as { imageSrc?: string } | undefined;
        return (
            (application.component === "PictureViewer" && !!(application.assetSrc || application.iconLarge))
            || (application.component === "Paint" && !!content?.imageSrc)
        );
    }

    return !!appId;
};

interface OpenShellBrowserWindowOptions {
    dialogId: string;
    title: string;
    confirmLabel: string;
    mode: ShellBrowserMode;
    currentWindows: currentWindow[];
    dispatch: (value: Action) => void;
    initialContainerId?: string;
    initialFileName?: string;
    filter?: ShellBrowserFilter;
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    icon?: string;
    iconLarge?: string;
}

export const openShellBrowserWindow = ({
    dialogId,
    title,
    confirmLabel,
    mode,
    currentWindows,
    dispatch,
    initialContainerId,
    initialFileName,
    filter = null,
    top = 92,
    left = 150,
    width = 620,
    height = 470,
    icon = "/icon__file_explorer.png",
    iconLarge = "/icon__file_explorer--large.png",
}: OpenShellBrowserWindowOptions) => {
    const appId = buildShellBrowserAppId(dialogId);

    dispatch({
        type: "REGISTER_CUSTOM_APPLICATION",
        payload: {
            appId,
            application: {
                title,
                icon,
                iconLarge,
                component: "ShellBrowser",
                width,
                height,
                top,
                left,
                resizable: false,
                content: {
                    dialogId,
                    confirmLabel,
                    mode,
                    initialContainerId,
                    initialFileName,
                    filter,
                } satisfies ShellBrowserWindowContent,
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
