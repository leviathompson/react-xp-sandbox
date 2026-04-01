import { useCallback, useEffect, useRef, useState } from "react";
import { useContext } from "../../context/context";
import { usePoints } from "../../context/points";
import type { PointRule } from "../../data/pointRules";

type DbTotals = {
    lifetime_points: number;
    last_award_at: string | null;
    updated_at: string;
} | null;

type DbEvent = {
    rule_id: string;
    label: string;
    points: number;
    awarded_at: string;
};

type DbState = {
    status: "idle" | "loading" | "ok" | "error" | "offline";
    totals: DbTotals;
    recentEvents: DbEvent[];
    error?: string;
    fetchedAt?: number;
};

const fmt = (ts: number | string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const relTime = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
};

const PANEL_WIDTH = 600;

export const DebugPanel = () => {
    const [visible, setVisible] = useState(false);
    const [dbState, setDbState] = useState<DbState>({ status: "idle", totals: null, recentEvents: [] });
    const { username } = useContext();
    const { sessionPoints, lifetimePoints, awards, recentAwards, rules, pendingSyncCount } = usePoints();
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchDb = useCallback(async () => {
        if (!username.trim()) {
            setDbState((s) => ({ ...s, status: "error", error: "No username set" }));
            return;
        }

        setDbState((s) => ({ ...s, status: "loading" }));
        try {
            const res = await fetch(`/api/debug/points?userId=${encodeURIComponent(username.trim())}`, {
                signal: AbortSignal.timeout(4000),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setDbState({ status: "error", totals: null, recentEvents: [], error: body.error ?? `HTTP ${res.status}`, fetchedAt: Date.now() });
                return;
            }
            const data = await res.json();
            setDbState({ status: "ok", totals: data.totals, recentEvents: data.recentEvents, fetchedAt: Date.now() });
        } catch {
            setDbState({ status: "offline", totals: null, recentEvents: [], error: "Backend unreachable", fetchedAt: Date.now() });
        }
    }, [username]);

    // Toggle on Ctrl+Shift+D
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "D") {
                e.preventDefault();
                setVisible((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Auto-poll every 10s while open
    useEffect(() => {
        if (!visible) {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }
        fetchDb();
        pollRef.current = setInterval(fetchDb, 10_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [visible, fetchDb]);

    if (!visible) return null;

    const dbLifetime = dbState.totals?.lifetime_points ?? null;
    const delta = dbLifetime !== null ? lifetimePoints - dbLifetime : null;

    // Build per-rule breakdown
    const ruleBreakdown = rules.map((rule: PointRule) => {
        const localLifetimeCount = awards.filter((a) => a.ruleId === rule.id).length;
        const localSessionCount = recentAwards.filter((a) => a.ruleId === rule.id).length;
        const dbCount = dbState.recentEvents.filter((e) => e.rule_id === rule.id).length;
        return { rule, localLifetimeCount, localSessionCount, dbCount };
    }).filter((r) => r.localLifetimeCount > 0 || r.dbCount > 0);

    const statusColor: Record<string, string> = {
        idle: "#888",
        loading: "#f5c518",
        ok: "#4caf50",
        error: "#f44336",
        offline: "#f44336",
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: PANEL_WIDTH,
            height: "100vh",
            background: "#0d1117",
            color: "#e6edf3",
            fontFamily: "monospace",
            fontSize: "12px",
            overflowY: "auto",
            zIndex: 9999,
            borderLeft: "2px solid #30363d",
            display: "flex",
            flexDirection: "column",
        }}>
            {/* Header */}
            <div style={{ padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1 }}>
                <span style={{ fontWeight: "bold", fontSize: "13px" }}>
                    Points Debug
                    <span style={{ marginLeft: 8, color: "#888", fontWeight: "normal" }}>user: <span style={{ color: "#58a6ff" }}>{username || "(none)"}</span></span>
                {pendingSyncCount > 0 && (
                    <span style={{ marginLeft: 8, background: "#f5c518", color: "#0d1117", borderRadius: 3, padding: "1px 5px", fontSize: "10px", fontWeight: "bold" }}>
                        {pendingSyncCount} unsynced
                    </span>
                )}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: statusColor[dbState.status], fontSize: "11px" }}>
                        ● {dbState.status === "ok" ? `db ok${dbState.fetchedAt ? ` · ${relTime(dbState.fetchedAt)}` : ""}` : dbState.error ?? dbState.status}
                    </span>
                    <button onClick={fetchDb} style={{ background: "#21262d", border: "1px solid #30363d", color: "#e6edf3", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: "11px" }}>↻ refresh</button>
                    <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}>✕</button>
                </div>
            </div>

            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Score comparison */}
                <Section title="Score">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ color: "#8b949e", textAlign: "left" }}>
                                <th style={{ paddingBottom: 4, fontWeight: "normal" }}></th>
                                <th style={{ paddingBottom: 4, fontWeight: "normal" }}>Session</th>
                                <th style={{ paddingBottom: 4, fontWeight: "normal" }}>Lifetime (local)</th>
                                <th style={{ paddingBottom: 4, fontWeight: "normal" }}>Lifetime (DB)</th>
                                <th style={{ paddingBottom: 4, fontWeight: "normal" }}>Delta</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ color: "#8b949e" }}>pts</td>
                                <td style={{ color: "#f5c518", fontWeight: "bold" }}>{sessionPoints}</td>
                                <td style={{ color: "#58a6ff", fontWeight: "bold" }}>{lifetimePoints}</td>
                                <td style={{ color: dbState.status === "ok" ? "#58a6ff" : "#555" }}>
                                    {dbState.status === "ok" ? (dbState.totals?.lifetime_points ?? "—") : "—"}
                                </td>
                                <td style={{ color: delta === null ? "#555" : delta > 0 ? "#f5c518" : delta < 0 ? "#f44336" : "#4caf50", fontWeight: "bold" }}>
                                    {delta === null ? "—" : delta > 0 ? `+${delta} unsynced` : delta < 0 ? `${delta} drift` : "✓ in sync"}
                                </td>
                            </tr>
                            <tr style={{ color: "#8b949e" }}>
                                <td>awards</td>
                                <td>—</td>
                                <td>{awards.length}</td>
                                <td>{dbState.status === "ok" ? dbState.recentEvents.length : "—"}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                    {dbState.totals?.last_award_at && (
                        <div style={{ marginTop: 4, color: "#8b949e" }}>
                            DB last award: <span style={{ color: "#e6edf3" }}>{fmt(dbState.totals.last_award_at)}</span>
                        </div>
                    )}
                </Section>

                {/* Recent local awards */}
                <Section title={`Recent Local Awards (${recentAwards.length})`}>
                    {recentAwards.length === 0 ? (
                        <div style={{ color: "#555" }}>No awards this session yet.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                {[...recentAwards].reverse().slice(0, 10).map((a) => {
                                    const rule = rules.find((r: PointRule) => r.id === a.ruleId);
                                    return (
                                        <tr key={a.id} style={{ borderBottom: "1px solid #21262d" }}>
                                            <td style={{ padding: "3px 0", color: "#58a6ff" }}>{rule?.label ?? a.ruleId}</td>
                                            <td style={{ padding: "3px 0", textAlign: "right", color: "#4caf50", fontWeight: "bold", whiteSpace: "nowrap" }}>+{a.points} pts</td>
                                            <td style={{ padding: "3px 0", textAlign: "right", color: "#555", paddingLeft: 8, whiteSpace: "nowrap" }}>{fmt(a.timestamp)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </Section>

                {/* Recent DB events */}
                <Section title={`Recent DB Events (${dbState.recentEvents.length})`}>
                    {dbState.status === "offline" || dbState.status === "error" ? (
                        <div style={{ color: "#f44336" }}>{dbState.error ?? "Unavailable"}</div>
                    ) : dbState.status === "loading" ? (
                        <div style={{ color: "#f5c518" }}>Loading…</div>
                    ) : dbState.recentEvents.length === 0 ? (
                        <div style={{ color: "#555" }}>No DB events found for this user.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                {dbState.recentEvents.slice(0, 10).map((e, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
                                        <td style={{ padding: "3px 0", color: "#58a6ff" }}>{e.label ?? e.rule_id}</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: "#4caf50", fontWeight: "bold", whiteSpace: "nowrap" }}>+{e.points} pts</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: "#555", paddingLeft: 8, whiteSpace: "nowrap" }}>{fmt(e.awarded_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Section>

                {/* Per-rule breakdown (only rules that have been triggered) */}
                {ruleBreakdown.length > 0 && (
                    <Section title="Rule Breakdown (triggered)">
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ color: "#8b949e", textAlign: "left" }}>
                                    <th style={{ paddingBottom: 4, fontWeight: "normal" }}>Rule</th>
                                    <th style={{ paddingBottom: 4, fontWeight: "normal", textAlign: "right" }}>pts</th>
                                    <th style={{ paddingBottom: 4, fontWeight: "normal", textAlign: "right" }}>local (lifetime)</th>
                                    <th style={{ paddingBottom: 4, fontWeight: "normal", textAlign: "right" }}>DB (recent)</th>
                                    <th style={{ paddingBottom: 4, fontWeight: "normal", textAlign: "right" }}>limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ruleBreakdown.map(({ rule, localLifetimeCount, dbCount }) => (
                                    <tr key={rule.id} style={{ borderBottom: "1px solid #21262d" }}>
                                        <td style={{ padding: "3px 0", color: "#58a6ff" }}>{rule.label}</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: "#8b949e" }}>{rule.points}</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: localLifetimeCount > 0 ? "#e6edf3" : "#555" }}>{localLifetimeCount}</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: dbCount > 0 ? "#e6edf3" : "#555" }}>{dbState.status === "ok" ? dbCount : "—"}</td>
                                        <td style={{ padding: "3px 0", textAlign: "right", color: "#555" }}>
                                            {rule.limit ? `${rule.limit.maxAwards}/${rule.limit.type.replace("per", "")}` : "∞"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Section>
                )}

                {/* localStorage raw dump */}
                <Section title="localStorage State">
                    <div style={{ color: "#8b949e", lineHeight: "1.6" }}>
                        <div>lifetime: <span style={{ color: "#58a6ff" }}>{lifetimePoints} pts</span></div>
                        <div>session: <span style={{ color: "#f5c518" }}>{sessionPoints} pts</span></div>
                        <div>total awards stored: <span style={{ color: "#e6edf3" }}>{awards.length}</span></div>
                        <div>storage key: <span style={{ color: "#e6edf3" }}>xp_points_state_v1</span></div>
                    </div>
                </Section>
            </div>

            <div style={{ padding: "8px 12px", borderTop: "1px solid #21262d", color: "#555", fontSize: "11px", marginTop: "auto" }}>
                Ctrl+Shift+D to toggle · auto-refreshes every 10s when open
            </div>
        </div>
    );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
        <div style={{ color: "#8b949e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, borderBottom: "1px solid #21262d", paddingBottom: 4 }}>
            {title}
        </div>
        {children}
    </div>
);
