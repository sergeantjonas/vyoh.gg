import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeColor } from "./use-theme-color";

const DEFAULT_META = "#0a0a0a";

beforeEach(() => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = DEFAULT_META;
  document.documentElement.style.removeProperty("--theme-color");
});

afterEach(() => {
  document.documentElement.style.removeProperty("--theme-color");
});

describe("useThemeColor", () => {
  it("writes --theme-color on the root element", () => {
    renderHook(() => useThemeColor("oklch(0.7 0.18 30)"));
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe(
      "oklch(0.7 0.18 30)"
    );
  });

  it("updates the meta theme-color tag", () => {
    renderHook(() => useThemeColor("#ff8800"));
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe("#ff8800");
  });

  it("clears --theme-color on unmount", () => {
    const { unmount } = renderHook(() => useThemeColor("#abc"));
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe("#abc");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe("");
  });

  it("restores the previous meta content on unmount", () => {
    const { unmount } = renderHook(() => useThemeColor("#abc"));
    unmount();
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe(DEFAULT_META);
  });

  it("clears when given null without leaking the previous color", () => {
    const { rerender } = renderHook(({ c }: { c: string | null }) => useThemeColor(c), {
      initialProps: { c: "#abc" as string | null },
    });
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe("#abc");
    rerender({ c: null });
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe("");
  });

  it("handles rapid color changes by writing the latest value", () => {
    const { rerender } = renderHook(({ c }: { c: string }) => useThemeColor(c), {
      initialProps: { c: "#111" },
    });
    rerender({ c: "#222" });
    rerender({ c: "#333" });
    expect(document.documentElement.style.getPropertyValue("--theme-color")).toBe("#333");
  });
});
