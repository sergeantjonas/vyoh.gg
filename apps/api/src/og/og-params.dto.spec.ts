import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { OgParamsDto } from "./og-params.dto";

function fail(params: object): string[] {
  return validateSync(plainToInstance(OgParamsDto, params)).map((e) => e.property);
}

describe("OgParamsDto", () => {
  it("accepts a valid slug + Riot match id", () => {
    expect(fail({ slug: "jonas-euw", matchId: "EUW1_12345" })).toEqual([]);
  });

  it("rejects an empty slug", () => {
    expect(fail({ slug: "", matchId: "EUW1_12345" })).toContain("slug");
  });

  it("rejects malformed match ids", () => {
    expect(fail({ slug: "jonas-euw", matchId: "12345" })).toContain("matchId");
    expect(fail({ slug: "jonas-euw", matchId: "EUW1-12345" })).toContain("matchId");
    expect(fail({ slug: "jonas-euw", matchId: "EUW1_" })).toContain("matchId");
    expect(fail({ slug: "jonas-euw", matchId: "euw1_12345" })).toContain("matchId");
  });
});
