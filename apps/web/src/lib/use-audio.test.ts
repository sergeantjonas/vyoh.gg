import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testOnlyResetAudioPrefsCache, useAudio, useAudioHydration } from "./use-audio";

const ENABLED_KEY = "vyoh:audio-enabled";
const VOLUME_KEY = "vyoh:audio-volume";

describe("useAudio", () => {
  beforeEach(() => {
    localStorage.clear();
    __testOnlyResetAudioPrefsCache();
    // Silence the bus's AudioContext lookup — happy-dom has no Web Audio.
    function MockCtor() {
      return {
        currentTime: 0,
        state: "running",
        destination: {},
        createGain: () => ({
          gain: { value: 0 },
          connect: vi.fn(),
        }),
        createOscillator: vi.fn(),
        createBuffer: vi.fn(),
        createBufferSource: vi.fn(),
        createBiquadFilter: vi.fn(),
        close: vi.fn(),
        resume: vi.fn(() => Promise.resolve()),
      };
    }
    vi.stubGlobal("AudioContext", MockCtor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled with 0.5 volume when nothing persisted", () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.enabled).toBe(false);
    expect(result.current.volume).toBe(0.5);
  });

  it("reads persisted enabled flag from localStorage", () => {
    localStorage.setItem(ENABLED_KEY, "1");
    const { result } = renderHook(() => useAudio());
    expect(result.current.enabled).toBe(true);
  });

  it("reads persisted volume from localStorage and clamps invalid values", () => {
    localStorage.setItem(VOLUME_KEY, "0.7");
    let { result } = renderHook(() => useAudio());
    expect(result.current.volume).toBe(0.7);

    __testOnlyResetAudioPrefsCache();
    localStorage.setItem(VOLUME_KEY, "5");
    ({ result } = renderHook(() => useAudio()));
    expect(result.current.volume).toBe(1);

    __testOnlyResetAudioPrefsCache();
    localStorage.setItem(VOLUME_KEY, "garbage");
    ({ result } = renderHook(() => useAudio()));
    expect(result.current.volume).toBe(0.5);
  });

  it("setEnabled(true) persists the flag", () => {
    const { result } = renderHook(() => useAudio());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(ENABLED_KEY)).toBe("1");
  });

  it("setEnabled(false) removes the persisted flag", () => {
    localStorage.setItem(ENABLED_KEY, "1");
    const { result } = renderHook(() => useAudio());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });

  it("setVolume() clamps to [0, 1] and persists", () => {
    const { result } = renderHook(() => useAudio());
    act(() => result.current.setVolume(2));
    expect(result.current.volume).toBe(1);
    expect(localStorage.getItem(VOLUME_KEY)).toBe("1");
    act(() => result.current.setVolume(-1));
    expect(result.current.volume).toBe(0);
    expect(localStorage.getItem(VOLUME_KEY)).toBe("0");
    act(() => result.current.setVolume(0.5));
    expect(result.current.volume).toBe(0.5);
    expect(localStorage.getItem(VOLUME_KEY)).toBe("0.5");
  });

  it("two hook instances stay in sync after a mutation in one", () => {
    const a = renderHook(() => useAudio());
    const b = renderHook(() => useAudio());
    expect(a.result.current.enabled).toBe(false);
    expect(b.result.current.enabled).toBe(false);
    act(() => a.result.current.setEnabled(true));
    expect(a.result.current.enabled).toBe(true);
    expect(b.result.current.enabled).toBe(true);
  });

  it("play() does not throw when bus is uninitialised", () => {
    const { result } = renderHook(() => useAudio());
    expect(() => result.current.play("palette.open")).not.toThrow();
  });
});

describe("useAudioHydration", () => {
  beforeEach(() => {
    localStorage.clear();
    __testOnlyResetAudioPrefsCache();
    function MockCtor() {
      return {
        currentTime: 0,
        state: "running",
        destination: {},
        createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
        createOscillator: vi.fn(),
        createBuffer: vi.fn(),
        createBufferSource: vi.fn(),
        createBiquadFilter: vi.fn(),
        close: vi.fn(),
        resume: vi.fn(() => Promise.resolve()),
      };
    }
    vi.stubGlobal("AudioContext", MockCtor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not throw when mounted with empty localStorage", () => {
    expect(() => renderHook(() => useAudioHydration())).not.toThrow();
  });

  it("does not attach a gesture listener when prefs are disabled", () => {
    const spy = vi.spyOn(document, "addEventListener");
    renderHook(() => useAudioHydration());
    const audioListeners = spy.mock.calls.filter(
      ([type]) => type === "pointerdown" || type === "keydown"
    );
    expect(audioListeners).toHaveLength(0);
    spy.mockRestore();
  });

  it("attaches gesture listeners when prefs are enabled at mount", () => {
    localStorage.setItem(ENABLED_KEY, "1");
    const spy = vi.spyOn(document, "addEventListener");
    renderHook(() => useAudioHydration());
    const audioListeners = spy.mock.calls.filter(
      ([type]) => type === "pointerdown" || type === "keydown"
    );
    expect(audioListeners.length).toBeGreaterThanOrEqual(2);
    spy.mockRestore();
  });
});
