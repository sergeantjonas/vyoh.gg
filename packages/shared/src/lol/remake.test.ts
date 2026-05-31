import { describe, expect, it } from "vitest";
import { REMAKE_DURATION_S, isRemakeMatch } from "./remake.ts";

describe("isRemakeMatch", () => {
  it("requires both the early-surrender flag and a duration under the threshold", () => {
    expect(isRemakeMatch(120, true)).toBe(true);
    expect(isRemakeMatch(120, false)).toBe(false);
    expect(isRemakeMatch(900, true)).toBe(false);
  });

  it("uses strict less-than at the 210s boundary (Season 2 inting-surrender)", () => {
    expect(isRemakeMatch(REMAKE_DURATION_S - 1, true)).toBe(true);
    expect(isRemakeMatch(REMAKE_DURATION_S, true)).toBe(false);
    expect(isRemakeMatch(REMAKE_DURATION_S + 1, true)).toBe(false);
  });
});
