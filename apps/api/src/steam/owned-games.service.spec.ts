import { describe, expect, it } from "vitest";
import { diffOwnedGames } from "./owned-games.service";
import type { SteamOwnedGameRaw } from "./types";

function game(appid: number, name = `Game ${appid}`): SteamOwnedGameRaw {
  return { appid, name, playtime_forever: 0 };
}

describe("diffOwnedGames", () => {
  it("flags every game as added when the previous set is empty", () => {
    const diff = diffOwnedGames([game(1), game(2)], []);
    expect(diff).toEqual({
      added: [1, 2],
      persisted: [],
      reappeared: [],
      removed: [],
    });
  });

  it("flags overlap as persisted, new ids as added, gone ids as removed", () => {
    const previous = [
      { appid: 1, removedAt: null },
      { appid: 2, removedAt: null },
    ];
    const diff = diffOwnedGames([game(2), game(3)], previous);
    expect(diff).toEqual({
      added: [3],
      persisted: [2],
      reappeared: [],
      removed: [1],
    });
  });

  it("classifies a previously-removed game returning as reappeared, not added", () => {
    const previous = [{ appid: 1, removedAt: new Date("2026-01-01") }];
    const diff = diffOwnedGames([game(1)], previous);
    expect(diff).toEqual({
      added: [],
      persisted: [],
      reappeared: [1],
      removed: [],
    });
  });

  it("does not re-flag an already-removed game as removed again", () => {
    const previous = [
      { appid: 1, removedAt: null },
      { appid: 2, removedAt: new Date("2026-01-01") },
    ];
    const diff = diffOwnedGames([game(1)], previous);
    expect(diff.removed).toEqual([]);
    expect(diff.persisted).toEqual([1]);
  });
});
