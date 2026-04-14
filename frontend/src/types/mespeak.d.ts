declare module "mespeak" {
    const meSpeak: {
        isConfigLoaded: () => boolean;
        isVoiceLoaded: (voiceId?: string) => boolean;
        loadConfig: (config: Record<string, unknown>) => void;
        loadVoice: (voice: Record<string, unknown>) => void;
        stop: () => void;
        speak: (text: string, options?: Record<string, number | string>) => void;
    };

    export default meSpeak;
}

declare module "mespeak/src/mespeak_config.json" {
    const config: Record<string, unknown>;
    export default config;
}

declare module "mespeak/voices/en/en-us.json" {
    const voice: Record<string, unknown>;
    export default voice;
}
