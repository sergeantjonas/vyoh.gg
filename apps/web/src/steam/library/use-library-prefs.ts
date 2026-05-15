import { useCallback, useEffect, useState } from "react";

export type LibraryLayout = "rows" | "tiles";
export type LibrarySort = "lifetime" | "name" | "twoWeeks";
export type LibraryPlayedFilter = "all" | "played" | "never";

export interface LibraryPrefs {
  layout: LibraryLayout;
  sort: LibrarySort;
  playedFilter: LibraryPlayedFilter;
}

const STORAGE_KEY = "vyoh:steam-library-prefs";
const DEFAULTS: LibraryPrefs = {
  layout: "rows",
  sort: "lifetime",
  playedFilter: "all",
};

// Narrow validator — drops the persisted value silently if an old client
// shape leaks through (e.g. removed sort option). Keeps the union types
// honest without a runtime schema lib.
function parsePrefs(raw: string | null): LibraryPrefs {
  if (raw === null) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs>;
    return {
      layout: parsed.layout === "tiles" ? "tiles" : "rows",
      sort:
        parsed.sort === "name" || parsed.sort === "twoWeeks" ? parsed.sort : "lifetime",
      playedFilter:
        parsed.playedFilter === "played" || parsed.playedFilter === "never"
          ? parsed.playedFilter
          : "all",
    };
  } catch {
    return DEFAULTS;
  }
}

export function useLibraryPrefs(): [
  LibraryPrefs,
  <K extends keyof LibraryPrefs>(key: K, value: LibraryPrefs[K]) => void,
] {
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    return parsePrefs(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const update = useCallback(
    <K extends keyof LibraryPrefs>(key: K, value: LibraryPrefs[K]) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return [prefs, update];
}
