import { describe, expect, it } from "vitest";
import { platformToRegional } from "./regions";

describe("platformToRegional", () => {
  it("maps euw1 to europe", () => {
    expect(platformToRegional("euw1")).toBe("europe");
  });

  it("maps na1 to americas", () => {
    expect(platformToRegional("na1")).toBe("americas");
  });

  it("maps kr to asia", () => {
    expect(platformToRegional("kr")).toBe("asia");
  });

  it("maps oc1 to sea", () => {
    expect(platformToRegional("oc1")).toBe("sea");
  });

  it("is case-insensitive", () => {
    expect(platformToRegional("EUW1")).toBe("europe");
  });

  it("throws on unknown platform", () => {
    expect(() => platformToRegional("xyz")).toThrow(/xyz/);
  });
});
