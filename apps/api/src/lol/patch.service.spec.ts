import { describe, expect, it } from "vitest";
import { truncateVersion, wikiPageTitle } from "./patch.service";

describe("truncateVersion", () => {
  it("translates legacy season major to year-based (+10)", () => {
    expect(truncateVersion("16.10.1")).toBe("26.10");
    expect(truncateVersion("14.20.1")).toBe("24.20");
  });

  it("passes through when major already looks year-shaped (>= 20)", () => {
    expect(truncateVersion("26.10.1")).toBe("26.10");
  });

  it("returns input untouched when malformed", () => {
    expect(truncateVersion("notaversion")).toBe("notaversion");
    expect(truncateVersion("16")).toBe("16");
  });
});

describe("wikiPageTitle", () => {
  it("zero-pads single-digit minor to match wiki page naming", () => {
    expect(wikiPageTitle("26.9")).toBe("V26.09");
    expect(wikiPageTitle("26.1")).toBe("V26.01");
  });

  it("leaves two-digit minor untouched", () => {
    expect(wikiPageTitle("26.10")).toBe("V26.10");
  });
});
