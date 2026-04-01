export type PointRuleLimit =
    | { type: "perSession"; maxAwards: number }
    | { type: "perDay"; maxAwards: number }
    | { type: "perLifetime"; maxAwards: number }
    | { type: "perEvent"; maxAwards: number };

export type PointRuleCategory = "application" | "system" | "challenge";

export interface PointRule {
    id: string;
    label: string;
    description: string;
    points: number;
    category: PointRuleCategory;
    limit?: PointRuleLimit;
    metadata?: Record<string, unknown>;
}

export const pointRules: PointRule[] = [
    {
        id: "open-solitaire",
        label: "Open Solitaire",
        description: "Launch the Solitaire application from any entry point.",
        points: 10,
        category: "application",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { appId: "solitaire" },
    },
    {
        id: "create-desktop-folder",
        label: "Create a Desktop Folder",
        description: "Use File Explorer to create a new folder on the desktop.",
        points: 8,
        category: "system",
        limit: { type: "perSession", maxAwards: 3 },
    },
    {
        id: "delete-browser-history",
        label: "Delete Browser History",
        description: "Clear the history inside the Internet Explorer experience.",
        points: 6,
        category: "system",
        limit: { type: "perDay", maxAwards: 1 },
    },
    {
        id: "create-my-computer-shortcut",
        label: "Create My Computer Shortcut",
        description: "Place a shortcut to My Computer on the desktop and keep it there.",
        points: 5,
        category: "system",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { targetAppId: "computer" },
    },
    {
        id: "open-in-the-end",
        label: "Play \"In The End.mp3\"",
        description: "Launch and play the In The End audio file.",
        points: 7,
        category: "application",
        limit: { type: "perSession", maxAwards: 2 },
        metadata: { fileId: "inTheEnd" },
    },
    {
        id: "restart-computer",
        label: "Restart the Computer",
        description: "Trigger a restart via the shutdown modal and return to the desktop.",
        points: 12,
        category: "system",
        limit: { type: "perSession", maxAwards: 1 },
    },
    {
        id: "visit-neopets",
        label: "Visit Neopets",
        description: "Open the browser and navigate to neopets.com.",
        points: 6,
        category: "application",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { url: "https://www.neopets.com" },
    },
    {
        id: "locate-minecraft-folder",
        label: "Locate .minecraft Folder",
        description: "Find and open the .minecraft folder via File Explorer.",
        points: 9,
        category: "challenge",
        limit: { type: "perSession", maxAwards: 1 },
    },
    {
        id: "play-interactive-buddy",
        label: "Play Interactive Buddy",
        description: "Launch the Interactive Buddy experience and interact with it.",
        points: 8,
        category: "application",
        limit: { type: "perSession", maxAwards: 1 },
    },
    {
        id: "open-soundboard",
        label: "Use Napoleon Dynamite Soundboard",
        description: "Open and trigger at least one sound in the Napoleon Dynamite soundboard.",
        points: 8,
        category: "application",
        limit: { type: "perSession", maxAwards: 1 },
    },
    {
        id: "find-windows11",
        label: "Find windows_11.exe",
        description: "Locate the hidden windows_11.exe file.",
        points: 15,
        category: "challenge",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { fileId: "win11" },
    },
    {
        id: "delete-system32",
        label: "Attempt to Delete System32",
        description: "Reach the prompt that threatens to delete System32 (and maybe think twice).",
        points: 20,
        category: "challenge",
        limit: { type: "perSession", maxAwards: 1 },
    },
    {
        id: "click-100",
        label: "Click Frenzy 100x",
        description: "Complete the 100-click challenge.",
        points: 5,
        category: "challenge",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { threshold: 100 },
    },
    {
        id: "click-1000",
        label: "Click Frenzy 1,000x",
        description: "Complete the 1,000-click challenge.",
        points: 12,
        category: "challenge",
        limit: { type: "perSession", maxAwards: 1 },
        metadata: { threshold: 1000 },
    },
    {
        id: "click-10000",
        label: "Click Frenzy 10,000x",
        description: "Complete the 10,000-click challenge.",
        points: 30,
        category: "challenge",
        limit: { type: "perLifetime", maxAwards: 1 },
        metadata: { threshold: 10000 },
    },
];

export default pointRules;
