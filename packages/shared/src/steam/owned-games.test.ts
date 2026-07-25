import { describe, expect, it } from "vitest";
import { isSteamGameAppType } from "./owned-games.ts";

// Steam's appType 0 is "game"; other values cover Music, DLC and similar.
// Unenriched rows are null/undefined and deliberately count as games so newly
// synced apps don't vanish from default views before enrichment runs.
describe("isSteamGameAppType", () => {
  it("treats appType 0 as a game", () => {
    expect(isSteamGameAppType(0)).toBe(true);
  });

  it("treats unenriched rows as games", () => {
    expect(isSteamGameAppType(null)).toBe(true);
    expect(isSteamGameAppType(undefined)).toBe(true);
  });

  it("rejects non-game app types", () => {
    expect(isSteamGameAppType(6)).toBe(false);
    expect(isSteamGameAppType(1)).toBe(false);
  });
});
