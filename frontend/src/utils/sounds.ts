type sounds = "startup" | "shutdown";

export const loadSound = (sound: sounds) => {
    if (typeof window == "undefined") return;

    const src = "/audio/";

    const sounds = {
        "startup": "audio__startup.wav",
        "shutdown": "audio__shutdown.wav",
    };

    return new Audio(`${src}${sounds[sound]}`);
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

const getAudioContext = () => {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
};

export const playMessengerPopSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.16, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.11);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(2.5, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);

    setTimeout(() => ctx.close(), 320);
};

export const playWalletBuzzerSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const pulseOffsets = [0, 0.13];
    pulseOffsets.forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime + offset);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + offset + 0.12);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.75, ctx.currentTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.13);
    });

    setTimeout(() => ctx.close(), 500);
};

export const playWalletCelebrationSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.16, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const coinOffsets = [0, 0.08, 0.18, 0.3, 0.42, 0.56];
    coinOffsets.forEach((offset, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(880 + index * 55, ctx.currentTime + offset);
        osc.frequency.exponentialRampToValueAtTime(540 + index * 35, ctx.currentTime + offset + 0.16);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.16);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.18);
    });

    const chord = [523.25, 659.25, 783.99];
    chord.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + 0.72 + index * 0.03;

        osc.type = "square";
        osc.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.48);
    });

    setTimeout(() => ctx.close(), 1600);
};

export const playWalletLockdownSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const clunkOffsets = [0, 0.22, 0.48];
    clunkOffsets.forEach((offset, index) => {
        const osc = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }

        const oscGain = ctx.createGain();
        const noiseGain = ctx.createGain();
        const lowpass = ctx.createBiquadFilter();
        const start = ctx.currentTime + offset;

        osc.type = "square";
        osc.frequency.setValueAtTime(96 - index * 8, start);
        osc.frequency.exponentialRampToValueAtTime(54 - index * 4, start + 0.16);

        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(620, start);
        lowpass.Q.setValueAtTime(0.8, start);

        oscGain.gain.setValueAtTime(0.001, start);
        oscGain.gain.exponentialRampToValueAtTime(0.95, start + 0.008);
        oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

        noise.buffer = noiseBuffer;
        noiseGain.gain.setValueAtTime(0.001, start);
        noiseGain.gain.exponentialRampToValueAtTime(0.55, start + 0.004);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

        osc.connect(lowpass);
        lowpass.connect(oscGain);
        oscGain.connect(masterGain);

        noise.connect(noiseGain);
        noiseGain.connect(lowpass);

        osc.start(start);
        osc.stop(start + 0.17);
        noise.start(start);
        noise.stop(start + 0.11);
    });

    const laserOffsets = [0.1, 0.34, 0.62, 0.82];
    laserOffsets.forEach((offset, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const bandpass = ctx.createBiquadFilter();
        const start = ctx.currentTime + offset;

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1800 + index * 160, start);
        osc.frequency.exponentialRampToValueAtTime(260 + index * 45, start + 0.18);

        bandpass.type = "bandpass";
        bandpass.frequency.setValueAtTime(1200, start);
        bandpass.Q.setValueAtTime(7, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);

        osc.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(masterGain);

        osc.start(start);
        osc.stop(start + 0.2);
    });

    setTimeout(() => ctx.close(), 1800);
};
