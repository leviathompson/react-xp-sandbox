import { useEffect, useState } from "react";
import { useContext } from "../../context/context";

const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const Stopwatch = () => {
    const { username, currentTime } = useContext();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!username) {
            setElapsed(0);
            return;
        }

        const startTime = currentTime instanceof Date ? currentTime.getTime() : new Date(currentTime).getTime();
        if (Number.isNaN(startTime)) {
            setElapsed(0);
            return;
        }

        const updateElapsed = () => {
            setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
        };

        updateElapsed();
        const id = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(id);
    }, [username, currentTime]);

    return (
        <span className="whitespace-nowrap tabular-nums">
            {formatElapsed(elapsed)}
        </span>
    );
};
