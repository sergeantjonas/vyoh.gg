import { mainScrollRef } from "@/lib/scroll-container";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActiveChampionProvider, useActiveChampion } from "./active-champion-context";

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveChampionProvider>{children}</ActiveChampionProvider>;
}

beforeEach(() => {
  mainScrollRef.current = null;
});
afterEach(() => {
  mainScrollRef.current = null;
});

describe("useActiveChampion", () => {
  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useActiveChampion())).toThrow(
      /must be used within ActiveChampionProvider/
    );
  });

  it("tracks the active champion alias", () => {
    const { result } = renderHook(() => useActiveChampion(), { wrapper });
    expect(result.current.activeChampion).toBeNull();
    act(() => result.current.setActiveChampion("Ahri"));
    expect(result.current.activeChampion).toBe("Ahri");
    act(() => result.current.setActiveChampion(null));
    expect(result.current.activeChampion).toBeNull();
  });

  it("saves, reads, and clears the main scroll position", () => {
    const { result } = renderHook(() => useActiveChampion(), { wrapper });
    const fakeMain = { scrollTop: 420 } as HTMLElement;
    mainScrollRef.current = fakeMain;
    act(() => result.current.saveListScroll());
    expect(result.current.readListScroll()).toBe(420);
    act(() => result.current.clearListScroll());
    expect(result.current.readListScroll()).toBe(0);
  });

  it("falls back to 0 when no main scroll container is mounted", () => {
    const { result } = renderHook(() => useActiveChampion(), { wrapper });
    act(() => result.current.saveListScroll());
    expect(result.current.readListScroll()).toBe(0);
  });

  it("stores and clears the origin rect for forward and backward navigation", () => {
    const { result } = renderHook(() => useActiveChampion(), { wrapper });
    expect(result.current.originRectRef.current).toBeNull();
    const rect = new DOMRect(10, 20, 200, 120);
    act(() =>
      result.current.setOriginRect({
        championAlias: "Ahri",
        rect,
        direction: "forward",
      })
    );
    expect(result.current.originRectRef.current).toEqual({
      championAlias: "Ahri",
      rect,
      direction: "forward",
    });
    act(() => result.current.setOriginRect(null));
    expect(result.current.originRectRef.current).toBeNull();
  });
});
