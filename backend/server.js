import http from "http";
import { Pool } from "pg";

const PORT = 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

    json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`[debug-api] Listening on http://localhost:${PORT}`);
    console.log(`[debug-api] DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "NOT SET — DB queries will fail"}`);
});
