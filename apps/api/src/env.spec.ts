import { afterEach, describe, expect, it } from "vitest";
import { requireEnv, resolveCorsOrigin } from "./env";

describe("requireEnv", () => {
  const originalValue = process.env.VYOH_ENV_SPEC;

  afterEach(() => {
    if (originalValue === undefined) Reflect.deleteProperty(process.env, "VYOH_ENV_SPEC");
    else process.env.VYOH_ENV_SPEC = originalValue;
  });

  it("returns the value when the env var is set", () => {
    process.env.VYOH_ENV_SPEC = "hello";
    expect(requireEnv("VYOH_ENV_SPEC")).toBe("hello");
  });

  it("throws a clear message when the env var is missing", () => {
    Reflect.deleteProperty(process.env, "VYOH_ENV_SPEC");
    expect(() => requireEnv("VYOH_ENV_SPEC")).toThrow(
      /Missing required env var: VYOH_ENV_SPEC/
    );
  });

  it("treats an empty string as missing", () => {
    process.env.VYOH_ENV_SPEC = "";
    expect(() => requireEnv("VYOH_ENV_SPEC")).toThrow(/Missing required env var/);
  });
});

describe("resolveCorsOrigin", () => {
  it("falls back to any localhost port when WEB_ORIGIN is unset", () => {
    const origin = resolveCorsOrigin(undefined);
    expect(origin).toBeInstanceOf(RegExp);
    expect(origin as RegExp).toSatisfy((re: RegExp) => re.test("http://localhost:2009"));
    expect(origin as RegExp).toSatisfy((re: RegExp) => !re.test("https://evil.example"));
  });

  it("returns a single configured origin", () => {
    expect(resolveCorsOrigin("https://vyoh.gg")).toEqual(["https://vyoh.gg"]);
  });

  it("splits a comma-separated list and trims it", () => {
    expect(resolveCorsOrigin("https://vyoh.gg, https://www.vyoh.gg")).toEqual([
      "https://vyoh.gg",
      "https://www.vyoh.gg",
    ]);
  });

  it.each(["", "   ", ",,"])(
    "treats %o as unset rather than as an empty allowlist",
    (value) => {
      expect(resolveCorsOrigin(value)).toBeInstanceOf(RegExp);
    }
  );
});
