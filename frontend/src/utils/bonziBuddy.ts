interface MeSpeakModule {
    isConfigLoaded: () => boolean;
    isVoiceLoaded: (voiceId?: string) => boolean;
    loadConfig: (config: Record<string, unknown>) => void;
    loadVoice: (voice: Record<string, unknown>) => void;
    stop: () => void;
    speak: (text: string, options?: Record<string, number | string>) => void;
}

let bonziInitPromise: Promise<MeSpeakModule> | null = null;
let lastBonziGreetingAt = 0;

const BONZI_GREETING_COOLDOWN_MS = 1200;
const BONZI_VOICE_ID = "en/en-us";

const loadBonziSpeech = async () => {
    if (!bonziInitPromise) {
        bonziInitPromise = Promise.all([
            import("mespeak"),
            import("mespeak/src/mespeak_config.json"),
            import("mespeak/voices/en/en-us.json"),
        ]).then(([meSpeakModule, configModule, voiceModule]) => {
            const meSpeak = (meSpeakModule.default || meSpeakModule) as unknown as MeSpeakModule;
            const config = (configModule.default || configModule) as Record<string, unknown>;
            const voice = (voiceModule.default || voiceModule) as Record<string, unknown>;

            if (!meSpeak.isConfigLoaded()) {
                meSpeak.loadConfig(config);
            }

            if (!meSpeak.isVoiceLoaded(BONZI_VOICE_ID)) {
                meSpeak.loadVoice(voice);
            }

            return meSpeak;
        });
    }

    return bonziInitPromise;
};

export const speakBonziGreeting = async () => {
    const now = Date.now();
    if (now - lastBonziGreetingAt < BONZI_GREETING_COOLDOWN_MS) return;
    lastBonziGreetingAt = now;

    const meSpeak = await loadBonziSpeech();
    meSpeak.stop();
    meSpeak.speak("Hello, I am Bonzi Buddy", {
        amplitude: 100,
        pitch: 58,
        speed: 155,
        voice: BONZI_VOICE_ID,
    });
};
