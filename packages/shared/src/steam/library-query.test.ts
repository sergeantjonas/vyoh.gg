import { describe, expect, it } from "vitest";
import { kebabCase, nameMatchesQuery, parseSteamLibraryQuery } from "./library-query.ts";

describe("parseSteamLibraryQuery", () => {
  it("returns empty fields for an empty input", () => {
    expect(parseSteamLibraryQuery("")).toEqual({
      devs: [],
      pubs: [],
      franchises: [],
      freeText: "",
    });
  });

  it("collects dev: / pub: / franchise: tokens", () => {
    const parsed = parseSteamLibraryQuery(
      "dev:from-software pub:playstation franchise:resident-evil"
    );
    expect(parsed.devs).toEqual(["from-software"]);
    expect(parsed.pubs).toEqual(["playstation"]);
    expect(parsed.franchises).toEqual(["resident-evil"]);
    expect(parsed.freeText).toBe("");
  });

  it("unions multi-occurrence verbs of the same kind", () => {
    const parsed = parseSteamLibraryQuery("dev:from-software dev:capcom");
    expect(parsed.devs).toEqual(["from-software", "capcom"]);
  });

  it("drops verb tokens with no value", () => {
    const parsed = parseSteamLibraryQuery("dev: pub:capcom franchise:");
    expect(parsed.devs).toEqual([]);
    expect(parsed.pubs).toEqual(["capcom"]);
    expect(parsed.franchises).toEqual([]);
  });

  it("normalises case and treats whitespace as delimiter", () => {
    const parsed = parseSteamLibraryQuery("  DEV:FromSoftware   nightreign  ");
    expect(parsed.devs).toEqual(["fromsoftware"]);
    expect(parsed.freeText).toBe("nightreign");
  });

  it("preserves freeText tokens not matching any verb prefix", () => {
    const parsed = parseSteamLibraryQuery("dev:capcom devil may cry");
    expect(parsed.devs).toEqual(["capcom"]);
    expect(parsed.freeText).toBe("devil may cry");
  });
});

describe("kebabCase", () => {
  it("lowercases and replaces runs of non-alphanumerics with single hyphens", () => {
    expect(kebabCase("FromSoftware Inc.")).toBe("fromsoftware-inc");
    expect(kebabCase("PlayStation Publishing LLC")).toBe("playstation-publishing-llc");
    expect(kebabCase("  Resident Evil 4  ")).toBe("resident-evil-4");
  });

  it("returns empty string for an all-punctuation input", () => {
    expect(kebabCase("---")).toBe("");
  });
});

describe("nameMatchesQuery", () => {
  it("returns true when the query is empty", () => {
    expect(nameMatchesQuery(["FromSoftware Inc."], "")).toBe(true);
  });

  it("matches by slug substring on either side", () => {
    expect(nameMatchesQuery(["FromSoftware Inc."], "from-software")).toBe(true);
    expect(nameMatchesQuery(["FromSoftware Inc."], "soft")).toBe(true);
    expect(nameMatchesQuery(["Capcom Co., Ltd."], "capcom")).toBe(true);
  });

  it("returns false when no name slug contains the needle", () => {
    expect(nameMatchesQuery(["Capcom"], "from-software")).toBe(false);
  });

  it("returns false for an empty names array (no enrichment yet)", () => {
    expect(nameMatchesQuery([], "capcom")).toBe(false);
  });
});
