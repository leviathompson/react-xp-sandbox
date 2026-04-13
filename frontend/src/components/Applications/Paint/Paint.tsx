import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import { generateUniqueId } from "../../../utils/general";
import { addShellBrowserResultListener, openShellBrowserWindow } from "../../../utils/shellBrowser";
import { getShellEntryId } from "../../../utils/shell";
import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./Paint.module.scss";
import type { Application, ShellEntry, currentWindow } from "../../../context/types";

type PaintTool = "pencil" | "eraser" | "line" | "rectangle" | "ellipse" | "fill";

interface PaintDocumentContent {
    documentKind?: "paint";
    documentName?: string;
    imageSrc?: string;
    canvasWidth?: number;
    canvasHeight?: number;
}

interface PaintProps {
    appId: string;
    id?: string | number;
    content?: unknown;
}

const baseApplications = applicationsJSON as unknown as Record<string, Application>;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 380;
const brushSizes = [2, 4, 8, 12];
const defaultColors = [
    "#000000", "#7f7f7f", "#7f0000", "#7f7f00", "#008000", "#007f7f", "#00007f", "#7f007f",
    "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff",
    "#ffe0c0", "#804000", "#4080ff", "#ff8040", "#808040", "#408080", "#804080", "#ff80c0",
];
const toolLabels: Record<PaintTool, string> = {
    pencil: "Pencil",
    eraser: "Eraser",
    line: "Line",
    rectangle: "Rectangle",
    ellipse: "Oval",
    fill: "Fill",
};
const toolIcons: Record<PaintTool, string> = {
    pencil: "/icon__pencil.png",
    eraser: "/icon__eraser.png",
    line: "/icon__line.png",
    rectangle: "/icon__rectangle.png",
    ellipse: "/icon__oval.png",
    fill: "/icon__fill.png",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const cloneImageData = (imageData: ImageData) => new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

const hexToRgba = (hex: string) => {
    const normalized = hex.replace("#", "");
    const length = normalized.length === 3 ? 1 : 2;
    const expand = (value: string) => length === 1 ? value.repeat(2) : value;

    const r = parseInt(expand(normalized.slice(0, length)), 16);
    const g = parseInt(expand(normalized.slice(length, length * 2)), 16);
    const b = parseInt(expand(normalized.slice(length * 2, length * 3)), 16);
    return [r, g, b, 255] as const;
};

const Paint = ({ appId, id, content }: PaintProps) => {
    const { currentWindows, shellFiles, customApplications, dispatch } = useContext();
    const applications = useMemo(
        () => ({ ...baseApplications, ...customApplications }),
        [customApplications],
    );
    const application = applications[appId];
    const currentContent = (content || application?.content || {}) as PaintDocumentContent;
    const isSavedDocument = !!customApplications[appId];
    const documentName = currentContent.documentName || (isSavedDocument ? application?.title : "untitled") || "untitled";
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const startPointRef = useRef({ x: 0, y: 0 });
    const previewSnapshotRef = useRef<ImageData | null>(null);
    const loadVersionRef = useRef(0);
    const undoStackRef = useRef<ImageData[]>([]);
    const redoStackRef = useRef<ImageData[]>([]);
    const dialogHandlersRef = useRef(new Map<string, (selection?: {
        containerId: string;
        appId?: string;
        fileName?: string;
        application?: Application;
    }) => void>());

    const [selectedTool, setSelectedTool] = useState<PaintTool>("pencil");
    const [selectedColor, setSelectedColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(4);
    const [statusText, setStatusText] = useState("For Help, click Help Topics on the Help Menu.");
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

    const getContext = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) || null;
    const updateHistoryState = () => setHistoryState({
        canUndo: undoStackRef.current.length > 1,
        canRedo: redoStackRef.current.length > 0,
    });
    const captureSnapshot = () => {
        const ctx = getContext();
        if (!ctx) return null;
        return cloneImageData(ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    };
    const applySnapshot = (snapshot: ImageData) => {
        const ctx = getContext();
        if (!ctx) return;
        ctx.putImageData(snapshot, 0, 0);
    };
    const resetHistory = () => {
        const snapshot = captureSnapshot();
        if (!snapshot) return;
        undoStackRef.current = [snapshot];
        redoStackRef.current = [];
        updateHistoryState();
    };
    const pushHistory = () => {
        const snapshot = captureSnapshot();
        if (!snapshot) return;
        undoStackRef.current.push(snapshot);
        redoStackRef.current = [];
        updateHistoryState();
    };
    const getParentContainerId = (targetAppId: string) => Object.entries(shellFiles).find(([, entries]) =>
        entries.some((entry) => getShellEntryId(entry) === targetAppId)
    )?.[0] || "pictures";

    const resolveCanvasPoint = (event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: clamp(Math.round(((event.clientX - rect.left) / rect.width) * canvas.width), 0, canvas.width - 1),
            y: clamp(Math.round(((event.clientY - rect.top) / rect.height) * canvas.height), 0, canvas.height - 1),
        };
    };

    const clearCanvas = () => {
        const ctx = getContext();
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    };

    useEffect(() => {
        const nextImageSrc = currentContent.imageSrc;
        const currentVersion = loadVersionRef.current + 1;
        loadVersionRef.current = currentVersion;

        clearCanvas();

        if (!nextImageSrc) {
            resetHistory();
            setStatusText("Ready to draw.");
            return;
        }

        const image = new Image();
        image.onload = () => {
            if (loadVersionRef.current !== currentVersion) return;

            const ctx = getContext();
            if (!ctx) return;

            clearCanvas();
            ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            resetHistory();
            setStatusText(`Loaded ${documentName}.`);
        };
        image.src = nextImageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appId, currentContent.imageSrc, documentName]);

    useEffect(() => addShellBrowserResultListener((detail) => {
        const handler = dialogHandlersRef.current.get(detail.dialogId);
        if (!handler) return;

        dialogHandlersRef.current.delete(detail.dialogId);
        handler(detail.selection);
    }), []);

    const drawLine = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
    };

    const drawPreviewShape = (point: { x: number; y: number }) => {
        const ctx = getContext();
        if (!ctx || !previewSnapshotRef.current) return;

        const { x, y } = point;
        const { x: startX, y: startY } = startPointRef.current;
        ctx.putImageData(previewSnapshotRef.current, 0, 0);
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;

        if (selectedTool === "line") {
            drawLine(ctx, startX, startY, x, y);
            return;
        }

        if (selectedTool === "rectangle") {
            ctx.strokeRect(startX, startY, x - startX, y - startY);
            return;
        }

        if (selectedTool === "ellipse") {
            ctx.beginPath();
            ctx.ellipse((startX + x) / 2, (startY + y) / 2, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    const floodFill = (x: number, y: number) => {
        const ctx = getContext();
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const { data, width, height } = imageData;
        const startIndex = (y * width + x) * 4;
        const targetColor = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]] as const;
        const replacementColor = hexToRgba(selectedColor);

        if (targetColor.every((component, index) => component === replacementColor[index])) return;

        const pixels = [[x, y]];
        while (pixels.length > 0) {
            const next = pixels.pop();
            if (!next) continue;

            const [currentX, currentY] = next;
            if (currentX < 0 || currentX >= width || currentY < 0 || currentY >= height) continue;

            const index = (currentY * width + currentX) * 4;
            if (
                data[index] !== targetColor[0]
                || data[index + 1] !== targetColor[1]
                || data[index + 2] !== targetColor[2]
                || data[index + 3] !== targetColor[3]
            ) {
                continue;
            }

            data[index] = replacementColor[0];
            data[index + 1] = replacementColor[1];
            data[index + 2] = replacementColor[2];
            data[index + 3] = replacementColor[3];

            pixels.push([currentX + 1, currentY]);
            pixels.push([currentX - 1, currentY]);
            pixels.push([currentX, currentY + 1]);
            pixels.push([currentX, currentY - 1]);
        }

        ctx.putImageData(imageData, 0, 0);
        pushHistory();
        setStatusText("Filled a region.");
    };

    const handlePointerMove = (event: PointerEvent) => {
        if (!drawingRef.current) return;

        const ctx = getContext();
        if (!ctx) return;

        const point = resolveCanvasPoint(event);
        if (selectedTool === "pencil" || selectedTool === "eraser") {
            ctx.strokeStyle = selectedTool === "eraser" ? "#ffffff" : selectedColor;
            ctx.lineWidth = selectedTool === "eraser" ? Math.max(brushSize * 2, 10) : brushSize;
            drawLine(ctx, startPointRef.current.x, startPointRef.current.y, point.x, point.y);
            startPointRef.current = point;
            return;
        }

        drawPreviewShape(point);
    };

    const finishDrawing = (event: PointerEvent) => {
        if (!drawingRef.current) return;

        drawingRef.current = false;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishDrawing);

        if (selectedTool === "line" || selectedTool === "rectangle" || selectedTool === "ellipse") {
            drawPreviewShape(resolveCanvasPoint(event));
        }

        pushHistory();
        setStatusText(`Used ${toolLabels[selectedTool].toLowerCase()} tool.`);
    };

    const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = getContext();
        if (!ctx) return;

        const point = resolveCanvasPoint(event);
        startPointRef.current = point;

        if (selectedTool === "fill") {
            floodFill(point.x, point.y);
            return;
        }

        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;
        previewSnapshotRef.current = captureSnapshot();
        drawingRef.current = true;
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", finishDrawing);
    };

    const onUndo = () => {
        if (undoStackRef.current.length <= 1) return;
        const currentSnapshot = undoStackRef.current.pop();
        if (currentSnapshot) {
            redoStackRef.current.push(currentSnapshot);
        }
        const previousSnapshot = undoStackRef.current.at(-1);
        if (!previousSnapshot) return;

        applySnapshot(previousSnapshot);
        updateHistoryState();
        setStatusText("Undo.");
    };

    const onRedo = () => {
        const nextSnapshot = redoStackRef.current.pop();
        if (!nextSnapshot) return;

        undoStackRef.current.push(nextSnapshot);
        applySnapshot(nextSnapshot);
        updateHistoryState();
        setStatusText("Redo.");
    };

    const onNew = () => {
        clearCanvas();
        resetHistory();
        setStatusText("Started a new drawing.");
    };

    const buildPaintApplication = (title: string, imageSrc: string): Application => ({
        title,
        windowTitle: `${title} - Paint`,
        icon: "/icon__paint.webp",
        iconLarge: "/icon__paint.webp",
        assetSrc: imageSrc,
        component: "Paint",
        width: 680,
        height: 520,
        top: 80,
        left: 110,
        content: {
            documentKind: "paint",
            documentName: title,
            imageSrc,
            canvasWidth: CANVAS_WIDTH,
            canvasHeight: CANVAS_HEIGHT,
        } satisfies PaintDocumentContent,
    });

    const ensurePaintFileName = (value: string) => /\.[^.]+$/.test(value) ? value : `${value}.bmp`;

    const getUniqueFileName = (containerId: string, desiredName: string, excludedAppId?: string) => {
        const existingTitles = new Set(
            (shellFiles[containerId] || [])
                .map(getShellEntryId)
                .filter((entryAppId) => entryAppId !== excludedAppId)
                .map((entryAppId) => applications[entryAppId]?.title)
                .filter(Boolean),
        );

        if (!existingTitles.has(desiredName)) return desiredName;

        const extensionMatch = desiredName.match(/(\.[^.]+)$/);
        const extension = extensionMatch?.[1] || "";
        const stem = extension ? desiredName.slice(0, -extension.length) : desiredName;
        let index = 2;
        let nextName = `${stem} (${index})${extension}`;

        while (existingTitles.has(nextName)) {
            index += 1;
            nextName = `${stem} (${index})${extension}`;
        }

        return nextName;
    };

    const updateCurrentWindowApp = (nextAppId: string) => {
        if (id === undefined) return;

        const updatedWindows = currentWindows.map((window) => (
            window.id === id
                ? {
                    ...window,
                    appId: nextAppId,
                    active: true,
                    hidden: false,
                } satisfies currentWindow
                : {
                    ...window,
                    active: false,
                }
        ));

        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedWindows });
    };

    const saveDocumentTo = (containerId: string, requestedFileName?: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const imageSrc = canvas.toDataURL("image/png");
        const currentContainerId = getParentContainerId(appId);
        const baseName = ensurePaintFileName(requestedFileName || documentName || "untitled.bmp");
        const targetContainerId = containerId || "pictures";

        if (isSavedDocument && currentContainerId === targetContainerId && (!requestedFileName || baseName === application?.title)) {
            dispatch({
                type: "UPDATE_SHELL_ITEM",
                payload: {
                    appId,
                    application: buildPaintApplication(application?.title || baseName, imageSrc),
                },
            });
            setStatusText(`Saved ${application?.title || baseName}.`);
            return;
        }

        const targetTitle = getUniqueFileName(targetContainerId, baseName, isSavedDocument ? appId : undefined);
        const nextAppId = `paint-document-${generateUniqueId()}`;
        const entry: ShellEntry = targetContainerId === "desktop"
            ? [nextAppId, {
                top: 5 + ((shellFiles.desktop?.length || 0) % 7) * 85,
                left: 95,
            }]
            : nextAppId;

        dispatch({
            type: "CREATE_SHELL_ITEM",
            payload: {
                containerId: targetContainerId,
                appId: nextAppId,
                entry,
                application: buildPaintApplication(targetTitle, imageSrc),
            },
        });
        updateCurrentWindowApp(nextAppId);
        setStatusText(`Saved ${targetTitle} to ${applications[targetContainerId]?.title || "selected folder"}.`);
    };

    const onQuickSave = () => {
        if (!isSavedDocument) return;
        saveDocumentTo(getParentContainerId(appId));
    };

    const onLoadDocument = (selection: { appId?: string; application?: Application }) => {
        if (!selection.appId || selection.application?.component !== "Paint") return;
        updateCurrentWindowApp(selection.appId);
    };

    const openFileDialog = (mode: "open" | "save") => {
        const dialogId = generateUniqueId();

        dialogHandlersRef.current.set(dialogId, (selection) => {
            if (!selection) return;

            if (mode === "open") {
                onLoadDocument(selection);
                return;
            }

            saveDocumentTo(selection.containerId, selection.fileName);
        });

        openShellBrowserWindow({
            dialogId,
            title: mode === "open" ? "Open" : "Save As",
            confirmLabel: mode === "open" ? "Open" : "Save",
            mode,
            currentWindows,
            dispatch,
            initialContainerId: mode === "open"
                ? getParentContainerId(appId)
                : (isSavedDocument ? getParentContainerId(appId) : "pictures"),
            initialFileName: mode === "save" ? documentName.replace(/\.[^.]+$/, "") : undefined,
            filter: mode === "open" ? "paintDocuments" : null,
            icon: "/icon__paint.webp",
            iconLarge: "/icon__paint.webp",
            width: 620,
            height: 470,
            top: 90,
            left: 145,
        });
    };

    return (
        <div className={styles.paint}>
            <WindowMenu menuItems={["File", "Edit", "View", "Image", "Colors", "Help"]} />

            <div className={styles.actionBar}>
                <button type="button" onClick={onNew}>New</button>
                <button type="button" onClick={() => openFileDialog("open")}>Open</button>
                <button type="button" onClick={onQuickSave} disabled={!isSavedDocument}>Save</button>
                <button type="button" onClick={() => openFileDialog("save")}>Save As</button>
                <button type="button" onClick={onUndo} disabled={!historyState.canUndo}>Undo</button>
                <button type="button" onClick={onRedo} disabled={!historyState.canRedo}>Redo</button>
            </div>

            <div className={styles.workspace}>
                <aside className={styles.toolbox}>
                    <div className={styles.toolGrid}>
                        {(Object.keys(toolLabels) as PaintTool[]).map((tool) => (
                            <button
                                key={tool}
                                type="button"
                                data-selected={selectedTool === tool}
                                title={toolLabels[tool]}
                                onClick={() => setSelectedTool(tool)}
                            >
                                <img src={toolIcons[tool]} alt={toolLabels[tool]} />
                            </button>
                        ))}
                    </div>

                    <div className={styles.brushSizes}>
                        {brushSizes.map((size) => (
                            <button
                                key={size}
                                type="button"
                                data-selected={brushSize === size}
                                onClick={() => setBrushSize(size)}
                            >
                                <span style={{ width: size, height: size }} />
                            </button>
                        ))}
                    </div>
                </aside>

                <main className={styles.canvasPane}>
                    <div className={styles.canvasFrame}>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_WIDTH}
                            height={CANVAS_HEIGHT}
                            onPointerDown={onCanvasPointerDown}
                        />
                    </div>
                </main>
            </div>

            <footer className={styles.footer}>
                <div className={styles.palette}>
                    {defaultColors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            data-selected={selectedColor === color}
                            style={{ background: color }}
                            onClick={() => setSelectedColor(color)}
                        />
                    ))}
                </div>
                <div className={styles.statusBar}>
                    <span>{statusText}</span>
                    <span>{documentName}</span>
                </div>
            </footer>
        </div>
    );
};

export default Paint;
