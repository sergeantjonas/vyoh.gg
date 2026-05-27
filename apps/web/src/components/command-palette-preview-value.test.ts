import { describe, expect, it } from "vitest";
import { parsePaletteValue } from "./command-palette-preview-value";

describe("parsePaletteValue", () => {
  it("recognises champion sentinel", () => {
    expect(parsePaletteValue("champion:jinx jinx jinx")).toEqual({
      type: "champion",
      alias: "jinx",
    });
  });

  it("preserves alias casing", () => {
    expect(parsePaletteValue("champion:JarvanIV jarvaniv jarvan iv")).toEqual({
      type: "champion",
      alias: "JarvanIV",
    });
  });

  it("recognises match sentinel with region-prefixed match id", () => {
    expect(parsePaletteValue("match:NA1_4123456789 jinx wins ranked")).toEqual({
      type: "match",
      matchId: "NA1_4123456789",
    });
  });

  it("recognises steam-game sentinel with numeric appid", () => {
    expect(parsePaletteValue("steam-game:730 counter-strike 730")).toEqual({
      type: "steam-game",
      appid: "730",
    });
  });

  it("recognises account sentinel (preserves the existing chord prefix)", () => {
    expect(parsePaletteValue("account:zoe-eune Zoe EUNE")).toEqual({
      type: "account",
      slug: "zoe-eune",
    });
  });

  it("returns 'other' for un-prefixed values (pages, tabs, recents)", () => {
    expect(parsePaletteValue("home")).toEqual({ type: "other" });
    expect(parsePaletteValue("matches /lol/foo/matches")).toEqual({ type: "other" });
    expect(parsePaletteValue("")).toEqual({ type: "other" });
  });
});
