import { mainScrollRef } from "@/lib/scroll-container";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollResetOnNav } from "./use-scroll-reset-on-nav";

const scrollToMock = vi.fn();

beforeEach(() => {
  mainScrollRef.current = { scrollTo: scrollToMock } as unknown as HTMLElement;
});

afterEach(() => {
  mainScrollRef.current = null;
  scrollToMock.mockClear();
});

describe("useScrollResetOnNav", () => {
  it("does not scroll on initial mount", () => {
    renderHook(() => useScrollResetOnNav("/lol/ahri"));
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("scrolls to top when pathname changes", () => {
    const { rerender } = renderHook(({ path }) => useScrollResetOnNav(path), {
      initialProps: { path: "/lol/ahri" },
    });
    rerender({ path: "/lol/ahri/matches" });
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });

  it("skips scroll when navigating from match detail back to list", () => {
    const matchesSkip = [
      { fromPrefix: "/lol/ahri/matches/", toExact: "/lol/ahri/matches" },
    ];
    const { rerender } = renderHook(
      ({ path }) => useScrollResetOnNav(path, matchesSkip),
      { initialProps: { path: "/lol/ahri/matches/EUW1_123/recap" } }
    );
    rerender({ path: "/lol/ahri/matches" });
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("does scroll when navigating away from matches to another tab", () => {
    const matchesSkip = [
      { fromPrefix: "/lol/ahri/matches/", toExact: "/lol/ahri/matches" },
    ];
    const { rerender } = renderHook(
      ({ path }) => useScrollResetOnNav(path, matchesSkip),
      { initialProps: { path: "/lol/ahri/matches" } }
    );
    rerender({ path: "/lol/ahri/trends" });
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });

  it("skips scroll when navigating from champion detail back to list", () => {
    const skips = [
      { fromPrefix: "/lol/ahri/matches/", toExact: "/lol/ahri/matches" },
      { fromPrefix: "/lol/ahri/champions/", toExact: "/lol/ahri/champions" },
    ];
    const { rerender } = renderHook(({ path }) => useScrollResetOnNav(path, skips), {
      initialProps: { path: "/lol/ahri/champions/ahri" },
    });
    rerender({ path: "/lol/ahri/champions" });
    expect(scrollToMock).not.toHaveBeenCalled();
  });
});
