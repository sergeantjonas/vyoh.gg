import { describe, expect, it } from "vitest";
import { cookieOptions, parseCookieHeader } from "./cookies";

describe("parseCookieHeader", () => {
  it("reads a multi-cookie header", () => {
    expect(parseCookieHeader("a=1; vyoh_session=abc; b=2")).toEqual({
      a: "1",
      vyoh_session: "abc",
      b: "2",
    });
  });

  it("returns an empty object when there is no header", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });

  it("keeps the first of a duplicated name", () => {
    // A duplicate is how a cookie tossed from a sibling host arrives; browsers
    // send the narrower-path one first, so first-wins matches their resolution.
    expect(parseCookieHeader("vyoh_session=real; vyoh_session=tossed")).toEqual({
      vyoh_session: "real",
    });
  });

  it("percent-decodes values and survives a malformed escape", () => {
    expect(parseCookieHeader("next=%2Fstatus")).toEqual({ next: "/status" });
    expect(parseCookieHeader("next=%zz")).toEqual({ next: "%zz" });
  });

  it("skips fragments that are not name=value", () => {
    expect(parseCookieHeader("novalue; =orphan; a=1")).toEqual({ a: "1" });
  });

  it("keeps an empty value rather than dropping the cookie", () => {
    expect(parseCookieHeader("vyoh_session=")).toEqual({ vyoh_session: "" });
  });
});

describe("cookieOptions", () => {
  it("omits the domain when there is none, so localhost still gets the cookie", () => {
    expect(cookieOptions(1000, false, undefined)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 1000,
    });
  });

  it("carries the domain and the secure flag when configured", () => {
    expect(cookieOptions(1000, true, ".vyoh.gg")).toMatchObject({
      secure: true,
      domain: ".vyoh.gg",
    });
  });
});
