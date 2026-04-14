let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeRequest: AbortController | null = null;
let lastBonziGreetingAt = 0;

const BONZI_GREETING_COOLDOWN_MS = 1200;
const BONZI_GREETING_TEXT = "Well! Hello there! I don't believe we've been properly introduced. I'm Bonzi! What is your name?";

const cleanupActiveAudio = () => {
    if (activeAudio) {
        activeAudio.pause();
        activeAudio.src = "";
        activeAudio = null;
    }

    if (activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
        activeAudioUrl = null;
    }
};

export const speakBonziGreeting = async () => {
    const now = Date.now();
    if (now - lastBonziGreetingAt < BONZI_GREETING_COOLDOWN_MS) return;
    lastBonziGreetingAt = now;

    activeRequest?.abort();
    activeRequest = new AbortController();
    cleanupActiveAudio();

    try {
        const response = await fetch(`/api/tts/bonzi?text=${encodeURIComponent(BONZI_GREETING_TEXT)}`, {
            signal: activeRequest.signal,
        });

        if (!response.ok) {
            throw new Error(`Bonzi TTS request failed with status ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (activeRequest.signal.aborted) return;

        activeAudioUrl = URL.createObjectURL(audioBlob);
        activeAudio = new Audio(activeAudioUrl);
        activeAudio.addEventListener("ended", cleanupActiveAudio, { once: true });
        await activeAudio.play();
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[bonzi] Unable to play Bonzi Buddy greeting.", error);
        cleanupActiveAudio();
    } finally {
        activeRequest = null;
    }
};
