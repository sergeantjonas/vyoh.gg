import { useCallback, useEffect, useSyncExternalStore } from "react";
import { audioBus } from "./audio-bus";
import type { SoundSlot } from "./audio-recipes";

const ENABLED_KEY = "vyoh:audio-enabled";
const VOLUME_KEY = "vyoh:audio-volume";
const DEFAULT_VOLUME = 0.5;

type AudioPrefs = { enabled: boolean; volume: number };

let cachedPrefs: AudioPrefs | null = null;
let firstGestureListenerAttached = false;
const listeners = new Set<() => void>();

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function readPrefs(): AudioPrefs {
  if (typeof window === "undefined") {
    return { enabled: false, volume: DEFAULT_VOLUME };
  }
  const enabled = window.localStorage.getItem(ENABLED_KEY) === "1";
  const rawVolume = window.localStorage.getItem(VOLUME_KEY);
  const parsed = rawVolume == null ? DEFAULT_VOLUME : Number(rawVolume);
  const volume = Number.isFinite(parsed) ? clamp01(parsed) : DEFAULT_VOLUME;
  return { enabled, volume };
}

function getSnapshot(): AudioPrefs {
  if (cachedPrefs == null) cachedPrefs = readPrefs();
  return cachedPrefs;
}

// Module constant, not a fresh literal per call. `useSyncExternalStore`
// compares snapshots with Object.is, so returning a new object each time means
// the snapshot never looks equal to itself — React warns about the infinite
// loop that implies, and re-renders every consumer on each server pass.
const SERVER_PREFS: AudioPrefs = { enabled: false, volume: DEFAULT_VOLUME };

function getServerSnapshot(): AudioPrefs {
  return SERVER_PREFS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  cachedPrefs = readPrefs();
  for (const l of listeners) l();
}

function attachFirstGestureInit(): void {
  if (firstGestureListenerAttached || typeof window === "undefined") return;
  firstGestureListenerAttached = true;
  const handler = () => {
    audioBus.init();
    document.removeEventListener("pointerdown", handler);
    document.removeEventListener("keydown", handler);
  };
  document.addEventListener("pointerdown", handler);
  document.addEventListener("keydown", handler);
}

/**
 * Mount once at app root. Syncs the bus to persisted prefs and arms a
 * one-shot gesture listener so the AudioContext can be created on first
 * user interaction (browser autoplay policy).
 */
export function useAudioHydration(): void {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    audioBus.setEnabled(prefs.enabled);
    audioBus.setVolume(prefs.volume);
    if (prefs.enabled) attachFirstGestureInit();
  }, [prefs.enabled, prefs.volume]);
}

export type UseAudioReturn = {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (v: number) => void;
  play: (slot: SoundSlot) => void;
};

export function useAudio(): UseAudioReturn {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((enabled: boolean) => {
    if (typeof window === "undefined") return;
    if (enabled) {
      window.localStorage.setItem(ENABLED_KEY, "1");
      // The toggle click IS the user gesture — safe to init now.
      audioBus.init();
      audioBus.setEnabled(true);
    } else {
      window.localStorage.removeItem(ENABLED_KEY);
      audioBus.setEnabled(false);
    }
    notify();
  }, []);

  const setVolume = useCallback((v: number) => {
    if (typeof window === "undefined") return;
    const clamped = clamp01(v);
    window.localStorage.setItem(VOLUME_KEY, String(clamped));
    audioBus.setVolume(clamped);
    notify();
  }, []);

  const play = useCallback((slot: SoundSlot) => {
    audioBus.play(slot);
  }, []);

  return {
    enabled: prefs.enabled,
    volume: prefs.volume,
    setEnabled,
    setVolume,
    play,
  };
}

export const __testOnlyResetAudioPrefsCache = () => {
  cachedPrefs = null;
  firstGestureListenerAttached = false;
  audioBus.setEnabled(false);
  audioBus.setVolume(DEFAULT_VOLUME);
  audioBus.dispose();
};
