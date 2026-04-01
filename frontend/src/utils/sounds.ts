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

// ---------------------------------------------------------------------------
// 8-bit award sound — synthesised via Web Audio API, no audio files needed
// ---------------------------------------------------------------------------

type AwardTier = "low" | "mid" | "high" | "epic";

const TIER_NOTES: Record<AwardTier, number[]> = {
    //        C5      E5      G5      C6      E6
    low:  [523.25, 659.25],
    mid:  [523.25, 659.25, 783.99],
    high: [523.25, 659.25, 783.99, 1046.5],
    epic: [523.25, 659.25, 783.99, 1046.5, 1318.5],
};

const getTier = (points: number): AwardTier => {
    if (points >= 20) return "epic";
    if (points >= 12) return "high";
    if (points >= 8)  return "mid";
    return "low";
};

export const playAwardSound = (points: number) => {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const tier  = getTier(points);
    const notes = TIER_NOTES[tier];
    const noteDuration = 0.075;
    const noteGap      = 0.015;
    const masterGain   = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(ctx.destination);

    notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * (noteDuration + noteGap);
        const end   = start + noteDuration;

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(1,     start);
        gain.gain.setValueAtTime(1,     end - 0.01);
        gain.gain.linearRampToValueAtTime(0, end);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(end);
    });

    // Closing sustain note on the tonic an octave up — makes it feel "resolved"
    const resolveOsc  = ctx.createOscillator();
    const resolveGain = ctx.createGain();
    const resolveStart = ctx.currentTime + notes.length * (noteDuration + noteGap);

    resolveOsc.type = "square";
    resolveOsc.frequency.setValueAtTime(notes[0] * 2, resolveStart);
    resolveGain.gain.setValueAtTime(0.9,  resolveStart);
    resolveGain.gain.exponentialRampToValueAtTime(0.001, resolveStart + 0.35);

    resolveOsc.connect(resolveGain);
    resolveGain.connect(masterGain);
    resolveOsc.start(resolveStart);
    resolveOsc.stop(resolveStart + 0.35);

    // Close the context after everything has played
    const totalDuration = resolveStart + 0.4 - ctx.currentTime;
    setTimeout(() => ctx.close(), totalDuration * 1000 + 100);
};