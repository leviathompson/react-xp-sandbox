type sounds = "startup" | "shutdown";

const AUDIO_ROOT = "/audio/";

export const loadSound = (sound: sounds) => {
    if (typeof window == "undefined") return;

    const sounds = {
        "startup": "audio__startup.wav",
        "shutdown": "audio__shutdown.wav",
    };

    return new Audio(`${AUDIO_ROOT}${sounds[sound]}`);
};

export const playLoadedSound = (audio: HTMLAudioElement | undefined, isSoundEnabled: boolean, isLoop: boolean = false) => {
    if (isSoundEnabled && audio) {
        if (isLoop) audio.loop = true;

        audio.preload = "auto";
        audio.volume = 0.2;

        audio.play().catch(console.error);
    }
};

export const stopLoadedSound = (audio: HTMLAudioElement | undefined) => {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
    }
};

const playSound = (soundName: sounds, isSoundEnabled: boolean, isloop: boolean = false) => {
    const audio = loadSound(soundName);

    if (isSoundEnabled && audio) {
        if (isloop) audio.loop = true;
        audio.volume = 0.2;
        audio.play();
    }
};

export default playSound;

const playEffectFile = (fileName: string, volume: number = 0.2) => {
    if (typeof window === "undefined") return;

    const audio = new Audio(`${AUDIO_ROOT}${fileName}`);
    audio.preload = "auto";
    audio.volume = volume;
    void audio.play().catch(console.error);
};

export const playStartMenuToggleSound = () => {
    playEffectFile("audio__Windows_XP_Start.wav", 0.22);
};

export const playRecycleSound = () => {
    playEffectFile("audio__recycle.wav", 0.24);
};

export const playIeNavigateSound = () => {
    playEffectFile("audio__Windows_Navigation_Start.wav", 0.22);
};

export const playMenuCommandSound = () => {
    playEffectFile("audio__Windows_XP_Menu_Command.wav", 0.18);
};

export const playMessengerSendSound = () => {
    playEffectFile("audio__Windows_XP_Balloon.wav", 0.24);
};

export const playSuccessChimeSound = () => {
    playEffectFile("audio__chimes.wav", 0.24);
};

export const playMessengerPopSound = () => {
    playEffectFile("audio__notify.wav", 0.25);
};

export const playWalletBuzzerSound = () => {
    playEffectFile("audio__Windows_XP_Critical_Stop.wav", 0.3);
};

export const playWalletLockdownSound = () => {
    playEffectFile("audio__nuclear_buzzer.wav", 0.3);
};

export const playWalletCelebrationSound = () => {
    playEffectFile("audio__tada.wav", 0.3);
};
