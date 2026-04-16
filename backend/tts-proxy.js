import express from "express";

const router = express.Router();

const MAX_TEXT_LENGTH = 300;
const MAX_CACHE_SIZE = 100;
const UPSTREAM_URL = "https://tetyys.com/SAPI4/SAPI4";
const VOICE_NAME = "Adult Male #2, American English (TruVoice)";
const VOICE_PITCH = "140";
const VOICE_SPEED = "150";
const REQUEST_TIMEOUT_MS = 5000;

const audioCache = new Map();

const setCors = (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const setAudioHeaders = (res, size, cacheStatus) => {
    setCors(res);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(size));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Cache", cacheStatus);
};

const setJsonHeaders = (res, cacheStatus = "MISS") => {
    setCors(res);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Cache", cacheStatus);
};

const getCachedAudio = (key) => audioCache.get(key) || null;

const setCachedAudio = (key, buffer) => {
    if (audioCache.has(key)) {
        audioCache.delete(key);
    }

    audioCache.set(key, buffer);

    if (audioCache.size <= MAX_CACHE_SIZE) {
        return;
    }

    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) {
        audioCache.delete(oldestKey);
    }
};

router.get("/bonzi", async (req, res) => {
    const rawText = typeof req.query.text === "string" ? req.query.text : "";
    const text = rawText.trim();

    if (!text) {
        setJsonHeaders(res);
        res.status(400).json({ error: "text parameter is required" });
        return;
    }

    const truncatedText = text.slice(0, MAX_TEXT_LENGTH);
    const cachedAudio = getCachedAudio(truncatedText);
    if (cachedAudio) {
        setAudioHeaders(res, cachedAudio.byteLength, "HIT");
        res.status(200).end(cachedAudio);
        return;
    }

    const upstream = new URL(UPSTREAM_URL);
    upstream.searchParams.set("text", truncatedText);
    upstream.searchParams.set("voice", VOICE_NAME);
    upstream.searchParams.set("pitch", VOICE_PITCH);
    upstream.searchParams.set("speed", VOICE_SPEED);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(upstream, {
            signal: controller.signal,
            headers: {
                accept: "audio/wav,*/*",
            },
        });

        if (!response.ok) {
            setJsonHeaders(res);
            res.status(502).json({ error: "TTS upstream error", status: response.status });
            return;
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        setCachedAudio(truncatedText, audioBuffer);
        setAudioHeaders(res, audioBuffer.byteLength, "MISS");
        res.status(200).end(audioBuffer);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            setJsonHeaders(res);
            res.status(504).json({ error: "TTS upstream timeout" });
            return;
        }

        setJsonHeaders(res);
        res.status(502).json({ error: "TTS upstream error", status: 502 });
    } finally {
        clearTimeout(timeout);
    }
});

export default router;
