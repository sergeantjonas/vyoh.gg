export type SoundSlot =
  | "palette.open"
  | "palette.close"
  | "palette.select"
  | "nav.transition"
  | "match.win"
  | "match.loss"
  | "record.fire"
  | "error.toast";

export type Recipe = (ctx: AudioContext, master: GainNode) => void;

function playSine(
  ctx: AudioContext,
  master: GainNode,
  {
    freq,
    durationMs,
    peak,
    startOffsetMs = 0,
  }: { freq: number; durationMs: number; peak: number; startOffsetMs?: number }
): void {
  const t0 = ctx.currentTime + startOffsetMs / 1000;
  const t1 = t0 + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t1 + 0.05);
}

function playAdditive(
  ctx: AudioContext,
  master: GainNode,
  {
    partials,
    durationMs,
  }: { partials: Array<{ freq: number; gain: number }>; durationMs: number }
): void {
  for (const partial of partials) {
    playSine(ctx, master, {
      freq: partial.freq,
      durationMs,
      peak: partial.gain,
    });
  }
}

function playSwoop(
  ctx: AudioContext,
  master: GainNode,
  {
    fromFreq,
    toFreq,
    durationMs,
    peak,
  }: { fromFreq: number; toFreq: number; durationMs: number; peak: number }
): void {
  const t0 = ctx.currentTime;
  const t1 = t0 + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fromFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t1);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t1 + 0.05);
}

function playWobble(
  ctx: AudioContext,
  master: GainNode,
  {
    freq,
    lfoHz,
    lfoDepth,
    durationMs,
    peak,
  }: {
    freq: number;
    lfoHz: number;
    lfoDepth: number;
    durationMs: number;
    peak: number;
  }
): void {
  const t0 = ctx.currentTime;
  const t1 = t0 + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = lfoHz;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = lfoDepth;
  lfo.connect(lfoGain).connect(osc.frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t1 + 0.05);
  lfo.start(t0);
  lfo.stop(t1 + 0.05);
}

export const SOUND_RECIPES: Record<SoundSlot, Recipe> = {
  "palette.open": (ctx, m) => playSine(ctx, m, { freq: 600, durationMs: 80, peak: 0.4 }),
  "palette.close": (ctx, m) =>
    playSine(ctx, m, { freq: 400, durationMs: 120, peak: 0.35 }),
  "palette.select": (ctx, m) =>
    playAdditive(ctx, m, {
      partials: [
        { freq: 660, gain: 0.28 },
        { freq: 990, gain: 0.16 },
      ],
      durationMs: 100,
    }),
  "nav.transition": (ctx, m) =>
    playSwoop(ctx, m, { fromFreq: 440, toFreq: 220, durationMs: 160, peak: 0.22 }),
  "match.win": (ctx, m) => {
    playSine(ctx, m, { freq: 660, durationMs: 250, peak: 0.32 });
    playSine(ctx, m, {
      freq: 880,
      durationMs: 250,
      peak: 0.32,
      startOffsetMs: 120,
    });
    playSine(ctx, m, {
      freq: 1320,
      durationMs: 320,
      peak: 0.28,
      startOffsetMs: 240,
    });
  },
  "match.loss": (ctx, m) => playSine(ctx, m, { freq: 200, durationMs: 400, peak: 0.3 }),
  "record.fire": (ctx, m) =>
    playAdditive(ctx, m, {
      partials: [
        { freq: 440, gain: 0.28 },
        { freq: 1100, gain: 0.18 },
        { freq: 1760, gain: 0.1 },
        { freq: 2640, gain: 0.05 },
      ],
      durationMs: 800,
    }),
  "error.toast": (ctx, m) =>
    playWobble(ctx, m, {
      freq: 300,
      lfoHz: 6,
      lfoDepth: 20,
      durationMs: 300,
      peak: 0.3,
    }),
};
