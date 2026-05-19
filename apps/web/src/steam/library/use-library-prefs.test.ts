import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLibraryPrefs } from "./use-library-prefs";

const STORAGE_KEY = "vyoh:steam-library-prefs";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useLibraryPrefs", () => {
  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useLibraryPrefs());
    expect(result.current[0]).toEqual({
      layout: "tiles",
      sort: "lifetime",
      playedFilter: "all",
      appTypeFilter: "game",
      selectedTagIds: [],
    });
  });

  it("reads persisted prefs from localStorage on mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layout: "rows",
        sort: "name",
        playedFilter: "played",
        appTypeFilter: "app",
        selectedTagIds: [1, 2, 3],
      })
    );
    const { result } = renderHook(() => useLibraryPrefs());
    expect(result.current[0]).toEqual({
      layout: "rows",
      sort: "name",
      playedFilter: "played",
      appTypeFilter: "app",
      selectedTagIds: [1, 2, 3],
    });
  });

  it("coerces unknown discriminator values to their defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layout: "huh",
        sort: "unknown",
        playedFilter: "garbage",
        appTypeFilter: "video",
      })
    );
    const { result } = renderHook(() => useLibraryPrefs());
    expect(result.current[0].layout).toBe("tiles");
    expect(result.current[0].sort).toBe("lifetime");
    expect(result.current[0].playedFilter).toBe("all");
    expect(result.current[0].appTypeFilter).toBe("all");
  });

  it("drops non-integer entries from selectedTagIds", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedTagIds: [1, "two", Number.NaN, 3.5, 4] })
    );
    const { result } = renderHook(() => useLibraryPrefs());
    expect(result.current[0].selectedTagIds).toEqual([1, 4]);
  });

  it("falls back to defaults when persisted JSON is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{");
    const { result } = renderHook(() => useLibraryPrefs());
    expect(result.current[0].layout).toBe("tiles");
  });

  it("updates an individual pref via the setter and persists it", () => {
    const { result } = renderHook(() => useLibraryPrefs());
    act(() => result.current[1]("layout", "rows"));
    expect(result.current[0].layout).toBe("rows");
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.layout).toBe("rows");
  });

  it("preserves untouched fields when one field is updated", () => {
    const { result } = renderHook(() => useLibraryPrefs());
    act(() => result.current[1]("sort", "name"));
    expect(result.current[0].sort).toBe("name");
    expect(result.current[0].layout).toBe("tiles");
    expect(result.current[0].playedFilter).toBe("all");
  });
});
