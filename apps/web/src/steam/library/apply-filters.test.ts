import type { SteamOwnedGame } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { applyLibraryFilters } from "./apply-filters";

function game(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 1,
    name: "Untitled",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds: [],
    ...overrides,
  } as unknown as SteamOwnedGame;
}

const baseOpts = {
  query: "",
  sort: "lifetime" as const,
  playedFilter: "all" as const,
  appTypeFilter: "all" as const,
  selectedTagIds: [] as number[],
};

describe("applyLibraryFilters", () => {
  it("returns games sorted by lifetime desc when sort=lifetime", () => {
    const games = [
      game({ appid: 1, playtimeForeverMinutes: 100 }),
      game({ appid: 2, playtimeForeverMinutes: 1000 }),
      game({ appid: 3, playtimeForeverMinutes: 500 }),
    ];
    const out = applyLibraryFilters(games, baseOpts);
    expect(out.map((g) => g.appid)).toEqual([2, 3, 1]);
  });

  it("sorts by 2-week playtime descending when sort=twoWeeks", () => {
    const games = [
      game({ appid: 1, playtime2WeeksMinutes: 30 }),
      game({ appid: 2, playtime2WeeksMinutes: null as unknown as number }),
      game({ appid: 3, playtime2WeeksMinutes: 60 }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, sort: "twoWeeks" });
    expect(out.map((g) => g.appid)).toEqual([3, 1, 2]);
  });

  it("sorts alphabetically case-insensitively when sort=name", () => {
    const games = [
      game({ appid: 1, name: "Banana" }),
      game({ appid: 2, name: "apple" }),
      game({ appid: 3, name: "cherry" }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, sort: "name" });
    expect(out.map((g) => g.name)).toEqual(["apple", "Banana", "cherry"]);
  });

  it("filters by case-insensitive substring match on name", () => {
    const games = [
      game({ appid: 1, name: "Team Fortress 2" }),
      game({ appid: 2, name: "Half-Life 2" }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, query: "FORTRESS" });
    expect(out.map((g) => g.appid)).toEqual([1]);
  });

  it("excludes never-played games when playedFilter=played", () => {
    const games = [
      game({ appid: 1, playtimeForeverMinutes: 0 }),
      game({ appid: 2, playtimeForeverMinutes: 10 }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, playedFilter: "played" });
    expect(out.map((g) => g.appid)).toEqual([2]);
  });

  it("excludes played games when playedFilter=never", () => {
    const games = [
      game({ appid: 1, playtimeForeverMinutes: 0 }),
      game({ appid: 2, playtimeForeverMinutes: 10 }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, playedFilter: "never" });
    expect(out.map((g) => g.appid)).toEqual([1]);
  });

  it("treats appType=null as 'game' under the game filter", () => {
    const games = [
      game({ appid: 1, appType: null as unknown as number }),
      game({ appid: 2, appType: 0 }),
      game({ appid: 3, appType: 6 }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, appTypeFilter: "game" });
    expect(out.map((g) => g.appid).sort()).toEqual([1, 2]);
  });

  it("includes only appType=6 (tools/apps) under the app filter", () => {
    const games = [
      game({ appid: 1, appType: 0 }),
      game({ appid: 2, appType: 6 }),
      game({ appid: 3, appType: null as unknown as number }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, appTypeFilter: "app" });
    expect(out.map((g) => g.appid)).toEqual([2]);
  });

  it("OR-matches games against any of the selected tag ids", () => {
    const games = [
      game({ appid: 1, tagIds: [10, 20] }),
      game({ appid: 2, tagIds: [30] }),
      game({ appid: 3, tagIds: [] }),
    ];
    const out = applyLibraryFilters(games, { ...baseOpts, selectedTagIds: [20, 30] });
    expect(out.map((g) => g.appid).sort()).toEqual([1, 2]);
  });

  it("returns the full list when selectedTagIds is empty", () => {
    const games = [game({ appid: 1 }), game({ appid: 2 })];
    expect(applyLibraryFilters(games, baseOpts)).toHaveLength(2);
  });
});
