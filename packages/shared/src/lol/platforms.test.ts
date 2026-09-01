import { describe, expect, it } from "vitest";
import { PLATFORMS } from "./platforms.ts";

describe("PLATFORMS", () => {
  it("is the one list both the api validator and the add-account form read", () => {
    expect(PLATFORMS).toContain("euw1");
    expect(PLATFORMS).toContain("na1");
    expect(PLATFORMS).toContain("kr");
  });

  it("holds unique lowercase routing values", () => {
    expect(new Set(PLATFORMS).size).toBe(PLATFORMS.length);
    for (const p of PLATFORMS) expect(p).toBe(p.toLowerCase());
  });
});
