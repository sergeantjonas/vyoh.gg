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
    const prefix = "/lol/ahri/matches/";
    const list = "/lol/ahri/matches";
    const { rerender } = renderHook(
      ({ path }) => useScrollResetOnNav(path, prefix, list),
      { initialProps: { path: "/lol/ahri/matches/EUW1_123/recap" } }
    );
    rerender({ path: list });
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("does scroll when navigating away from matches to another tab", () => {
    const prefix = "/lol/ahri/matches/";
    const list = "/lol/ahri/matches";
    const { rerender } = renderHook(
      ({ path }) => useScrollResetOnNav(path, prefix, list),
      { initialProps: { path: "/lol/ahri/matches" } }
    );
    rerender({ path: "/lol/ahri/trends" });
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });
});
