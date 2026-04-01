import { useEffect, useRef, useState } from "react";
import { useContext } from "../../context/context";

const STORAGE_PREFIX = "xp_session_start_";

const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const Stopwatch = () => {
    const { username } = useContext();
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const initRef = useRef(false);

    useEffect(() => {
        if (!username || initRef.current) return;
        initRef.current = true;

        const localKey = `${STORAGE_PREFIX}${username}`;

        const init = async () => {
            try {
                const res = await fetch("/api/session/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: username }),
                    signal: AbortSignal.timeout(4000),
                });
                if (res.ok) {
                    const data = await res.json();
                    const t = new Date(data.firstLoginAt).getTime();
                    localStorage.setItem(localKey, String(t));
                    setStartTime(t);
                    return;
                }
            } catch { /* offline */ }

            // Offline fallback — use what we stored last time
            const stored = localStorage.getItem(localKey);
            if (stored) {
                setStartTime(Number(stored));
                return;
            }

            // First visit while offline — start from now
            const now = Date.now();
            localStorage.setItem(localKey, String(now));
            setStartTime(now);
        };

        init();
    }, [username]);

    useEffect(() => {
        if (startTime === null) return;

        setElapsed(Math.floor((Date.now() - startTime) / 1000));

        const id = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(id);
    }, [startTime]);

    return (
        <span className="whitespace-nowrap tabular-nums">
            {formatElapsed(elapsed)}
        </span>
    );
};
