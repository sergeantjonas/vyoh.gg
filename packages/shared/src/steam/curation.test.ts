import { describe, expect, it } from "vitest";
import {
  NO_CURATION,
  type SteamCurationSets,
  curationForOwner,
  excludeHiddenGames,
  excludeUnfeaturedGames,
  isHiddenGame,
} from "./curation.ts";

const HIDDEN = 1091500;
const UNFEATURED = 1034140;
const PLAIN = 570;

function curation(): SteamCurationSets {
  return { hidden: new Set([HIDDEN]), unfeatured: new Set([UNFEATURED]) };
}

const GAMES = [{ appid: HIDDEN }, { appid: UNFEATURED }, { appid: PLAIN }];

describe("isHiddenGame", () => {
  it("is true only for the privacy axis", () => {
    expect(isHiddenGame(HIDDEN, curation())).toBe(true);
    expect(isHiddenGame(UNFEATURED, curation())).toBe(false);
    expect(isHiddenGame(PLAIN, curation())).toBe(false);
  });
});

describe("excludeHiddenGames", () => {
  it("drops hidden games and keeps unfeatured ones", () => {
    expect(excludeHiddenGames(GAMES, curation()).map((g) => g.appid)).toEqual([
      UNFEATURED,
      PLAIN,
    ]);
  });

  it("is a no-op against NO_CURATION", () => {
    expect(excludeHiddenGames(GAMES, NO_CURATION)).toHaveLength(GAMES.length);
  });

  it("preserves input order and the full row shape", () => {
    const rows = [
      { appid: PLAIN, name: "Dota 2", minutes: 12 },
      { appid: HIDDEN, name: "secret", minutes: 99 },
    ];
    expect(excludeHiddenGames(rows, curation())).toEqual([
      { appid: PLAIN, name: "Dota 2", minutes: 12 },
    ]);
  });
});

describe("excludeUnfeaturedGames", () => {
  // Hiding implies unfeaturing — a chapter names its subject, so this has to be
  // a superset of the privacy filter rather than a sibling of it.
  it("drops both axes", () => {
    expect(excludeUnfeaturedGames(GAMES, curation()).map((g) => g.appid)).toEqual([
      PLAIN,
    ]);
  });
});

describe("curationForOwner", () => {
  it("clears the privacy axis and keeps the editorial one", () => {
    const owner = curationForOwner(curation());
    expect(owner.hidden.size).toBe(0);
    expect(owner.unfeatured.has(UNFEATURED)).toBe(true);
  });

  it("shows the owner their hidden games but still not as a chapter", () => {
    const owner = curationForOwner(curation());
    expect(excludeHiddenGames(GAMES, owner)).toHaveLength(3);
    expect(excludeUnfeaturedGames(GAMES, owner).map((g) => g.appid)).toEqual([
      HIDDEN,
      PLAIN,
    ]);
  });
});
