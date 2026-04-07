import { generateUniqueId } from "./general";
import type { Application, ContextMenuItem, ShellEntry, AbsoluteObject } from "../context/types";

export type ShellContextSurface = "desktop" | "desktopFolderItem" | "fileExplorerBackground" | "taskbar";
export type NewShellItemKind = "folder" | "shortcut" | "briefcase";

type NewMenuOptions = {
    onCreateItem: (kind: NewShellItemKind) => void;
};

type TaskbarMenuOptions = {
    isTaskbarLocked: boolean;
    onOpenTaskManager: () => void;
    onToggleTaskbarLock: () => void;
};

type DesktopFolderItemMenuOptions = {
    canDelete: boolean;
    canRename: boolean;
    canOpen: boolean;
    onOpen: () => void;
    onExplore: () => void;
    onCreateShortcut: () => void;
    onDelete: () => void;
    onRename: () => void;
};

type ShellContextMenuOptions = {
    desktop: NewMenuOptions;
    desktopFolderItem: DesktopFolderItemMenuOptions;
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

const buildArrangeIconsBySubmenu = (): ContextMenuItem[] => [
    {
        id: "arrange-icons-by-name",
        label: "Name",
        disabled: true,
    },
    {
        id: "arrange-icons-by-size",
        label: "Size",
        disabled: true,
    },
    {
        id: "arrange-icons-by-type",
        label: "Type",
        disabled: true,
    },
    {
        id: "arrange-icons-by-modified",
        label: "Modified",
        disabled: true,
    },
];

const buildGraphicsOptionsSubmenu = (): ContextMenuItem[] => [
    {
        id: "graphics-options-rotation",
        label: "Rotation",
        disabled: true,
    },
    {
        id: "graphics-options-output",
        label: "Output To",
        disabled: true,
    },
    {
        id: "graphics-options-tray",
        label: "Tray Icon",
        disabled: true,
    },
];

const buildSendToSubmenu = ({ onCreateShortcut }: Pick<DesktopFolderItemMenuOptions, "onCreateShortcut">): ContextMenuItem[] => [
    {
        id: "send-to-desktop-shortcut",
        label: "Desktop (create shortcut)",
        disabled: true,
        onSelect: onCreateShortcut,
    },
    {
        id: "send-to-documents",
        label: "My Documents",
        disabled: true,
    },
    {
        id: "send-to-mail",
        label: "Mail Recipient",
        disabled: true,
    },
];

export const buildShellContextMenu = <T extends ShellContextSurface>(
    surface: T,
    options: ShellContextMenuOptions[T],
): ContextMenuItem[] => {
    if (surface === "desktopFolderItem") {
        const { canDelete, canRename, canOpen, onOpen, onExplore, onCreateShortcut, onDelete, onRename } = options as DesktopFolderItemMenuOptions;

        return [
            {
                id: "desktop-item-open",
                label: "Open",
                disabled: !canOpen,
                onSelect: onOpen,
            },
            {
                id: "desktop-item-explore",
                label: "Explore",
                disabled: !canOpen,
                onSelect: onExplore,
            },
            {
                id: "desktop-item-search",
                label: "Search...",
                disabled: true,
            },
            {
                id: "desktop-item-separator-open",
                separator: true,
            },
            {
                id: "desktop-item-sharing",
                label: "Sharing and Security...",
                disabled: true,
            },
            {
                id: "desktop-item-separator-sharing",
                separator: true,
            },
            {
                id: "desktop-item-send-to",
                label: "Send To",
                submenu: buildSendToSubmenu({ onCreateShortcut }),
            },
            {
                id: "desktop-item-separator-clipboard",
                separator: true,
            },
            {
                id: "desktop-item-cut",
                label: "Cut",
                disabled: true,
            },
            {
                id: "desktop-item-copy",
                label: "Copy",
                disabled: true,
            },
            {
                id: "desktop-item-paste",
                label: "Paste",
                disabled: true,
            },
            {
                id: "desktop-item-separator-edit",
                separator: true,
            },
            {
                id: "desktop-item-create-shortcut",
                label: "Create Shortcut",
                onSelect: onCreateShortcut,
            },
            {
                id: "desktop-item-delete",
                label: "Delete",
                disabled: !canDelete,
                onSelect: onDelete,
            },
            {
                id: "desktop-item-rename",
                label: "Rename",
                disabled: !canRename,
                onSelect: onRename,
            },
            {
                id: "desktop-item-separator-properties",
                separator: true,
            },
            {
                id: "desktop-item-properties",
                label: "Properties",
                disabled: true,
            },
        ];
    }

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
            id: "desktop-arrange-icons-by",
            label: "Arrange Icons By",
            disabled: true,
            submenu: buildArrangeIconsBySubmenu(),
        },
        {
            id: "desktop-refresh",
            label: "Refresh",
            disabled: true,
        },
        {
            id: "desktop-separator-paste",
            separator: true,
        },
        {
            id: "desktop-paste",
            label: "Paste",
            disabled: true,
        },
        {
            id: "desktop-paste-shortcut",
            label: "Paste Shortcut",
            disabled: true,
        },
        {
            id: "desktop-undo-action",
            label: "Undo [Action]",
            disabled: true,
        },
        {
            id: "desktop-separator-graphics",
            separator: true,
        },
        {
            id: "desktop-graphics-properties",
            label: "Graphics Properties...",
            disabled: true,
        },
        {
            id: "desktop-graphics-options",
            label: "Graphics Options",
            disabled: true,
            submenu: buildGraphicsOptionsSubmenu(),
        },
        {
            id: "desktop-separator-new",
            separator: true,
        },
        {
            id: "new",
            label: "New",
            submenu: buildNewSubmenu(newMenuOptions),
        },
        {
            id: "desktop-separator-properties",
            separator: true,
        },
        {
            id: "desktop-properties",
            label: "Properties",
            disabled: true,
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

const offsetDesktopPosition = (position?: AbsoluteObject) => {
    if (!position) return undefined;

    return normalizeDesktopPosition({
        top: (position.top || 0) + 18,
        left: (position.left || 0) + 18,
    });
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

export const createShortcutShellItemPayload = (
    sourceAppId: string,
    sourceApplication: Application,
    applications: Record<string, Application>,
    position?: AbsoluteObject,
) => {
    const appId = `custom-shortcut-${generateUniqueId()}`;
    const entryPosition = offsetDesktopPosition(position);
    const entry: ShellEntry = entryPosition ? [appId, entryPosition] : appId;
    const title = getUniqueShellItemTitle(`Shortcut to ${sourceApplication.title}`, applications);

    return {
        containerId: "desktop",
        appId,
        entry,
        application: {
            title,
            icon: sourceApplication.icon,
            iconLarge: sourceApplication.iconLarge,
            link: sourceApplication.link,
            redirect: sourceApplication.link ? undefined : (sourceApplication.redirect || sourceAppId),
            disabled: sourceApplication.disabled,
            shortcut: true,
        } satisfies Application,
    };
};

export const getShellEntryId = (entry: ShellEntry) => Array.isArray(entry) ? entry[0] : entry;

export const getDropContainerId = (
    appId: string,
    application: Application | undefined,
    applications: Record<string, Application>,
) => {
    if (!application || application.shortcut) return null;

    const targetAppId = application.redirect || appId;
    if (targetAppId === "recycleBin") return targetAppId;

    const targetApplication = applications[targetAppId];
    if (targetApplication?.component === "FileExplorer") return targetAppId;

    return null;
};
