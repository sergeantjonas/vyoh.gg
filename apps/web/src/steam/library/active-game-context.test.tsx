import { mainScrollRef } from "@/lib/scroll-container";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActiveGameProvider, useActiveGame } from "./active-game-context";

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveGameProvider>{children}</ActiveGameProvider>;
}

beforeEach(() => {
  mainScrollRef.current = null;
});
afterEach(() => {
  mainScrollRef.current = null;
});

describe("useActiveGame", () => {
  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useActiveGame())).toThrow(
      /must be used within ActiveGameProvider/
    );
  });

  it("tracks the active game appid", () => {
    const { result } = renderHook(() => useActiveGame(), { wrapper });
    expect(result.current.activeGame).toBeNull();
    act(() => result.current.setActiveGame(730));
    expect(result.current.activeGame).toBe(730);
    act(() => result.current.setActiveGame(null));
    expect(result.current.activeGame).toBeNull();
  });

  it("saves, reads, and clears the main scroll position", () => {
    const { result } = renderHook(() => useActiveGame(), { wrapper });
    const fakeMain = { scrollTop: 420 } as HTMLElement;
    mainScrollRef.current = fakeMain;
    act(() => result.current.saveListScroll());
    expect(result.current.readListScroll()).toBe(420);
    act(() => result.current.clearListScroll());
    expect(result.current.readListScroll()).toBe(0);
  });

  it("falls back to 0 when no main scroll container is mounted", () => {
    const { result } = renderHook(() => useActiveGame(), { wrapper });
    act(() => result.current.saveListScroll());
    expect(result.current.readListScroll()).toBe(0);
  });

  it("stores and clears the origin rects for forward and backward navigation", () => {
    const { result } = renderHook(() => useActiveGame(), { wrapper });
    expect(result.current.originRectRef.current).toBeNull();
    const heroRect = new DOMRect(10, 20, 600, 200);
    const logoRect = new DOMRect(14, 180, 200, 40);
    act(() =>
      result.current.setOriginRect({
        appid: 730,
        heroRect,
        logoRect,
        direction: "backward",
      })
    );
    expect(result.current.originRectRef.current).toEqual({
      appid: 730,
      heroRect,
      logoRect,
      direction: "backward",
    });
    act(() => result.current.setOriginRect(null));
    expect(result.current.originRectRef.current).toBeNull();
  });

  it("accepts a null logoRect for the text-fallback case", () => {
    const { result } = renderHook(() => useActiveGame(), { wrapper });
    const heroRect = new DOMRect(0, 0, 1920, 620);
    act(() =>
      result.current.setOriginRect({
        appid: 9999,
        heroRect,
        logoRect: null,
        direction: "backward",
      })
    );
    expect(result.current.originRectRef.current?.logoRect).toBeNull();
  });
});
