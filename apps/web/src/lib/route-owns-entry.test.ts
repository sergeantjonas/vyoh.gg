import { describe, expect, it } from "vitest";

import { routeOwnsEntry } from "./route-owns-entry";

describe("routeOwnsEntry", () => {
  it("returns false on an empty match chain (no routes resolved yet)", () => {
    expect(routeOwnsEntry([])).toBe(false);
  });

  it("returns false when no match in the chain declares staticData.ownsEntry", () => {
    expect(
      routeOwnsEntry([
        { staticData: {} },
        { staticData: {} },
        {}, // no staticData at all (root route)
      ])
    ).toBe(false);
  });

  it("returns true when the leaf route declares ownsEntry: true", () => {
    expect(
      routeOwnsEntry([{ staticData: {} }, { staticData: { ownsEntry: true } }])
    ).toBe(true);
  });

  it("returns true when a parent route declares ownsEntry (children inherit the claim)", () => {
    expect(
      routeOwnsEntry([
        { staticData: {} },
        { staticData: { ownsEntry: true } },
        { staticData: {} }, // leaf, no claim of its own
      ])
    ).toBe(true);
  });

  it("treats a truthy-but-non-true ownsEntry value as not owning entry (explicit-opt-in only)", () => {
    expect(routeOwnsEntry([{ staticData: { ownsEntry: 1 } }])).toBe(false);
    expect(routeOwnsEntry([{ staticData: { ownsEntry: "yes" } }])).toBe(false);
  });

  it("treats explicit ownsEntry: false as not owning entry", () => {
    expect(routeOwnsEntry([{ staticData: { ownsEntry: false } }])).toBe(false);
  });
});
