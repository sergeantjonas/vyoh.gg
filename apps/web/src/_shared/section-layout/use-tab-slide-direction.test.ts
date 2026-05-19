import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTabSlideDirection } from "./use-tab-slide-direction";

const tabIndexOf = (path: string): number => {
  if (path === "/a") return 0;
  if (path === "/b") return 1;
  if (path === "/c") return 2;
  return -1;
};

describe("useTabSlideDirection", () => {
  it("returns 0 on the initial render", () => {
    const { result } = renderHook(({ p }) => useTabSlideDirection(p, tabIndexOf), {
      initialProps: { p: "/a" },
    });
    expect(result.current).toBe(0);
  });

  it("returns +1 when moving forward through the tab order", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useTabSlideDirection(p, tabIndexOf),
      { initialProps: { p: "/a" } }
    );
    rerender({ p: "/b" });
    expect(result.current).toBe(1);
  });

  it("returns -1 when moving backward through the tab order", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useTabSlideDirection(p, tabIndexOf),
      { initialProps: { p: "/c" } }
    );
    rerender({ p: "/a" });
    expect(result.current).toBe(-1);
  });

  it("returns 0 when either path is unknown (tabIndexOf returns -1)", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useTabSlideDirection(p, tabIndexOf),
      { initialProps: { p: "/a" } }
    );
    rerender({ p: "/matches/123" });
    expect(result.current).toBe(0);
  });

  it("preserves the last computed direction across rerenders that don't change the pathname", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useTabSlideDirection(p, tabIndexOf),
      { initialProps: { p: "/a" } }
    );
    rerender({ p: "/b" });
    expect(result.current).toBe(1);
    rerender({ p: "/b" });
    expect(result.current).toBe(1);
  });
});
