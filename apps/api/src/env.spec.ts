import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "./env";

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
