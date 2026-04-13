import http from "http";
import { Pool } from "pg";

const PORT = 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MAX_AVATAR_SRC_LENGTH = 250000;
const BLOCKED_PROXY_RESPONSE_HEADERS = new Set([
    "content-encoding",
    "content-length",
    "content-security-policy",
    "content-security-policy-report-only",
    "transfer-encoding",
    "x-frame-options",
]);

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

const proxyWaybackRequest = async (req, res, url) => {
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
        cors(res);
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Missing url query parameter.");
        return;
    }

    if (method === "GET" && url.pathname === "/proxy.php") {
        await proxyWaybackRequest(req, res, url);
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

// Ensure user_sessions table exists on startup
Promise.all([
    pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            user_id TEXT PRIMARY KEY,
            first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `),
    pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS avatar_src TEXT
    `),
    pool.query(`
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `),
]).catch((err) => console.error("[debug-api] Failed to prepare user_sessions table:", err.message));

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    // GET /api/debug/rules — all seeded point rules
    if (method === "GET" && url.pathname === "/api/debug/rules") {
        try {
            const { rows } = await pool.query(
                "SELECT id, label, description, category, points, metadata FROM point_rules ORDER BY category, label"
            );
            json(res, 200, { rules: rows });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/debug/points?userId=<id> — totals + recent events for a user
    if (method === "GET" && url.pathname === "/api/debug/points") {
        const userId = url.searchParams.get("userId");
        if (!userId) {
            json(res, 400, { error: "userId query param required" });
            return;
        }

        try {
            const [totalsResult, eventsResult] = await Promise.all([
                pool.query(
                    "SELECT lifetime_points, last_award_at, updated_at FROM user_point_totals WHERE user_id = $1",
                    [userId]
                ),
                pool.query(
                    `SELECT pe.rule_id, pr.label, pe.points, pe.awarded_at, pe.metadata
                     FROM point_events pe
                     LEFT JOIN point_rules pr ON pr.id = pe.rule_id
                     WHERE pe.user_id = $1
                     ORDER BY pe.awarded_at DESC
                     LIMIT 20`,
                    [userId]
                ),
            ]);

            const totals = totalsResult.rows[0] ?? null;
            json(res, 200, {
                userId,
                totals,
                recentEvents: eventsResult.rows,
            });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/points/events — record a client-awarded point event
    if (method === "POST" && url.pathname === "/api/points/events") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const { userId, clientId, ruleId, points, awardedAt, metadata } = body;
        if (!userId || !clientId || !ruleId || points == null) {
            json(res, 400, { error: "Missing required fields: userId, clientId, ruleId, points" });
            return;
        }

        try {
            await pool.query(
                `INSERT INTO point_events (user_id, client_id, rule_id, points, awarded_at, metadata)
                 VALUES ($1, $2::uuid, $3, $4, $5, $6)
                 ON CONFLICT (user_id, client_id) DO NOTHING`,
                [userId, clientId, ruleId, points, awardedAt ?? new Date().toISOString(), metadata ?? {}]
            );
            json(res, 200, { ok: true });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/profile ? save a user's avatar settings
    if (method === "POST" && url.pathname === "/api/profile") {
        let body;
        try {
            body = await readBody(req);
        } catch {
            json(res, 400, { error: "Invalid JSON body" });
            return;
        }

        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        const avatarSrc = typeof body.avatarSrc === "string" ? body.avatarSrc.trim() : "";

        if (!userId) {
            json(res, 400, { error: "userId required" });
            return;
        }

        if (!avatarSrc) {
            json(res, 400, { error: "avatarSrc required" });
            return;
        }

        if (avatarSrc.length > MAX_AVATAR_SRC_LENGTH) {
            json(res, 400, { error: "avatarSrc is too large" });
            return;
        }

        try {
            const { rows } = await pool.query(
                `INSERT INTO user_sessions (user_id, first_login_at, avatar_src, updated_at)
                 VALUES ($1, NOW(), $2, NOW())
                 ON CONFLICT (user_id) DO UPDATE
                     SET avatar_src = EXCLUDED.avatar_src,
                         updated_at = NOW()
                 RETURNING user_id, first_login_at, avatar_src, updated_at`,
                [userId, avatarSrc]
            );
            json(res, 200, {
                userId: rows[0].user_id,
                firstLoginAt: rows[0].first_login_at,
                avatarSrc: rows[0].avatar_src,
                updatedAt: rows[0].updated_at,
            });
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

        try {
            // No-op update on conflict so RETURNING always fires
            const { rows } = await pool.query(
                `INSERT INTO user_sessions (user_id, first_login_at)
                 VALUES ($1, NOW())
                 ON CONFLICT (user_id) DO UPDATE
                     SET first_login_at = user_sessions.first_login_at
                 RETURNING user_id, first_login_at, avatar_src`,
                [userId]
            );
            json(res, 200, { userId: rows[0].user_id, firstLoginAt: rows[0].first_login_at, avatarSrc: rows[0].avatar_src });
        } catch (err) {
            json(res, 500, { error: err.message });
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
                "SELECT user_id, avatar_src, first_login_at, updated_at FROM user_sessions WHERE user_id = $1",
                [userId]
            );
            if (rows.length === 0) {
                json(res, 404, { error: "Profile not found" });
                return;
            }

            json(res, 200, {
                userId: rows[0].user_id,
                avatarSrc: rows[0].avatar_src,
                firstLoginAt: rows[0].first_login_at,
                updatedAt: rows[0].updated_at,
            });
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
                "SELECT first_login_at, avatar_src FROM user_sessions WHERE user_id = $1",
                [userId]
            );
            if (rows.length === 0) {
                json(res, 404, { error: "Session not found" });
                return;
            }
            json(res, 200, { userId, firstLoginAt: rows[0].first_login_at, avatarSrc: rows[0].avatar_src });
        } catch (err) {
            json(res, 500, { error: err.message });
        }
        return;
    }

    json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`[debug-api] Listening on http://localhost:${PORT}`);
    console.log(`[debug-api] DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "NOT SET — DB queries will fail"}`);
});
