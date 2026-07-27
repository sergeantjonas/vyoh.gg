import { describe, expect, it } from "vitest";
import { envOrigin } from "./env-origin";

const FALLBACK = "https://vyoh.gg";

describe("envOrigin", () => {
  it("uses a configured origin", () => {
    expect(envOrigin("https://staging.vyoh.gg", FALLBACK)).toBe(
      "https://staging.vyoh.gg"
    );
  });

  it.each([
    ["unset", undefined],
    ["an unpassed Docker ARG", ""],
    ["whitespace", "   "],
  ])("falls back when the value is %s", (_label, value) => {
    expect(envOrigin(value, FALLBACK)).toBe(FALLBACK);
  });

  it("strips a trailing slash so paths cannot compose into a double slash", () => {
    expect(envOrigin("https://api.vyoh.gg/", FALLBACK)).toBe("https://api.vyoh.gg");
    expect(envOrigin("https://api.vyoh.gg///", FALLBACK)).toBe("https://api.vyoh.gg");
  });

  it("strips a trailing slash off the fallback too", () => {
    expect(envOrigin(undefined, "https://vyoh.gg/")).toBe("https://vyoh.gg");
  });
});
