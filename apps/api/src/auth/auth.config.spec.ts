import { describe, expect, it } from "vitest";
import { resolveAuthConfig } from "./auth.config";

const env = (overrides: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  OWNER_GITHUB_USER_ID: "10808486",
  GITHUB_OAUTH_CLIENT_ID: "client-id",
  GITHUB_OAUTH_CLIENT_SECRET: "client-secret",
  SESSION_SECRET: "hmac-key",
  SESSION_COOKIE_DOMAIN: "",
  ...overrides,
});

describe("resolveAuthConfig", () => {
  it("reads the owner id as a number", () => {
    expect(resolveAuthConfig(env(), "http://web.test").ownerGithubUserId).toBe(
      10_808_486
    );
  });

  it("leaves the cookie domain unset when it is empty", () => {
    // A Domain on a localhost cookie stops the browser sending it back, so
    // empty has to mean absent rather than an empty-string attribute.
    expect(resolveAuthConfig(env(), "http://web.test").cookieDomain).toBeUndefined();
    expect(
      resolveAuthConfig(env({ SESSION_COOKIE_DOMAIN: ".vyoh.gg" }), "http://web.test")
        .cookieDomain
    ).toBe(".vyoh.gg");
  });

  it("only marks cookies secure in production", () => {
    expect(resolveAuthConfig(env(), "http://web.test").secureCookies).toBe(false);
    expect(
      resolveAuthConfig(env({ NODE_ENV: "production" }), "https://vyoh.gg").secureCookies
    ).toBe(true);
  });

  it.each(["vyoh", "", "0", "-1", "12.5"])(
    "refuses %o as an owner id rather than matching nobody at login",
    (value) => {
      expect(() =>
        resolveAuthConfig(env({ OWNER_GITHUB_USER_ID: value }), "http://web.test")
      ).toThrow(/OWNER_GITHUB_USER_ID/);
    }
  );
});
