import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHoverPrefetch } from "./use-hover-prefetch";

describe("useHoverPrefetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fires trigger after the default 150ms hover delay", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerEnter();
    });

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(trigger).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("respects a custom delay", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger, { delay: 100 }));

    act(() => {
      result.current.onPointerEnter();
    });
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(trigger).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending trigger on pointer leave", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerEnter();
      vi.advanceTimersByTime(100);
      result.current.onPointerLeave();
      vi.advanceTimersByTime(500);
    });

    expect(trigger).not.toHaveBeenCalled();
  });

  it("fires trigger immediately on pointer down (no delay)", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerDown();
    });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("pointer down during a pending hover fires trigger exactly once", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerEnter();
      vi.advanceTimersByTime(80);
      result.current.onPointerDown();
      vi.advanceTimersByTime(500);
    });

    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("uses the latest trigger reference without resetting handlers", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useHoverPrefetch(fn), {
      initialProps: { fn: first },
    });
    const initialEnter = result.current.onPointerEnter;

    rerender({ fn: second });
    expect(result.current.onPointerEnter).toBe(initialEnter);

    act(() => {
      result.current.onPointerEnter();
      vi.advanceTimersByTime(150);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clears a pending timer if the component unmounts mid-hover", () => {
    const trigger = vi.fn();
    const { result, unmount } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerEnter();
      vi.advanceTimersByTime(80);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(trigger).not.toHaveBeenCalled();
  });

  it("short-circuits to no-op handlers when navigator.connection.saveData is true", () => {
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      connection: { saveData: true },
    });
    const trigger = vi.fn();
    const { result } = renderHook(() => useHoverPrefetch(trigger));

    act(() => {
      result.current.onPointerEnter();
      vi.advanceTimersByTime(500);
      result.current.onPointerDown();
    });

    expect(trigger).not.toHaveBeenCalled();
  });
});
