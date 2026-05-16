import { useCallback, useEffect, useState } from "react";

export type LibraryLayout = "rows" | "tiles";
export type LibrarySort = "lifetime" | "name" | "twoWeeks";
export type LibraryPlayedFilter = "all" | "played" | "never";
// Steam StoreItemType: 0 = Game, 6 = Application/Tool. Other values
// (DLC/Music/Video) almost never appear in GetOwnedGames, so we don't expose
// them. Unenriched rows (appType === null) fall under "game" — the assumption
// is correct for ~99% of newly-added titles and avoids them vanishing from
// the default view between enrichment passes.
export type LibraryAppTypeFilter = "all" | "game" | "app";

export interface LibraryPrefs {
  layout: LibraryLayout;
  sort: LibrarySort;
  playedFilter: LibraryPlayedFilter;
  appTypeFilter: LibraryAppTypeFilter;
  selectedTagIds: number[];
}

const STORAGE_KEY = "vyoh:steam-library-prefs";
const DEFAULTS: LibraryPrefs = {
  layout: "tiles",
  sort: "lifetime",
  playedFilter: "all",
  appTypeFilter: "game",
  selectedTagIds: [],
};

// Narrow validator — drops the persisted value silently if an old client
// shape leaks through (e.g. removed sort option). Keeps the union types
// honest without a runtime schema lib.
function parsePrefs(raw: string | null): LibraryPrefs {
  if (raw === null) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs>;
    return {
      layout: parsed.layout === "rows" ? "rows" : "tiles",
      sort:
        parsed.sort === "name" || parsed.sort === "twoWeeks" ? parsed.sort : "lifetime",
      playedFilter:
        parsed.playedFilter === "played" || parsed.playedFilter === "never"
          ? parsed.playedFilter
          : "all",
      appTypeFilter:
        parsed.appTypeFilter === "game" || parsed.appTypeFilter === "app"
          ? parsed.appTypeFilter
          : "all",
      // Keep only finite integers — drops NaN, strings, or anything else an
      // older persisted shape might smuggle through.
      selectedTagIds: Array.isArray(parsed.selectedTagIds)
        ? parsed.selectedTagIds.filter(
            (x): x is number => typeof x === "number" && Number.isInteger(x)
          )
        : [],
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
