import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { registerOpenDetailPanel, useDetailPanelOpen } from "./scroll-container-context";

// `openPanelCount` and `listeners` are module-level singletons shared with
// scroll-to-top.tsx, and the module exports no reset. Vitest runs a file's
// tests in order against one module instance, so every case here must balance
// its own registrations back to zero or it leaks into the next one. Do not
// reach for vi.resetModules() to avoid that: it would hand this file a
// different module instance than the component under test in the sibling
// integration case, which is the bug this contract exists to prevent.
describe("useDetailPanelOpen", () => {
  it("reports closed when nothing has registered", () => {
    const { result } = renderHook(() => useDetailPanelOpen());
    expect(result.current).toBe(false);
  });

  it("flips open on register and closed again on dispose", () => {
    const { result } = renderHook(() => useDetailPanelOpen());

    let dispose!: () => void;
    act(() => {
      dispose = registerOpenDetailPanel();
    });
    expect(result.current).toBe(true);

    act(() => {
      dispose();
    });
    expect(result.current).toBe(false);
  });

  it("stays open while a second panel is still registered", () => {
    const { result } = renderHook(() => useDetailPanelOpen());

    let disposeA!: () => void;
    let disposeB!: () => void;
    act(() => {
      disposeA = registerOpenDetailPanel();
      disposeB = registerOpenDetailPanel();
    });
    expect(result.current).toBe(true);

    act(() => {
      disposeA();
    });
    expect(result.current).toBe(true);

    act(() => {
      disposeB();
    });
    expect(result.current).toBe(false);
  });

  // The regression this guards: an unguarded dispose decrements every time it
  // is called, so a double-invoke leaves the counter at -1. `notify` reads
  // `openPanelCount > 0`, so the next register only brings it back to 0 and
  // the hook stays false for the rest of the page session. Without the
  // `released` flag this case fails on the final assertion, not the first.
  it("ignores a repeated dispose so the counter cannot go negative", () => {
    const { result } = renderHook(() => useDetailPanelOpen());

    let dispose!: () => void;
    act(() => {
      dispose = registerOpenDetailPanel();
    });
    act(() => {
      dispose();
      dispose();
    });
    expect(result.current).toBe(false);

    let disposeAgain!: () => void;
    act(() => {
      disposeAgain = registerOpenDetailPanel();
    });
    expect(result.current).toBe(true);

    act(() => {
      disposeAgain();
    });
    expect(result.current).toBe(false);
  });

  // Covers the useState initializer rather than the subscription: a consumer
  // that mounts while a panel is already open must not paint one frame in the
  // "closed" state waiting for a notify that will never come.
  it("reports open on first render when a panel registered before mount", () => {
    const dispose = registerOpenDetailPanel();

    const { result, unmount } = renderHook(() => useDetailPanelOpen());
    expect(result.current).toBe(true);

    unmount();
    dispose();
  });

  it("does not throw when a panel registers and disposes after every consumer unmounted", () => {
    const { unmount } = renderHook(() => useDetailPanelOpen());
    unmount();

    expect(() => {
      const dispose = registerOpenDetailPanel();
      dispose();
    }).not.toThrow();
  });
});
