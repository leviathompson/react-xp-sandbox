import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import applications from "../data/applications.json";
import pointRules from "../data/pointRules";
import { awardClickThresholdPoints } from "../App";
import Desktop from "../components/Desktop/Desktop";
import DesktopIcon from "../components/DesktopIcon/DesktopIcon";
import ShutDownModal from "../components/ShutDownModal/ShutDownModal";
import ControlPanel from "../components/Applications/ControlPanel/ControlPanel";
import BonziBuddy from "../components/Applications/BonziBuddy/BonziBuddy";
import FileExplorer from "../components/Applications/FileExplorer/FileExplorer";
import InternetExplorer from "../components/Applications/InternetExplorer/InternetExplorer";
import InternetOptions from "../components/Applications/InternetOptions/InternetOptions";
import MediaPlayer from "../components/Applications/MediaPlayer/MediaPlayer";
import Messenger from "../components/Applications/Messenger/Messenger";
import Solitaire from "../components/Applications/Solitaire/Solitaire";
import UserAccounts from "../components/Applications/UserAccounts/UserAccounts";
import type { ContextMenuItem } from "../context/types";
import { fetchActiveSessions } from "../utils/messenger";
import { saveUserProfile } from "../utils/userProfile";

let mockContextValue: any;
const mockAwardPoints = vi.fn();
const mockDispatch = vi.fn();
const mockOpenContextMenu = vi.fn();
let lastContextMenu: { items: ContextMenuItem[] } | null = null;

vi.mock("../context/context", () => ({
    useContext: () => mockContextValue,
}));

vi.mock("../context/points", () => ({
    usePoints: () => ({
        rules: [],
        sessionPoints: 0,
        lifetimePoints: 0,
        awards: [],
        recentAwards: [],
        pendingSyncCount: 0,
        awardPoints: mockAwardPoints,
        getRule: vi.fn(),
        resetSession: vi.fn(),
    }),
}));

vi.mock("../utils/bonziBuddy", () => ({
    speakBonziGreeting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/sounds", () => ({
    default: vi.fn(),
    loadSound: vi.fn(),
    playLoadedSound: vi.fn(),
    stopLoadedSound: vi.fn(),
    playAwardSound: vi.fn(),
    playMessengerPopSound: vi.fn(),
}));

vi.mock("../utils/messengerRealtime", () => ({
    subscribeToMessengerRealtime: vi.fn(() => () => {}),
}));

vi.mock("../utils/messenger", async () => {
    const actual = await vi.importActual<typeof import("../utils/messenger")>("../utils/messenger");
    return {
        ...actual,
        fetchActiveSessions: vi.fn(async () => ({ sessions: [] })),
    };
});

vi.mock("../utils/userProfile", async () => {
    const actual = await vi.importActual<typeof import("../utils/userProfile")>("../utils/userProfile");
    return {
        ...actual,
        saveUserProfile: vi.fn(async (_userId: string, payload: { avatarSrc?: string }) => ({
            avatarSrc: payload.avatarSrc || "/avatar__astronaut.png",
        })),
    };
});

const fetchActiveSessionsMock = vi.mocked(fetchActiveSessions);
const saveUserProfileMock = vi.mocked(saveUserProfile);

const createDefaultContextValue = (overrides: Record<string, unknown> = {}) => ({
    wallpaper: "Bliss",
    currentTime: new Date("2026-01-01T00:00:00.000Z"),
    currentWindows: [],
    username: "User",
    avatarSrc: "/avatar__skateboard.png",
    personalMessage: "",
    isStartVisible: false,
    isAllProgramsOpen: false,
    isRecentDocumentsOpen: false,
    isShutDownModalOpen: false,
    windowsInitiationState: "loggedIn",
    initiationStage: 3,
    isInitialBoot: false,
    transitionLabel: "",
    isCRTEnabled: false,
    themeColor: "blue",
    isTaskbarLocked: false,
    shellFiles: {
        desktop: [],
        recycleBin: [],
        minecraftFolder: [],
        music: ["inTheEnd"],
    },
    customFiles: {},
    customApplications: {},
    contextMenu: null,
    dispatch: mockDispatch,
    openContextMenu: mockOpenContextMenu,
    closeContextMenu: vi.fn(),
    ...overrides,
});

const findMenuItem = (items: ContextMenuItem[], id: string): ContextMenuItem | null => {
    for (const item of items) {
        if (item.id === id) return item;
        if (item.submenu) {
            const match = findMenuItem(item.submenu, id);
            if (match) return match;
        }
    }

    return null;
};

const readmeLines = (
    (applications as { readme: { content: string } }).readme.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
);

const testedReadmeLines = [
    "Open solitaire",
    "Create a new folder on the desktop",
    "Rename a folder to something funny",
    "Create a shortcut to My Computer",
    "Delete your browser history (not your real browsing history)",
    "Drag My Computer into the Recycle Bin",
    "Open \"In The End.mp3\"",
    "Restart your computer",
    "Visit neopets",
    "Locate the .minecraft folder",
    "Open Bonzi Buddy",
    "Open Control Panel",
    "Open MSN Messenger",
    "Change your account picture",
    "Find windows_11.exe",
    "Delete system32",
    "Click 100 times",
    "Click 1000 times",
    "Click 10000 times",
];

beforeEach(() => {
    mockAwardPoints.mockReset();
    mockDispatch.mockReset();
    mockOpenContextMenu.mockReset();
    mockOpenContextMenu.mockImplementation((menu) => {
        lastContextMenu = menu;
    });
    lastContextMenu = null;
    fetchActiveSessionsMock.mockResolvedValue({ sessions: [] });
    saveUserProfileMock.mockResolvedValue({ avatarSrc: "/avatar__astronaut.png" } as Awaited<ReturnType<typeof saveUserProfile>>);
    mockContextValue = createDefaultContextValue();
});

describe("ReadMe point coverage", () => {
    it("documents only actions covered by this suite", () => {
        expect(readmeLines).toEqual(testedReadmeLines);
    });

    it("has a point rule for every documented action", () => {
        const requiredRuleIds = [
            "open-solitaire",
            "create-desktop-folder",
            "rename-folder",
            "create-my-computer-shortcut",
            "delete-browser-history",
            "trash-my-computer",
            "open-in-the-end",
            "restart-computer",
            "visit-neopets",
            "locate-minecraft-folder",
            "open-bonzi-buddy",
            "open-control-panel",
            "open-messenger",
            "change-account-picture",
            "find-windows11",
            "delete-system32",
            "click-100",
            "click-1000",
            "click-10000",
        ];

        expect(pointRules.map((rule) => rule.id)).toEqual(expect.arrayContaining(requiredRuleIds));
    });

    it("Open solitaire awards points", () => {
        render(<Solitaire />);
        expect(mockAwardPoints).toHaveBeenCalledWith("open-solitaire");
    });

    it("Create a new folder on the desktop awards points", () => {
        const { container } = render(<Desktop />);

        fireEvent.contextMenu(container.firstElementChild as HTMLElement);
        findMenuItem(lastContextMenu?.items || [], "new-folder")?.onSelect?.();

        expect(mockAwardPoints).toHaveBeenCalledWith("create-desktop-folder");
    });

    it("Rename a folder to something funny awards points", () => {
        mockContextValue = createDefaultContextValue({
            customApplications: {
                "custom-folder": {
                    title: "New Folder",
                    icon: "/icon__file_explorer.png",
                    iconLarge: "/icon__new_folder--large.png",
                    component: "FileExplorer",
                    height: 390,
                },
            },
        });
        vi.spyOn(window, "prompt").mockReturnValue("Funny Folder");

        const { container } = render(
            <DesktopIcon
                id="custom-folder"
                appId="custom-folder"
                selectedId=""
                setSelectedId={vi.fn()}
            />
        );

        fireEvent.contextMenu(container.querySelector("[data-label='desktop-icon']") as HTMLElement);
        findMenuItem(lastContextMenu?.items || [], "desktop-item-rename")?.onSelect?.();

        expect(mockAwardPoints).toHaveBeenCalledWith("rename-folder", expect.objectContaining({
            metadata: expect.objectContaining({
                appId: "custom-folder",
                title: "Funny Folder",
            }),
        }));
    });

    it("Create a shortcut to My Computer awards points", () => {
        const { container } = render(
            <DesktopIcon
                id="computer"
                appId="computer"
                selectedId=""
                setSelectedId={vi.fn()}
            />
        );

        fireEvent.contextMenu(container.querySelector("[data-label='desktop-icon']") as HTMLElement);
        findMenuItem(lastContextMenu?.items || [], "desktop-item-create-shortcut")?.onSelect?.();

        expect(mockAwardPoints).toHaveBeenCalledWith("create-my-computer-shortcut");
    });

    it("Delete your browser history awards points", async () => {
        mockContextValue = createDefaultContextValue({
            currentWindows: [
                {
                    id: "ie-window",
                    appId: "internetExplorer",
                    active: false,
                    history: ["https://example.com"],
                    forward: [],
                    landingUrl: "https://www.msn.com",
                    currentUrl: "https://example.com",
                },
                {
                    id: "options-window",
                    appId: "internetOptions",
                    active: true,
                    parentWindowId: "ie-window",
                },
            ],
        });

        const user = userEvent.setup();
        render(<InternetOptions id="options-window" parentWindowId="ie-window" />);
        await user.click(screen.getByRole("button", { name: "Clear History" }));

        expect(mockAwardPoints).toHaveBeenCalledWith("delete-browser-history");
    });

    it("Drag My Computer into the Recycle Bin awards points", () => {
        const { container } = render(
            <DesktopIcon
                id="recycleBin"
                appId="recycleBin"
                selectedId=""
                setSelectedId={vi.fn()}
            />
        );

        fireEvent.drop(container.querySelector("[data-label='desktop-icon']") as HTMLElement, {
            dataTransfer: {
                getData: (type: string) => type === "text/x-shell-item"
                    ? JSON.stringify({ appId: "computer", sourceContainerId: "desktop" })
                    : "",
            },
        });

        expect(mockAwardPoints).toHaveBeenCalledWith("trash-my-computer");
    });

    it("Open \"In The End.mp3\" awards points", () => {
        render(<MediaPlayer appId="inTheEnd" />);
        expect(mockAwardPoints).toHaveBeenCalledWith("open-in-the-end");
    });

    it("Restart your computer awards points", async () => {
        const user = userEvent.setup();
        render(<ShutDownModal isLogout={false} />);
        await user.click(screen.getByRole("button", { name: "Restart" }));

        expect(mockAwardPoints).toHaveBeenCalledWith("restart-computer");
    });

    it("Visit neopets awards points", async () => {
        mockContextValue = createDefaultContextValue({
            currentWindows: [
                {
                    id: "ie-window",
                    appId: "internetExplorer",
                    active: true,
                    history: [],
                    forward: [],
                    landingUrl: "https://www.msn.com",
                    currentUrl: "https://www.msn.com",
                },
            ],
        });

        const user = userEvent.setup();
        render(<InternetExplorer appId="internetExplorer" />);
        await user.click(screen.getByRole("button", { name: "Favorites" }));
        await user.click(screen.getByRole("menuitem", { name: "Neopets" }));

        expect(mockAwardPoints).toHaveBeenCalledWith("visit-neopets");
    });

    it("Locate the .minecraft folder awards points", () => {
        render(<FileExplorer appId="minecraftFolder" />);
        expect(mockAwardPoints).toHaveBeenCalledWith("locate-minecraft-folder");
    });

    it("Open Bonzi Buddy awards points", () => {
        render(<BonziBuddy />);
        expect(mockAwardPoints).toHaveBeenCalledWith("open-bonzi-buddy");
    });

    it("Open Control Panel awards points", () => {
        render(<ControlPanel />);
        expect(mockAwardPoints).toHaveBeenCalledWith("open-control-panel");
    });

    it("Open MSN Messenger awards points", async () => {
        render(<Messenger />);
        await waitFor(() => expect(mockAwardPoints).toHaveBeenCalledWith("open-messenger"));
    });

    it("Change your account picture awards points", async () => {
        const user = userEvent.setup();
        render(<UserAccounts />);

        await user.click(screen.getByRole("button", { name: "Astronaut" }));
        await user.click(screen.getByRole("button", { name: "Change Picture" }));

        await waitFor(() => expect(saveUserProfileMock).toHaveBeenCalled());
        expect(mockAwardPoints).toHaveBeenCalledWith("change-account-picture");
    });

    it("Find windows_11.exe awards points", async () => {
        mockContextValue = createDefaultContextValue({
            currentWindows: [
                {
                    id: "recycle-window",
                    appId: "recycleBin",
                    active: true,
                    history: [],
                    forward: [],
                },
            ],
            shellFiles: {
                ...createDefaultContextValue().shellFiles,
                recycleBin: ["win11"],
            },
        });

        const user = userEvent.setup();
        render(<FileExplorer appId="recycleBin" />);
        await user.click(screen.getByText("windows_11.exe"));

        expect(mockAwardPoints).toHaveBeenCalledWith("find-windows11");
    });

    it("Delete system32 awards points", () => {
        const { container } = render(
            <DesktopIcon
                id="system32"
                appId="system32"
                selectedId=""
                setSelectedId={vi.fn()}
            />
        );

        fireEvent.contextMenu(container.querySelector("[data-label='desktop-icon']") as HTMLElement);
        findMenuItem(lastContextMenu?.items || [], "desktop-item-delete")?.onSelect?.();

        expect(mockAwardPoints).toHaveBeenCalledWith("delete-system32");
    });

    it("Click 100 times awards points", () => {
        const thresholdAwardPoints = vi.fn();
        awardClickThresholdPoints(100, thresholdAwardPoints);
        expect(thresholdAwardPoints).toHaveBeenCalledWith("click-100");
    });

    it("Click 1000 times awards points", () => {
        const thresholdAwardPoints = vi.fn();
        awardClickThresholdPoints(1000, thresholdAwardPoints);
        expect(thresholdAwardPoints).toHaveBeenCalledWith("click-1000");
    });

    it("Click 10000 times awards points", () => {
        const thresholdAwardPoints = vi.fn();
        awardClickThresholdPoints(10000, thresholdAwardPoints);
        expect(thresholdAwardPoints).toHaveBeenCalledWith("click-10000");
    });
});
