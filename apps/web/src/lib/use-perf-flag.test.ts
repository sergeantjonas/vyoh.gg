import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePerfFlag } from "./use-perf-flag";

const STORAGE_KEY = "vyoh:perf";

describe("usePerfFlag", () => {
  beforeEach(() => {
    localStorage.clear();
    // happy-dom carries window.location.search across tests; clear it.
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false by default (no URL param, no localStorage entry)", () => {
    const { result } = renderHook(() => usePerfFlag());
    expect(result.current).toBe(false);
  });

  it("returns true when ?perf is present in the URL and persists the flag to localStorage", () => {
    window.history.replaceState({}, "", "/?perf");
    const { result } = renderHook(() => usePerfFlag());
    expect(result.current).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("returns true when localStorage already holds the flag, even without ?perf in URL", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    const { result } = renderHook(() => usePerfFlag());
    expect(result.current).toBe(true);
  });

  it("returns false when localStorage holds anything other than '1'", () => {
    localStorage.setItem(STORAGE_KEY, "0");
    const { result } = renderHook(() => usePerfFlag());
    expect(result.current).toBe(false);
  });
});
