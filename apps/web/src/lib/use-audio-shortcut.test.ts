import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testOnlyResetAudioPrefsCache } from "./use-audio";
import { useAudioShortcut } from "./use-audio-shortcut";

const ENABLED_KEY = "vyoh:audio-enabled";

function pressShiftM(target: EventTarget | null = window) {
  const event = new KeyboardEvent("keydown", {
    code: "KeyM",
    key: "M",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  if (target instanceof Element) {
    target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }
  return event;
}

describe("useAudioShortcut", () => {
  beforeEach(() => {
    localStorage.clear();
    __testOnlyResetAudioPrefsCache();
    function mockGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
    }
    function MockCtor() {
      return {
        currentTime: 0,
        state: "running",
        destination: {},
        createGain: vi.fn(() => mockGain()),
        createOscillator: vi.fn(() => ({
          type: "",
          frequency: { value: 0 },
          connect: vi.fn(() => ({ connect: vi.fn() })),
          start: vi.fn(),
          stop: vi.fn(),
        })),
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

  it("toggles enabled state when Shift+M is pressed", () => {
    renderHook(() => useAudioShortcut());
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
    act(() => {
      pressShiftM();
    });
    expect(localStorage.getItem(ENABLED_KEY)).toBe("1");
    act(() => {
      pressShiftM();
    });
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });

  it("ignores M without Shift", () => {
    renderHook(() => useAudioShortcut());
    const event = new KeyboardEvent("keydown", {
      code: "KeyM",
      key: "m",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });

  it("ignores Shift+M combined with Cmd/Ctrl/Alt", () => {
    renderHook(() => useAudioShortcut());
    for (const modifier of ["metaKey", "ctrlKey", "altKey"] as const) {
      const event = new KeyboardEvent("keydown", {
        code: "KeyM",
        key: "M",
        shiftKey: true,
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    }
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });

  it("ignores Shift+M while typing in an input", () => {
    renderHook(() => useAudioShortcut());
    const input = document.createElement("input");
    document.body.appendChild(input);
    pressShiftM(input);
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
    document.body.removeChild(input);
  });

  it("ignores Shift+M while typing in a textarea", () => {
    renderHook(() => useAudioShortcut());
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    pressShiftM(textarea);
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
    document.body.removeChild(textarea);
  });

  it("ignores Shift+M while typing in a contenteditable element", () => {
    renderHook(() => useAudioShortcut());
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    document.body.appendChild(editor);
    pressShiftM(editor);
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
    document.body.removeChild(editor);
  });

  it("preventDefault is called on a non-typing target", () => {
    renderHook(() => useAudioShortcut());
    const event = pressShiftM();
    expect(event.defaultPrevented).toBe(true);
  });

  it("detaches listener on unmount", () => {
    const { unmount } = renderHook(() => useAudioShortcut());
    unmount();
    pressShiftM();
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });
});
