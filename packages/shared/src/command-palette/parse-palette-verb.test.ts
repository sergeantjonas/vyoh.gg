import { describe, expect, it } from "vitest";
import { parsePaletteVerb } from "./parse-palette-verb.ts";

describe("parsePaletteVerb", () => {
  it("returns null on empty input", () => {
    expect(parsePaletteVerb("")).toBeNull();
    expect(parsePaletteVerb("   ")).toBeNull();
  });

  it("returns null when no verb head matches", () => {
    expect(parsePaletteVerb("patches")).toBeNull();
    expect(parsePaletteVerb("nidalee")).toBeNull();
    expect(parsePaletteVerb("with:nidalee")).toBeNull();
  });

  it("parses bare /patches", () => {
    expect(parsePaletteVerb("/patches")).toEqual({
      kind: "patches",
      version: null,
      asSlug: null,
    });
  });

  it("is case-insensitive on the verb head", () => {
    expect(parsePaletteVerb("/PATCHES")).toEqual({
      kind: "patches",
      version: null,
      asSlug: null,
    });
  });

  it("parses /patches <version> as MAJOR.MINOR", () => {
    expect(parsePaletteVerb("/patches 25.10")).toEqual({
      kind: "patches",
      version: "25.10",
      asSlug: null,
    });
  });

  it("parses /patches <version> as MAJOR.MINOR.PATCH", () => {
    expect(parsePaletteVerb("/patches 14.20.1")).toEqual({
      kind: "patches",
      version: "14.20.1",
      asSlug: null,
    });
  });

  it("parses /patches @<slug>", () => {
    expect(parsePaletteVerb("/patches @jonas-eune")).toEqual({
      kind: "patches",
      version: null,
      asSlug: "jonas-eune",
    });
  });

  it("parses /patches <version> @<slug>", () => {
    expect(parsePaletteVerb("/patches 25.10 @jonas-eune")).toEqual({
      kind: "patches",
      version: "25.10",
      asSlug: "jonas-eune",
    });
  });

  it("accepts version and slug in either order", () => {
    expect(parsePaletteVerb("/patches @jonas-eune 25.10")).toEqual({
      kind: "patches",
      version: "25.10",
      asSlug: "jonas-eune",
    });
  });

  it("ignores trailing tokens that match neither a version nor a slug", () => {
    expect(parsePaletteVerb("/patches 25")).toEqual({
      kind: "patches",
      version: null,
      asSlug: null,
    });
    expect(parsePaletteVerb("/patches foo")).toEqual({
      kind: "patches",
      version: null,
      asSlug: null,
    });
  });

  it("last-wins on multiple version or slug tokens", () => {
    expect(parsePaletteVerb("/patches 25.09 25.10")).toEqual({
      kind: "patches",
      version: "25.10",
      asSlug: null,
    });
    expect(parsePaletteVerb("/patches @a @b")).toEqual({
      kind: "patches",
      version: null,
      asSlug: "b",
    });
  });
});
