import { generateUniqueId } from "./general";
import type { Application, ContextMenuItem, ShellEntry, AbsoluteObject } from "../context/types";

export type ShellContextSurface = "desktop" | "fileExplorerBackground" | "taskbar";
export type NewShellItemKind = "folder" | "shortcut" | "briefcase";

type NewMenuOptions = {
    onCreateItem: (kind: NewShellItemKind) => void;
};

type TaskbarMenuOptions = {
    isTaskbarLocked: boolean;
    onOpenTaskManager: () => void;
    onToggleTaskbarLock: () => void;
};

type ShellContextMenuOptions = {
    desktop: NewMenuOptions;
    fileExplorerBackground: NewMenuOptions;
    taskbar: TaskbarMenuOptions;
};

const BASE_ITEM_TITLES: Record<NewShellItemKind, string> = {
    folder: "New Folder",
    shortcut: "New Shortcut",
    briefcase: "New Briefcase",
};

const buildNewSubmenu = ({ onCreateItem }: NewMenuOptions): ContextMenuItem[] => [
    {
        id: "new-folder",
        label: "Folder",
        onSelect: () => onCreateItem("folder"),
    },
    {
        id: "new-shortcut",
        label: "Shortcut",
        onSelect: () => onCreateItem("shortcut"),
    },
    {
        id: "new-briefcase",
        label: "Briefcase",
        onSelect: () => onCreateItem("briefcase"),
    },
];

export const buildShellContextMenu = <T extends ShellContextSurface>(
    surface: T,
    options: ShellContextMenuOptions[T],
): ContextMenuItem[] => {
    if (surface === "taskbar") {
        const { isTaskbarLocked, onOpenTaskManager, onToggleTaskbarLock } = options as TaskbarMenuOptions;

        return [
            {
                id: "task-manager",
                label: "Task Manager",
                onSelect: onOpenTaskManager,
            },
            {
                id: "separator-taskbar-actions",
                separator: true,
            },
            {
                id: "lock-taskbar",
                label: "Lock the Taskbar",
                checked: isTaskbarLocked,
                onSelect: onToggleTaskbarLock,
            },
        ];
    }

    const newMenuOptions = options as NewMenuOptions;

    return [
        {
            id: "new",
            label: "New",
            submenu: buildNewSubmenu(newMenuOptions),
        },
    ];
};

const getUniqueShellItemTitle = (baseTitle: string, applications: Record<string, Application>) => {
    const existingTitles = new Set(
        Object.values(applications)
            .map((application) => application.title)
            .filter(Boolean),
    );

    if (!existingTitles.has(baseTitle)) return baseTitle;

    let index = 2;
    let nextTitle = `${baseTitle} (${index})`;

    while (existingTitles.has(nextTitle)) {
        index += 1;
        nextTitle = `${baseTitle} (${index})`;
    }

    return nextTitle;
};

const normalizeDesktopPosition = (position?: AbsoluteObject) => {
    if (!position) return undefined;

    return {
        top: Math.max(position.top || 0, 0),
        left: Math.max(position.left || 0, 0),
    };
};

export const createShellItemPayload = (
    kind: NewShellItemKind,
    containerId: string,
    applications: Record<string, Application>,
    position?: AbsoluteObject,
) => {
    const appId = `custom-${kind}-${generateUniqueId()}`;
    const title = getUniqueShellItemTitle(BASE_ITEM_TITLES[kind], applications);
    const desktopPosition = normalizeDesktopPosition(position);
    const entry: ShellEntry = desktopPosition ? [appId, desktopPosition] : appId;

    if (kind === "folder") {
        return {
            containerId,
            appId,
            entry,
            application: {
                title,
                icon: "/icon__file_explorer.png",
                iconLarge: "/icon__new_folder--large.png",
                component: "FileExplorer",
                height: 390,
            } satisfies Application,
            contents: [] as ShellEntry[],
        };
    }

    if (kind === "shortcut") {
        return {
            containerId,
            appId,
            entry,
            application: {
                title,
                iconLarge: "/icon__shortcut.png",
                content: "placeholder",
                disabled: true,
            } satisfies Application,
        };
    }

    return {
        containerId,
        appId,
        entry,
        application: {
            title,
            iconLarge: "/icon__share_folder--large.png",
            content: "placeholder",
            disabled: true,
        } satisfies Application,
    };
};
