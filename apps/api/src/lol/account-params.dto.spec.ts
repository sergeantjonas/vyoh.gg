import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { AccountParamsDto, ChampionAccountParamsDto } from "./account-params.dto";

function fail(params: object, ctor: typeof AccountParamsDto): string[] {
  return validateSync(plainToInstance(ctor, params)).map((e) => e.property);
}

describe("AccountParamsDto", () => {
  it("accepts a valid platform + Riot ID", () => {
    expect(
      fail({ region: "euw1", gameName: "Jonas", tagLine: "EUW" }, AccountParamsDto)
    ).toEqual([]);
  });

  it("rejects unknown regions (only the explicit platform whitelist is allowed)", () => {
    expect(
      fail({ region: "atlantis", gameName: "Jonas", tagLine: "EUW" }, AccountParamsDto)
    ).toContain("region");
  });

  it("accepts unicode names (Riot IDs include CJK, accents, ZWJ)", () => {
    expect(
      fail({ region: "kr", gameName: "한국유저", tagLine: "KR1" }, AccountParamsDto)
    ).toEqual([]);
  });

  it("rejects gameName too short (< 3) or too long (> 32)", () => {
    expect(
      fail({ region: "euw1", gameName: "ab", tagLine: "EUW" }, AccountParamsDto)
    ).toContain("gameName");
    expect(
      fail({ region: "euw1", gameName: "a".repeat(33), tagLine: "EUW" }, AccountParamsDto)
    ).toContain("gameName");
  });

  it("rejects gameName with disallowed characters (e.g. '#' or '/')", () => {
    expect(
      fail({ region: "euw1", gameName: "bad#name", tagLine: "EUW" }, AccountParamsDto)
    ).toContain("gameName");
    expect(
      fail({ region: "euw1", gameName: "bad/name", tagLine: "EUW" }, AccountParamsDto)
    ).toContain("gameName");
  });

  it("requires tagLine to be 3–5 alphanumeric chars", () => {
    expect(
      fail({ region: "euw1", gameName: "Jonas", tagLine: "EU" }, AccountParamsDto)
    ).toContain("tagLine");
    expect(
      fail({ region: "euw1", gameName: "Jonas", tagLine: "EUROPE" }, AccountParamsDto)
    ).toContain("tagLine");
    expect(
      fail({ region: "euw1", gameName: "Jonas", tagLine: "EU!" }, AccountParamsDto)
    ).toContain("tagLine");
  });
});

describe("ChampionAccountParamsDto", () => {
  it("accepts an alphabetic champion key", () => {
    expect(
      fail(
        { region: "euw1", gameName: "Jonas", tagLine: "EUW", championKey: "Ahri" },
        ChampionAccountParamsDto
      )
    ).toEqual([]);
  });

  it("rejects championKey that starts with a digit or contains special chars", () => {
    expect(
      fail(
        { region: "euw1", gameName: "Jonas", tagLine: "EUW", championKey: "123Ahri" },
        ChampionAccountParamsDto
      )
    ).toContain("championKey");
    expect(
      fail(
        { region: "euw1", gameName: "Jonas", tagLine: "EUW", championKey: "K'Sante" },
        ChampionAccountParamsDto
      )
    ).toContain("championKey");
  });

  it("inherits the AccountParamsDto rules", () => {
    expect(
      fail(
        { region: "atlantis", gameName: "Jonas", tagLine: "EUW", championKey: "Ahri" },
        ChampionAccountParamsDto
      )
    ).toContain("region");
  });
});
