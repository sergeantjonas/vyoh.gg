import { describe, expect, it } from "vitest";
import { LOL_PROFILE_TAB, LOL_STRIP_TABS } from "./strip-tabs";

describe("LOL_STRIP_TABS", () => {
  it("renders no Profile tab; the identity link covers the landing route", () => {
    expect(LOL_STRIP_TABS.map((t) => t.label)).toEqual([
      "Matches",
      "Trends",
      "Champions",
    ]);
    expect(LOL_STRIP_TABS.map((t): string => t.to)).not.toContain(LOL_PROFILE_TAB.to);
  });
});
