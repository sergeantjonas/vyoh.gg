import { describe, expect, it } from "vitest";
import { topLevelScope } from "./top-level-scope";

describe("topLevelScope", () => {
  it("returns '/' for the root path", () => {
    expect(topLevelScope("/")).toBe("/");
  });

  it("returns '/' for an empty string", () => {
    expect(topLevelScope("")).toBe("/");
  });

  it("returns '/<first-segment>' for nested paths", () => {
    expect(topLevelScope("/lol/jonas-euw")).toBe("/lol");
    expect(topLevelScope("/steam/library/440")).toBe("/steam");
    expect(topLevelScope("/status")).toBe("/status");
  });

  it("ignores leading and trailing slashes", () => {
    expect(topLevelScope("//lol//")).toBe("/lol");
  });
});
