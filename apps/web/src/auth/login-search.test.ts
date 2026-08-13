import { describe, expect, it } from "vitest";
import { isLoginError, safeNext } from "./login-search";

describe("isLoginError", () => {
  it("accepts exactly the three the callback emits", () => {
    expect(isLoginError("state")).toBe(true);
    expect(isLoginError("github")).toBe(true);
    expect(isLoginError("forbidden")).toBe(true);
  });

  it("rejects anything else, including shapes that are not strings", () => {
    // The value is rendered as page copy, so this is what stops a crafted
    // /login?error=… from putting arbitrary text on the page.
    expect(isLoginError("<script>alert(1)</script>")).toBe(false);
    expect(isLoginError("")).toBe(false);
    expect(isLoginError(undefined)).toBe(false);
    expect(isLoginError(null)).toBe(false);
    expect(isLoginError(42)).toBe(false);
    expect(isLoginError(["state"])).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps a same-site path", () => {
    expect(safeNext("/status")).toBe("/status");
    expect(safeNext("/lol/ahri/matches?queue=420")).toBe("/lol/ahri/matches?queue=420");
  });

  it("drops anything that could leave the site", () => {
    // The value ends up in the login button's href, so an absolute or
    // protocol-relative URL here would point the sign-in flow off-site.
    expect(safeNext("https://evil.example")).toBeUndefined();
    expect(safeNext("//evil.example")).toBeUndefined();
    expect(safeNext("/\\evil.example")).toBeUndefined();
    expect(safeNext("javascript:alert(1)")).toBeUndefined();
  });

  it("drops header-injection and empty shapes", () => {
    expect(safeNext("/status\r\nSet-Cookie: x=1")).toBeUndefined();
    expect(safeNext("")).toBeUndefined();
    expect(safeNext(undefined)).toBeUndefined();
    expect(safeNext(7)).toBeUndefined();
  });
});
