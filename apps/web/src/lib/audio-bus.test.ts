import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioBus } from "./audio-bus";

function buildMockAudioContext() {
  const oscillators: Array<{
    type: string;
    frequency: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];

  const createOscillator = vi.fn(() => {
    const next = { connect: vi.fn() };
    const osc = {
      type: "",
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(() => next),
    };
    oscillators.push(osc);
    return osc;
  });

  const createGain = vi.fn(() => {
    const next = { connect: vi.fn() };
    const gain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(() => next),
    };
    gains.push(gain);
    return gain;
  });

  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: "running" as const,
    destination: {} as AudioDestinationNode,
    createOscillator,
    createGain,
    createBuffer: vi.fn((_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
    createBufferSource: vi.fn(() => {
      const next = { connect: vi.fn(() => ({ connect: vi.fn() })) };
      return {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(() => next),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }),
    createBiquadFilter: vi.fn(() => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(() => ({ connect: vi.fn() })),
    })),
    close: vi.fn(),
    resume: vi.fn(() => Promise.resolve()),
  };

  return { ctx, oscillators, gains };
}

describe("AudioBus", () => {
  let mock: ReturnType<typeof buildMockAudioContext>;

  beforeEach(() => {
    mock = buildMockAudioContext();
    // Must be a real (non-arrow) constructor so `new Ctor()` works.
    function MockCtor() {
      return mock.ctx;
    }
    vi.stubGlobal("AudioContext", MockCtor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled with 0.5 volume", () => {
    const bus = new AudioBus();
    expect(bus.enabled).toBe(false);
    expect(bus.volume).toBe(0.5);
  });

  it("play() is a no-op when disabled, even after init()", () => {
    const bus = new AudioBus();
    bus.init();
    bus.play("palette.open");
    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("play() is a no-op when never init'd, even when enabled", () => {
    const bus = new AudioBus();
    bus.setEnabled(true);
    bus.play("palette.open");
    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("invokes the recipe when enabled and init'd", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setEnabled(true);
    bus.play("palette.open");
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(1);
    // palette.open is a single 600 Hz sine.
    expect(mock.oscillators[0]?.frequency.value).toBe(600);
  });

  it("init() is idempotent", () => {
    const bus = new AudioBus();
    bus.init();
    bus.init();
    bus.init();
    // master gain created once.
    expect(mock.ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it("setVolume() clamps to [0, 1] and writes to master gain when init'd", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setVolume(2);
    expect(bus.volume).toBe(1);
    expect(mock.gains[0]?.gain.value).toBe(1);
    bus.setVolume(-1);
    expect(bus.volume).toBe(0);
    expect(mock.gains[0]?.gain.value).toBe(0);
    bus.setVolume(0.5);
    expect(bus.volume).toBe(0.5);
    expect(mock.gains[0]?.gain.value).toBe(0.5);
  });

  it("setVolume() before init() stays remembered and applies on init()", () => {
    const bus = new AudioBus();
    bus.setVolume(0.7);
    bus.init();
    expect(mock.gains[0]?.gain.value).toBe(0.7);
  });

  it("dispose() closes the context and lets play() become a no-op again", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setEnabled(true);
    bus.dispose();
    expect(mock.ctx.close).toHaveBeenCalledTimes(1);
    bus.play("palette.open");
    // No new oscillators after dispose.
    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("multi-oscillator recipes (palette.select additive) build multiple oscillators", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setEnabled(true);
    bus.play("palette.select");
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mock.oscillators[0]?.frequency.value).toBe(660);
    expect(mock.oscillators[1]?.frequency.value).toBe(990);
  });

  it("swoop recipe (nav.transition) uses Oscillator with frequency ramp", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setEnabled(true);
    bus.play("nav.transition");
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mock.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("resumes a suspended context on play()", () => {
    const bus = new AudioBus();
    bus.init();
    bus.setEnabled(true);
    // init() resumes defensively; clear so we only count the play() resume.
    mock.ctx.resume.mockClear();
    (mock.ctx as { state: string }).state = "suspended";
    bus.play("palette.open");
    expect(mock.ctx.resume).toHaveBeenCalledTimes(1);
  });
});
