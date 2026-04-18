import http from "http";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import WebSocket, { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import bonziTtsRouter from "./tts-proxy.js";

const PORT = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST_DIR = path.resolve(__dirname, "../frontend/dist");
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_DIR, "index.html");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MAX_AVATAR_SRC_LENGTH = 250000;
const MAX_PERSONAL_MESSAGE_LENGTH = 120;
const MAX_ATTACHMENT_SRC_LENGTH = 500000;
const MAX_WALLPAPER_LENGTH = 120;
const ADMIN_AVATAR_SRC = "/avatar__chess_pieces.png";
const CRYPTO_WALLET_STATE_ID = "global";
const CRYPTO_WALLET_MAX_ATTEMPTS = 3;
const CRYPTO_WALLET_LOCKOUT_MS = 5 * 60 * 1000;
const CRYPTO_WALLET_BALANCE_USD = 18369236.67;
const CRYPTO_WALLET_USERNAME = "gerrit23";
const CRYPTO_WALLET_PASSWORD = "L1nk1nP4rkR0x$";
const CRYPTO_WALLET_MAX_DOOMSDAY_MINUTES = 24 * 60;
const BLOCKED_PROXY_RESPONSE_HEADERS = new Set([
    "content-encoding",
    "content-length",
    "content-security-policy",
    "content-security-policy-report-only",
    "transfer-encoding",
    "x-frame-options",
]);
const STATIC_CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".wav": "audio/wav",
    ".webp": "image/webp",
};

const cors = (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
        catch (e) { reject(e); }
    });
    req.on("error", reject);
});

const json = (res, status, data) => {
    cors(res);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
};

const fileExists = async (targetPath) => {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
};

const serveStaticFile = async (res, filePath, status = 200) => {
    const extension = path.extname(filePath).toLowerCase();
    const contentType = STATIC_CONTENT_TYPES[extension] || "application/octet-stream";
    const fileBuffer = await fs.readFile(filePath);
    res.writeHead(status, { "Content-Type": contentType });
    res.end(fileBuffer);
};

const serveFrontendRoute = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    const requestPath = decodeURIComponent(url.pathname);
    const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const resolvedPath = path.resolve(
        FRONTEND_DIST_DIR,
        normalizedPath === path.sep ? "." : `.${normalizedPath}`
    );

    if (!resolvedPath.startsWith(FRONTEND_DIST_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return true;
    }

    let targetPath = resolvedPath;
    if (await fileExists(targetPath)) {
        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
            targetPath = path.join(targetPath, "index.html");
        }
    }

    if (await fileExists(targetPath)) {
        if (req.method === "HEAD") {
            const extension = path.extname(targetPath).toLowerCase();
            const contentType = STATIC_CONTENT_TYPES[extension] || "application/octet-stream";
            res.writeHead(200, { "Content-Type": contentType });
            res.end();
            return true;
        }

        await serveStaticFile(res, targetPath);
        return true;
    }

    if (path.extname(requestPath)) {
        return false;
    }

    if (!(await fileExists(FRONTEND_INDEX_PATH))) {
        return false;
    }

    if (req.method === "HEAD") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end();
        return true;
    }

    await serveStaticFile(res, FRONTEND_INDEX_PATH);
    return true;
};

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const mapUserSessionRow = (row) => ({
    userId: row.user_id,
    firstLoginAt: row.first_login_at,
    avatarSrc: row.is_admin ? ADMIN_AVATAR_SRC : row.avatar_src,
    personalMessage: row.personal_message,
    wallpaper: row.wallpaper,
    isTaskbarLocked: Boolean(row.is_taskbar_locked),
    isAdmin: Boolean(row.is_admin),
    hasSeenPresentationPopup: Boolean(row.has_seen_presentation_popup),
    shellFiles: row.shell_files,
    customFiles: row.custom_files,
    customApplications: row.custom_applications,
    updatedAt: row.updated_at,
});

const normalizeUserId = (value) => typeof value === "string" ? value.trim() : "";
const getAdminUserId = async (db = pool) => {
    const { rows } = await db.query(
        `SELECT user_id
         FROM user_sessions
         WHERE COALESCE(is_admin, FALSE) = TRUE
         LIMIT 1`
    );

    return rows[0]?.user_id ? normalizeUserId(rows[0].user_id) : "";
};

const assertAdminUser = async (userId, res, db = pool) => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        json(res, 400, { error: "userId required" });
        return null;
    }

    const adminUserId = await getAdminUserId(db);
    if (!adminUserId || adminUserId !== normalizedUserId) {
        json(res, 403, { error: "Admin privileges required" });
        return null;
    }

    return normalizedUserId;
};

const wsServer = new WebSocketServer({ noServer: true });
const realtimeClientsByUser = new Map();
let cryptoWalletDoomsdayTimer = null;

const sendRealtimeEvent = (socket, type, payload) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, payload }));
};

const sendRealtimeEventToUser = (userId, type, payload) => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return;

    const sockets = realtimeClientsByUser.get(normalizedUserId);
    if (!sockets) return;

    sockets.forEach((socket) => sendRealtimeEvent(socket, type, payload));
};

const broadcastRealtimeEvent = (type, payload) => {
    realtimeClientsByUser.forEach((sockets) => {
        sockets.forEach((socket) => sendRealtimeEvent(socket, type, payload));
    });
};

const attachRealtimeClient = (userId, socket) => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return;

    const sockets = realtimeClientsByUser.get(normalizedUserId) || new Set();
    sockets.add(socket);
    realtimeClientsByUser.set(normalizedUserId, sockets);
    socket.userId = normalizedUserId;

    socket.on("close", () => {
        const currentSockets = realtimeClientsByUser.get(normalizedUserId);
        if (!currentSockets) return;

        currentSockets.delete(socket);
        if (currentSockets.size === 0) {
            realtimeClientsByUser.delete(normalizedUserId);
        }
    });
};

const clearCryptoWalletDoomsdayTimer = () => {
    if (cryptoWalletDoomsdayTimer == null) return;
    clearTimeout(cryptoWalletDoomsdayTimer);
    cryptoWalletDoomsdayTimer = null;
};

const normalizeCryptoWalletState = (row) => {
    const lockedUntil = row?.locked_until || null;
    const doomsdayEndsAt = row?.doomsday_ends_at || null;
    const failedAttempts = Number(row?.failed_attempts) || 0;
    const now = Date.now();
    const hasExpiredDoomsday = Boolean(doomsdayEndsAt && new Date(doomsdayEndsAt).getTime() <= now);
    const isPermanentlyLocked = Boolean(row?.is_permanently_locked) || hasExpiredDoomsday;
    const isLocked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
    const remainingAttempts = isLocked
        ? 0
        : Math.max(CRYPTO_WALLET_MAX_ATTEMPTS - failedAttempts, 0);

    return {
        remainingAttempts,
        isLocked: isLocked || isPermanentlyLocked,
        lockedUntil,
        failedAttempts: isLocked ? CRYPTO_WALLET_MAX_ATTEMPTS : failedAttempts,
        balanceUsd: CRYPTO_WALLET_BALANCE_USD,
        doomsdayEndsAt,
        isDoomsdayActive: Boolean(doomsdayEndsAt && new Date(doomsdayEndsAt).getTime() > now && !isPermanentlyLocked),
        isPermanentlyLocked,
        isAccessed: Boolean(row?.is_accessed),
    };
};

const getCryptoWalletState = async (db = pool) => {
    await db.query(
        `INSERT INTO crypto_wallet_state (state_id)
         VALUES ($1)
         ON CONFLICT (state_id) DO NOTHING`,
        [CRYPTO_WALLET_STATE_ID]
    );

    let { rows } = await db.query(
        `SELECT state_id, failed_attempts, locked_until, doomsday_ends_at, is_permanently_locked, is_accessed, updated_at
         FROM crypto_wallet_state
         WHERE state_id = $1`,
        [CRYPTO_WALLET_STATE_ID]
    );

    let row = rows[0];
    if (!row) {
        row = { failed_attempts: 0, locked_until: null, doomsday_ends_at: null, is_permanently_locked: false };
    }

    if (row.locked_until && new Date(row.locked_until).getTime() <= Date.now()) {
        const resetResult = await db.query(
            `UPDATE crypto_wallet_state
             SET failed_attempts = 0,
                 locked_until = NULL,
                 updated_at = NOW()
             WHERE state_id = $1
             RETURNING state_id, failed_attempts, locked_until, doomsday_ends_at, is_permanently_locked, updated_at`,
            [CRYPTO_WALLET_STATE_ID]
        );
        row = resetResult.rows[0];
    }

    if (!row.is_permanently_locked && row.doomsday_ends_at && new Date(row.doomsday_ends_at).getTime() <= Date.now()) {
        const expireResult = await db.query(
            `UPDATE crypto_wallet_state
             SET is_permanently_locked = TRUE,
                 updated_at = NOW()
             WHERE state_id = $1
             RETURNING state_id, failed_attempts, locked_until, doomsday_ends_at, is_permanently_locked, updated_at`,
            [CRYPTO_WALLET_STATE_ID]
        );
        row = expireResult.rows[0];
    }

    return normalizeCryptoWalletState(row);
};

const scheduleCryptoWalletDoomsdayTimer = (state) => {
    clearCryptoWalletDoomsdayTimer();

    if (!state?.isDoomsdayActive || !state.doomsdayEndsAt || state.isPermanentlyLocked) return;

    const remainingMs = new Date(state.doomsdayEndsAt).getTime() - Date.now();
    if (remainingMs <= 0) return;

    cryptoWalletDoomsdayTimer = setTimeout(async () => {
        cryptoWalletDoomsdayTimer = null;

        try {
            await pool.query(
                `UPDATE crypto_wallet_state
                 SET is_permanently_locked = TRUE,
                     updated_at = NOW()
                 WHERE state_id = $1
                   AND COALESCE(is_permanently_locked, FALSE) = FALSE
                   AND doomsday_ends_at IS NOT NULL
                   AND doomsday_ends_at <= NOW()`,
                [CRYPTO_WALLET_STATE_ID]
            );
            await broadcastCryptoWalletState();
        } catch (error) {
            console.error("[debug-api] Failed to expire crypto wallet doomsday timer:", error.message);
        }
    }, remainingMs);
};

const broadcastCryptoWalletState = async () => {
    const state = await getCryptoWalletState();
    scheduleCryptoWalletDoomsdayTimer(state);
    broadcastRealtimeEvent("crypto_wallet_state", { state });
    return state;
};

const proxyWaybackRequest = async (req, res, url) => {
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
        cors(res);
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Missing url query parameter.");
        return;
    }

    let upstreamUrl;
    try {
        upstreamUrl = new URL(targetUrl);
    } catch {
        cors(res);
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Invalid url query parameter.");
        return;
    }

    try {
        const upstreamResponse = await fetch(upstreamUrl, {
            redirect: "follow",
            headers: {
                accept: req.headers.accept || "*/*",
                "user-agent": "React-XP Wayback Proxy",
            },
        });

        const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());

        cors(res);
        res.statusCode = upstreamResponse.status;
        upstreamResponse.headers.forEach((value, key) => {
            if (BLOCKED_PROXY_RESPONSE_HEADERS.has(key.toLowerCase())) return;
            res.setHeader(key, value);
        });

        res.setHeader("Content-Length", String(responseBody.byteLength));
        res.setHeader("X-React-XP-Proxy", "wayback");
        res.end(responseBody);
    } catch (err) {
        cors(res);
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(err instanceof Error ? err.message : "Failed to fetch Wayback content.");
    }
};

const prepareSchema = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            user_id TEXT PRIMARY KEY,
            first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS avatar_src TEXT
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS personal_message TEXT
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS wallpaper TEXT
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS is_taskbar_locked BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS shell_files JSONB
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS custom_files JSONB
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS custom_applications JSONB
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS has_seen_presentation_popup BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS instant_messages (
            id BIGSERIAL PRIMARY KEY,
            sender_id TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        ALTER TABLE instant_messages
        ADD COLUMN IF NOT EXISTS attachment_src TEXT
    `);
    await pool.query(`
        ALTER TABLE instant_messages
        ADD COLUMN IF NOT EXISTS attachment_name TEXT
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS crypto_wallet_state (
            state_id TEXT PRIMARY KEY,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ,
            doomsday_ends_at TIMESTAMPTZ,
            is_permanently_locked BOOLEAN NOT NULL DEFAULT FALSE,
            is_accessed BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        ALTER TABLE crypto_wallet_state
        ADD COLUMN IF NOT EXISTS doomsday_ends_at TIMESTAMPTZ
    `);
    await pool.query(`
        ALTER TABLE crypto_wallet_state
        ADD COLUMN IF NOT EXISTS is_permanently_locked BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await pool.query(`
        ALTER TABLE crypto_wallet_state
        ADD COLUMN IF NOT EXISTS is_accessed BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await pool.query(
        `INSERT INTO crypto_wallet_state (state_id)
         VALUES ($1)
         ON CONFLICT (state_id) DO NOTHING`,
        [CRYPTO_WALLET_STATE_ID]
    );
};

prepareSchema()
    .then(() => broadcastCryptoWalletState().catch((err) => {
        console.error("[debug-api] Failed to initialize crypto wallet state:", err.message);
    }))
    .catch((err) => console.error("[debug-api] Failed to prepare database schema:", err.message));

const ttsProxyApp = express();
ttsProxyApp.use("/api/tts", bonziTtsRouter);

wsServer.on("connection", (socket, req) => {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const userId = normalizeUserId(requestUrl.searchParams.get("userId"));

    if (!userId) {
        socket.close(1008, "userId is required");
        return;
    }

    attachRealtimeClient(userId, socket);
    sendRealtimeEvent(socket, "ready", { userId });
});

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    if (method === "GET" && url.pathname === "/proxy.php") {
        await proxyWaybackRequest(req, res, url);
        return;
    }

    if (url.pathname === "/api/tts" || url.pathname.startsWith("/api/tts/")) {
        ttsProxyApp(req, res);
        return;
    }

    // POST /api/profile ? save a user's public profile settings
    if (method === "POST" && url.pathname === "/api/profile") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        const hasAvatarSrc = typeof body.avatarSrc === "string";
        const hasPersonalMessage = typeof body.personalMessage === "string";
        const hasWallpaper = typeof body.wallpaper === "string";
        const hasIsTaskbarLocked = typeof body.isTaskbarLocked === "boolean";
        const hasShellFiles = isPlainObject(body.shellFiles);
        const hasCustomFiles = isPlainObject(body.customFiles);
        const hasCustomApplications = isPlainObject(body.customApplications);
        const avatarSrc = hasAvatarSrc ? body.avatarSrc.trim() : null;
        const personalMessage = hasPersonalMessage ? body.personalMessage.trim() : null;
        const wallpaper = hasWallpaper ? body.wallpaper.trim() : null;
        const isTaskbarLocked = hasIsTaskbarLocked ? body.isTaskbarLocked : null;
        const shellFiles = hasShellFiles ? body.shellFiles : null;
        const customFiles = hasCustomFiles ? body.customFiles : null;
        const customApplications = hasCustomApplications ? body.customApplications : null;

        if (!userId) {
            json(res, 400, { error: "userId required" });
            return;
        }

        if (!hasAvatarSrc && !hasPersonalMessage && !hasWallpaper && !hasIsTaskbarLocked && !hasShellFiles && !hasCustomFiles && !hasCustomApplications) {
            json(res, 400, {
                error: "Provide avatarSrc, personalMessage, wallpaper, isTaskbarLocked, shellFiles, customFiles, or customApplications.",
            });
            return;
        }

        if (hasAvatarSrc && !avatarSrc) {
            json(res, 400, { error: "avatarSrc required" });
            return;
        }

        if (avatarSrc && avatarSrc.length > MAX_AVATAR_SRC_LENGTH) {
            json(res, 400, { error: "avatarSrc is too large" });
            return;
        }

        if (personalMessage && personalMessage.length > MAX_PERSONAL_MESSAGE_LENGTH) {
            json(res, 400, { error: "personalMessage is too long" });
            return;
        }

        if (hasWallpaper && !wallpaper) {
            json(res, 400, { error: "wallpaper required" });
            return;
        }

        if (wallpaper && wallpaper.length > MAX_WALLPAPER_LENGTH) {
            json(res, 400, { error: "wallpaper is too long" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `INSERT INTO user_sessions (
                    user_id,
                    first_login_at,
                    avatar_src,
                    personal_message,
                    wallpaper,
                    is_taskbar_locked,
                    shell_files,
                    custom_files,
                    custom_applications,
                    is_admin,
                    updated_at
                 )
                 VALUES ($1, NOW(), $2, $3, $4, COALESCE($5, FALSE), $6::jsonb, $7::jsonb, $8::jsonb, FALSE, NOW())
                 ON CONFLICT (user_id) DO UPDATE
                     SET avatar_src = CASE
                             WHEN user_sessions.is_admin THEN $9
                             ELSE COALESCE(EXCLUDED.avatar_src, user_sessions.avatar_src)
                         END,
                         personal_message = COALESCE(EXCLUDED.personal_message, user_sessions.personal_message),
                         wallpaper = COALESCE(EXCLUDED.wallpaper, user_sessions.wallpaper),
                         is_taskbar_locked = COALESCE($5, user_sessions.is_taskbar_locked),
                         shell_files = COALESCE(EXCLUDED.shell_files, user_sessions.shell_files),
                         custom_files = COALESCE(EXCLUDED.custom_files, user_sessions.custom_files),
                         custom_applications = COALESCE(EXCLUDED.custom_applications, user_sessions.custom_applications),
                         updated_at = NOW()
                 RETURNING
                    user_id,
                    first_login_at,
                    avatar_src,
                    personal_message,
                    wallpaper,
                    is_taskbar_locked,
                    shell_files,
                    custom_files,
                    custom_applications,
                    is_admin,
                    has_seen_presentation_popup,
                    updated_at`,
                [
                    userId,
                    avatarSrc,
                    personalMessage,
                    wallpaper,
                    isTaskbarLocked,
                    shellFiles ? JSON.stringify(shellFiles) : null,
                    customFiles ? JSON.stringify(customFiles) : null,
                    customApplications ? JSON.stringify(customApplications) : null,
                    ADMIN_AVATAR_SRC,
                ]
            );
            json(res, 200, mapUserSessionRow(rows[0]));
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/sessions/active ? list recent user sessions for messenger
    if (method === "GET" && url.pathname === "/api/sessions/active") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

        try {
            const { rows } = await pool.query(
                `SELECT
                    us.user_id,
                    us.avatar_src,
                    us.is_admin,
                    us.has_seen_presentation_popup,
                    us.personal_message,
                    us.first_login_at,
                    us.updated_at
                 FROM user_sessions us
                 ORDER BY us.updated_at DESC, us.first_login_at DESC
                 LIMIT $1`,
                [limit]
            );
            json(res, 200, {
                sessions: rows.map((row) => ({
                    ...row,
                    avatar_src: row.is_admin ? ADMIN_AVATAR_SRC : row.avatar_src,
                })),
            });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/messages/thread?userId=<id>&peerId=<id> ? fetch a direct-message thread
    if (method === "GET" && url.pathname === "/api/messages/thread") {
        const userId = (url.searchParams.get("userId") || "").trim();
        const peerId = (url.searchParams.get("peerId") || "").trim();
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);

        if (!userId || !peerId) {
            json(res, 400, { error: "userId and peerId are required" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `SELECT id, sender_id, recipient_id, body, attachment_src, attachment_name, created_at
                 FROM instant_messages
                 WHERE (sender_id = $1 AND recipient_id = $2)
                    OR (sender_id = $2 AND recipient_id = $1)
                 ORDER BY created_at ASC
                 LIMIT $3`,
                [userId, peerId, limit]
            );
            json(res, 200, { messages: rows });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/crypto-wallet/state ? fetch the shared wallet lockout state
    if (method === "GET" && url.pathname === "/api/crypto-wallet/state") {
        try {
            const state = await getCryptoWalletState();
            scheduleCryptoWalletDoomsdayTimer(state);
            json(res, 200, state);
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/crypto-wallet/doomsday ? start/reset the shared vault doomsday timer
    if (method === "POST" && url.pathname === "/api/crypto-wallet/doomsday") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
        const minutes = Number(body.minutes);

        try {
            if (action === "stop") {
                await pool.query(
                    `UPDATE crypto_wallet_state
                     SET doomsday_ends_at = NULL,
                         is_accessed = TRUE,
                         updated_at = NOW()
                     WHERE state_id = $1`,
                    [CRYPTO_WALLET_STATE_ID]
                );
                const state = await broadcastCryptoWalletState();
                json(res, 200, { success: true, state });
                return;
            }

            const adminUserId = await assertAdminUser(body.userId, res);
            if (!adminUserId) return;

            if (action === "reset") {
                await pool.query(
                    `UPDATE crypto_wallet_state
                     SET failed_attempts = 0,
                         locked_until = NULL,
                         doomsday_ends_at = NULL,
                         is_permanently_locked = FALSE,
                         is_accessed = FALSE,
                         updated_at = NOW()
                     WHERE state_id = $1`,
                    [CRYPTO_WALLET_STATE_ID]
                );

                const state = await broadcastCryptoWalletState();
                json(res, 200, { success: true, state });
                return;
            }

            if (action === "start") {
                if (!Number.isFinite(minutes) || minutes <= 0 || minutes > CRYPTO_WALLET_MAX_DOOMSDAY_MINUTES) {
                    json(res, 400, {
                        error: `minutes must be between 1 and ${CRYPTO_WALLET_MAX_DOOMSDAY_MINUTES}`,
                    });
                    return;
                }

                const currentState = await getCryptoWalletState();
                if (currentState.isPermanentlyLocked) {
                    json(res, 423, {
                        error: "Coin Vault permanently locked",
                        state: currentState,
                    });
                    return;
                }

                const doomsdayEndsAt = new Date(Date.now() + Math.round(minutes) * 60 * 1000).toISOString();
                await pool.query(
                    `UPDATE crypto_wallet_state
                     SET doomsday_ends_at = $2,
                         updated_at = NOW()
                     WHERE state_id = $1`,
                    [CRYPTO_WALLET_STATE_ID, doomsdayEndsAt]
                );

                const state = await broadcastCryptoWalletState();
                json(res, 200, { success: true, state });
                return;
            }

            json(res, 400, { error: "action must be start, stop, or reset" });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/admin/nuke ? clear all persisted user data and force connected clients to reset
    if (method === "POST" && url.pathname === "/api/admin/nuke") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            const adminUserId = await assertAdminUser(body.userId, res, client);
            if (!adminUserId) {
                await client.query("ROLLBACK").catch(() => {});
                return;
            }

            await client.query("TRUNCATE TABLE instant_messages RESTART IDENTITY");
            await client.query("TRUNCATE TABLE user_sessions");
            await client.query(
                `DELETE FROM crypto_wallet_state
                 WHERE state_id = $1`,
                [CRYPTO_WALLET_STATE_ID]
            );
            await client.query(
                `INSERT INTO crypto_wallet_state (state_id, failed_attempts, locked_until, doomsday_ends_at, is_permanently_locked, updated_at)
                 VALUES ($1, 0, NULL, NULL, FALSE, NOW())`,
                [CRYPTO_WALLET_STATE_ID]
            );
            await client.query("COMMIT");

            await broadcastCryptoWalletState();
            broadcastRealtimeEvent("system_reset", { reason: "nuke" });
            json(res, 200, { success: true });
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            json(res, 500, { error: err.message });
        } finally {
            client.release();
        }
        return;
    }

    // POST /api/admin/presentation-popup ? admin-only auth/checkpoint for the presentation join popup
    if (method === "POST" && url.pathname === "/api/admin/presentation-popup") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        try {
            const adminUserId = await assertAdminUser(body.userId, res);
            if (!adminUserId) return;

            if (body.markSeen === true) {
                await pool.query(
                    `UPDATE user_sessions
                     SET has_seen_presentation_popup = TRUE,
                         updated_at = NOW()
                     WHERE user_id = $1
                       AND COALESCE(is_admin, FALSE) = TRUE`,
                    [adminUserId]
                );
            }

            json(res, 200, { success: true });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/crypto-wallet/unlock ? attempt wallet access
    if (method === "POST" && url.pathname === "/api/crypto-wallet/unlock") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!username || !password) {
            json(res, 400, { error: "username and password are required" });
            return;
        }

        try {
            const state = await getCryptoWalletState();
            if (state.isPermanentlyLocked) {
                json(res, 423, {
                    error: "Coin Vault permanently locked",
                    state,
                });
                return;
            }

            if (state.isLocked) {
                json(res, 423, {
                    error: "Wallet temporarily locked",
                    state,
                });
                return;
            }

            if (username === CRYPTO_WALLET_USERNAME && password === CRYPTO_WALLET_PASSWORD) {
                await pool.query(
                    `UPDATE crypto_wallet_state
                     SET failed_attempts = 0,
                         locked_until = NULL,
                         updated_at = NOW()
                     WHERE state_id = $1`,
                    [CRYPTO_WALLET_STATE_ID]
                );

                const nextState = await broadcastCryptoWalletState();
                json(res, 200, {
                    success: true,
                    balanceUsd: CRYPTO_WALLET_BALANCE_USD,
                    state: nextState,
                });
                return;
            }

            const nextFailedAttempts = state.failedAttempts + 1;
            const nextLockedUntil = nextFailedAttempts >= CRYPTO_WALLET_MAX_ATTEMPTS
                ? new Date(Date.now() + CRYPTO_WALLET_LOCKOUT_MS).toISOString()
                : null;

            await pool.query(
                `UPDATE crypto_wallet_state
                 SET failed_attempts = $2,
                     locked_until = $3,
                     updated_at = NOW()
                 WHERE state_id = $1`,
                [CRYPTO_WALLET_STATE_ID, Math.min(nextFailedAttempts, CRYPTO_WALLET_MAX_ATTEMPTS), nextLockedUntil]
            );

            const nextState = await broadcastCryptoWalletState();
            json(res, nextState.isLocked ? 423 : 401, {
                error: nextState.isLocked ? "Wallet temporarily locked" : "Invalid wallet credentials",
                state: nextState,
            });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/messages/incoming?userId=<id>&afterId=<id> ? fetch recent incoming DMs for notifications
    if (method === "GET" && url.pathname === "/api/messages/incoming") {
        const userId = (url.searchParams.get("userId") || "").trim();
        const afterId = Math.max(Number(url.searchParams.get("afterId")) || 0, 0);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

        if (!userId) {
            json(res, 400, { error: "userId is required" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `SELECT
                    im.id,
                    im.sender_id,
                    im.recipient_id,
                    im.body,
                    im.attachment_src,
                    im.attachment_name,
                    im.created_at,
                    us.avatar_src AS sender_avatar_src
                 FROM instant_messages im
                 LEFT JOIN user_sessions us ON us.user_id = im.sender_id
                 WHERE im.recipient_id = $1
                   AND im.sender_id <> $1
                   AND im.id > $2
                 ORDER BY im.id ASC
                 LIMIT $3`,
                [userId, afterId, limit]
            );
            json(res, 200, { messages: rows });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/messages ? persist a direct message between two users
    if (method === "POST" && url.pathname === "/api/messages") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const senderId = typeof body.senderId === "string" ? body.senderId.trim() : "";
        const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
        const messageBody = typeof body.body === "string" ? body.body.trim() : "";
        const attachmentSrc = typeof body.attachmentSrc === "string" ? body.attachmentSrc.trim() : "";
        const attachmentName = typeof body.attachmentName === "string" ? body.attachmentName.trim() : "";

        if (!senderId || !recipientId || (!messageBody && !attachmentSrc)) {
            json(res, 400, { error: "senderId, recipientId, and either body or attachmentSrc are required" });
            return;
        }

        if (messageBody.length > 2000) {
            json(res, 400, { error: "Message is too long" });
            return;
        }

        if (attachmentSrc.length > MAX_ATTACHMENT_SRC_LENGTH) {
            json(res, 400, { error: "Attachment is too large" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `INSERT INTO instant_messages (sender_id, recipient_id, body, attachment_src, attachment_name)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, sender_id, recipient_id, body, attachment_src, attachment_name, created_at`,
                [senderId, recipientId, messageBody, attachmentSrc || null, attachmentName || null]
            );

            await pool.query(
                `INSERT INTO user_sessions (user_id, first_login_at, updated_at)
                 VALUES ($1, NOW(), NOW())
                 ON CONFLICT (user_id) DO UPDATE
                     SET updated_at = NOW(),
                         avatar_src = CASE
                             WHEN user_sessions.is_admin THEN $2
                             ELSE user_sessions.avatar_src
                         END`,
                [senderId, ADMIN_AVATAR_SRC]
            );

            const senderProfileResult = await pool.query(
                "SELECT avatar_src, is_admin FROM user_sessions WHERE user_id = $1",
                [senderId]
            );
            const senderAvatarSrc = senderProfileResult.rows[0]?.is_admin
                ? ADMIN_AVATAR_SRC
                : (senderProfileResult.rows[0]?.avatar_src || null);

            sendRealtimeEventToUser(recipientId, "message_created", {
                message: {
                    ...rows[0],
                    sender_avatar_src: senderAvatarSrc,
                },
            });

            json(res, 200, { message: rows[0] });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/session/start — get-or-create the user's first login timestamp
    if (method === "POST" && url.pathname === "/api/session/start") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const { userId } = body;
        if (!userId) {
            json(res, 400, { error: "userId required" });
            return;
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query("LOCK TABLE user_sessions IN ACCESS EXCLUSIVE MODE");

            const normalizedUserId = normalizeUserId(userId);
            const existingAdminUserId = await getAdminUserId(client);
            const shouldBeAdmin = !existingAdminUserId || existingAdminUserId === normalizedUserId;
            const avatarSrc = shouldBeAdmin ? ADMIN_AVATAR_SRC : null;

            const { rows } = await client.query(
                `INSERT INTO user_sessions (user_id, first_login_at, avatar_src, is_admin, updated_at)
                 VALUES ($1, NOW(), $2, $3, NOW())
                 ON CONFLICT (user_id) DO UPDATE
                     SET first_login_at = user_sessions.first_login_at,
                         avatar_src = CASE
                             WHEN user_sessions.is_admin OR EXCLUDED.is_admin THEN $2
                             ELSE user_sessions.avatar_src
                         END,
                         is_admin = CASE
                             WHEN user_sessions.is_admin THEN TRUE
                             ELSE $3
                         END,
                         updated_at = NOW()
                 RETURNING
                    user_id,
                    first_login_at,
                    avatar_src,
                    personal_message,
                    wallpaper,
                    is_taskbar_locked,
                    shell_files,
                    custom_files,
                    custom_applications,
                    is_admin,
                    has_seen_presentation_popup,
                    updated_at`,
                [normalizedUserId, avatarSrc, shouldBeAdmin]
            );
            await client.query("COMMIT");
            json(res, 200, mapUserSessionRow(rows[0]));
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            json(res, 500, { error: err.message });
        } finally {
            client.release();
        }
        return;
    }

    // GET /api/profile/:userId ? fetch saved profile settings
    if (method === "GET" && url.pathname.startsWith("/api/profile/")) {
        const userId = decodeURIComponent(url.pathname.slice("/api/profile/".length));
        if (!userId) {
            json(res, 400, { error: "userId required" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `SELECT
                    user_id,
                    avatar_src,
                    personal_message,
                    wallpaper,
                    is_taskbar_locked,
                    shell_files,
                    custom_files,
                    custom_applications,
                    is_admin,
                    has_seen_presentation_popup,
                    first_login_at,
                    updated_at
                 FROM user_sessions
                 WHERE user_id = $1`,
                [userId]
            );
            if (rows.length === 0) {
                json(res, 404, { error: "Profile not found" });
                return;
            }

            json(res, 200, mapUserSessionRow(rows[0]));
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/session/:userId — fetch existing session start time
    if (method === "GET" && url.pathname.startsWith("/api/session/")) {
        const userId = decodeURIComponent(url.pathname.slice("/api/session/".length));
        if (!userId) {
            json(res, 400, { error: "userId required" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `SELECT
                    user_id,
                    first_login_at,
                    avatar_src,
                    personal_message,
                    wallpaper,
                    is_taskbar_locked,
                    shell_files,
                    custom_files,
                    is_admin,
                    has_seen_presentation_popup,
                    custom_applications,
                    updated_at
                 FROM user_sessions
                 WHERE user_id = $1`,
                [userId]
            );
            if (rows.length === 0) {
                json(res, 404, { error: "Session not found" });
                return;
            }
            json(res, 200, mapUserSessionRow(rows[0]));
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    if (await serveFrontendRoute(req, res, url)) {
        return;
    }

    json(res, 404, { error: "Not found" });
});

server.on("upgrade", (req, socket, head) => {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    if (requestUrl.pathname !== "/ws/messenger") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
    }

    const userId = normalizeUserId(requestUrl.searchParams.get("userId"));
    if (!userId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
    }

    wsServer.handleUpgrade(req, socket, head, (upgradedSocket) => {
        wsServer.emit("connection", upgradedSocket, req);
    });
});

server.listen(PORT, () => {
    console.log(`[debug-api] Listening on http://localhost:${PORT}`);
    console.log(`[debug-api] DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "NOT SET — DB queries will fail"}`);
});
