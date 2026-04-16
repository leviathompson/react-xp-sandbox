import applicationsJSON from "../data/applications.json";
import type { Application } from "../context/types";

type BonziSpeechState = {
    isSpeaking: boolean;
    currentSentence: string;
};

const BONZI_GREETING_COOLDOWN_MS = 1200;
const BONZI_GREETING_TEXT = "Well! Hello there! I don't believe we've been properly introduced. I'm Bonzi!";
const BONZI_TTS_MAX_CHARS = 280;
const applications = applicationsJSON as unknown as Record<string, Application>;

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeRequest: AbortController | null = null;
let activeSpeechToken = 0;
let lastBonziGreetingAt = 0;
let speechState: BonziSpeechState = {
    isSpeaking: false,
    currentSentence: "",
};

const listeners = new Set<(state: BonziSpeechState) => void>();

const emitSpeechState = () => {
    listeners.forEach((listener) => listener(speechState));
};

const setSpeechState = (nextState: BonziSpeechState) => {
    speechState = nextState;
    emitSpeechState();
};

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

const resetSpeech = () => {
    activeRequest?.abort();
    activeRequest = null;
    cleanupActiveAudio();
    setSpeechState({
        isSpeaking: false,
        currentSentence: "",
    });
};

const splitLongSentence = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return [text];

    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = "";

    words.forEach((word) => {
        const nextChunk = currentChunk ? `${currentChunk} ${word}` : word;
        if (nextChunk.length <= maxLength) {
            currentChunk = nextChunk;
            return;
        }

        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
    });

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
};

const splitBonziSpeech = (text: string) => {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    if (!normalizedText) return [];

    return normalizedText
        .split(/(?<=[.!?])\s+/)
        .flatMap((sentence) => splitLongSentence(sentence.trim(), BONZI_TTS_MAX_CHARS))
        .filter(Boolean);
};

const playBonziSentence = async (sentence: string, token: number) => {
    cleanupActiveAudio();
    activeRequest?.abort();
    activeRequest = new AbortController();

    const response = await fetch(`/api/tts/bonzi?text=${encodeURIComponent(sentence)}`, {
        signal: activeRequest.signal,
    });

    if (!response.ok) {
        throw new Error(`Bonzi TTS request failed with status ${response.status}`);
    }

    const audioBlob = await response.blob();
    if (activeRequest.signal.aborted || token !== activeSpeechToken) return;

    activeAudioUrl = URL.createObjectURL(audioBlob);
    activeAudio = new Audio(activeAudioUrl);
    setSpeechState({
        isSpeaking: true,
        currentSentence: sentence,
    });

    await new Promise<void>((resolve, reject) => {
        if (!activeAudio) {
            resolve();
            return;
        }

        activeAudio.addEventListener("ended", () => {
            cleanupActiveAudio();
            resolve();
        }, { once: true });

        activeAudio.addEventListener("error", () => {
            cleanupActiveAudio();
            reject(new Error("Bonzi audio playback failed."));
        }, { once: true });

        void activeAudio.play().catch(reject);
    });
};

export const subscribeToBonziSpeech = (listener: (state: BonziSpeechState) => void) => {
    listeners.add(listener);
    listener(speechState);
    return () => {
        listeners.delete(listener);
    };
};

export const stopBonziSpeech = () => {
    activeSpeechToken += 1;
    resetSpeech();
};

export const speakBonziText = async (text: string) => {
    const sentences = splitBonziSpeech(text);
    if (!sentences.length) return;

    activeSpeechToken += 1;
    const token = activeSpeechToken;
    resetSpeech();

    try {
        for (const sentence of sentences) {
            if (token !== activeSpeechToken) return;
            await playBonziSentence(sentence, token);
        }
    } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("[bonzi] Unable to play Bonzi Buddy speech.", error);
        }
    } finally {
        if (token === activeSpeechToken) {
            activeRequest = null;
            cleanupActiveAudio();
            setSpeechState({
                isSpeaking: false,
                currentSentence: "",
            });
        }
    }
};

export const speakBonziGreeting = async () => {
    const now = Date.now();
    if (now - lastBonziGreetingAt < BONZI_GREETING_COOLDOWN_MS) return;
    lastBonziGreetingAt = now;
    await speakBonziText(BONZI_GREETING_TEXT);
};

export const getReadmeSpeechText = () => {
    const readmeTextarea = document.querySelector<HTMLTextAreaElement>('textarea[data-notepad-app-id="readme"]');
    if (readmeTextarea?.value.trim()) {
        return readmeTextarea.value;
    }

    return String(applications.readme?.content || "");
};

export type { BonziSpeechState };
