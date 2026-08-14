import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import {
  CreateLolAccountDto,
  CreateSteamAccountDto,
  DeleteLolAccountQueryDto,
  LolAccountSlugParamDto,
  UpdateLolAccountDto,
} from "./admin-accounts.dto";

// Which fields the global `ValidationPipe` would reject, run with the same
// options `main.ts` configures it with.
function failedFields<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>
): string[] {
  const errors = validateSync(plainToInstance(cls, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property).sort();
}

const VALID_CREATE = {
  slug: "agurin",
  gameName: "Agurin",
  tagLine: "EUW",
  region: "euw1",
};

describe("CreateLolAccountDto", () => {
  it("accepts a well-formed body", () => {
    expect(failedFields(CreateLolAccountDto, VALID_CREATE)).toEqual([]);
  });

  it("rejects slugs that would break their own routes", () => {
    // The slug is a URL path segment and the row's primary key, so anything that
    // needs escaping produces an account whose pages resolve to nothing.
    for (const slug of ["Agurin", "a/b", "with space", "-leading", "a".repeat(31), ""]) {
      expect(
        failedFields(CreateLolAccountDto, { ...VALID_CREATE, slug }),
        `slug "${slug}" should be rejected`
      ).toEqual(["slug"]);
    }
  });

  it("rejects a region outside the platform list", () => {
    expect(failedFields(CreateLolAccountDto, { ...VALID_CREATE, region: "euw" })).toEqual(
      ["region"]
    );
    expect(
      failedFields(CreateLolAccountDto, { ...VALID_CREATE, region: "EUW1" })
    ).toEqual(["region"]);
  });

  it("rejects an unknown field rather than dropping it", () => {
    // Matches the global pipe's `forbidNonWhitelisted`: a client sending
    // `hiddenAt` should be told the api doesn't take it, not have it ignored.
    expect(
      failedFields(CreateLolAccountDto, { ...VALID_CREATE, hiddenAt: "2026-01-01" })
    ).toEqual(["hiddenAt"]);
  });
});

describe("UpdateLolAccountDto", () => {
  it("accepts any subset of the four flags", () => {
    expect(failedFields(UpdateLolAccountDto, {})).toEqual([]);
    expect(failedFields(UpdateLolAccountDto, { hidden: true })).toEqual([]);
    expect(
      failedFields(UpdateLolAccountDto, {
        isOwner: true,
        isPrimary: false,
        hidden: false,
        syncPaused: true,
      })
    ).toEqual([]);
  });

  it("rejects a stringified boolean", () => {
    // The flags arrive in a JSON body, where `true` is available. Coercing
    // `"false"` would make the string truthy and hide an account that was meant
    // to stay visible.
    expect(failedFields(UpdateLolAccountDto, { hidden: "true" })).toEqual(["hidden"]);
  });

  it("refuses to re-point a row at another identity", () => {
    // Slug, Riot ID, and region are immutable in v1: a rename needs redirect
    // handling and a re-point would silently re-attribute synced history.
    expect(failedFields(UpdateLolAccountDto, { slug: "other" })).toEqual(["slug"]);
    expect(failedFields(UpdateLolAccountDto, { region: "na1" })).toEqual(["region"]);
  });
});

describe("LolAccountSlugParamDto", () => {
  it("applies the same slug shape as create", () => {
    expect(failedFields(LolAccountSlugParamDto, { slug: "ahri" })).toEqual([]);
    expect(failedFields(LolAccountSlugParamDto, { slug: "../etc" })).toEqual(["slug"]);
  });
});

describe("DeleteLolAccountQueryDto", () => {
  it("takes force as an explicit string, absent by default", () => {
    expect(failedFields(DeleteLolAccountQueryDto, {})).toEqual([]);
    expect(failedFields(DeleteLolAccountQueryDto, { force: "true" })).toEqual([]);
    // Not coerced: `force=1` arriving as `true` is the wrong failure mode for
    // the one destructive route in the module.
    expect(failedFields(DeleteLolAccountQueryDto, { force: "1" })).toEqual(["force"]);
    expect(failedFields(DeleteLolAccountQueryDto, { force: "yes" })).toEqual(["force"]);
  });
});

describe("CreateSteamAccountDto", () => {
  it("takes a 17-digit id and an optional owner flag", () => {
    expect(
      failedFields(CreateSteamAccountDto, { steamId64: "76561198000000001" })
    ).toEqual([]);
    expect(
      failedFields(CreateSteamAccountDto, {
        steamId64: "76561198000000001",
        isOwner: false,
      })
    ).toEqual([]);
  });

  it("rejects ids that aren't 17 digits", () => {
    for (const steamId64 of [
      "7656119800000000",
      "765611980000000012",
      "abcdefghijklmnopq",
    ]) {
      expect(failedFields(CreateSteamAccountDto, { steamId64 })).toEqual(["steamId64"]);
    }
  });
});
