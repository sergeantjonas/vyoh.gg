import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEXT,
  type StateClaims,
  newNonce,
  safeNextPath,
  signState,
  verifyState,
} from "./oauth-state";

const SECRET = "test-hmac-key";
const NOW = 1_760_000_000_000;

const claims = (overrides: Partial<StateClaims> = {}): StateClaims => ({
  nonce: "nonce-value",
  next: "/status",
  exp: NOW + 60_000,
  ...overrides,
});

describe("signState / verifyState", () => {
  it("round-trips the claims it was given", () => {
    const token = signState(claims({ next: "/lol/ahri" }), SECRET);
    expect(verifyState(token, SECRET, NOW)).toEqual(claims({ next: "/lol/ahri" }));
  });

  it("rejects a token signed with a different secret", () => {
    const token = signState(claims(), "other-key");
    expect(verifyState(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signState(claims(), SECRET);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify(claims({ next: "/somewhere-else" }))
    ).toString("base64url");
    expect(payload).not.toBe(forged);
    expect(verifyState(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signState(claims({ exp: NOW }), SECRET);
    expect(verifyState(token, SECRET, NOW)).toBeNull();
  });

  it("returns null rather than throwing on malformed input", () => {
    expect(verifyState(undefined, SECRET, NOW)).toBeNull();
    expect(verifyState("", SECRET, NOW)).toBeNull();
    expect(verifyState("no-dot", SECRET, NOW)).toBeNull();
    expect(verifyState(".sig", SECRET, NOW)).toBeNull();
    // Correctly signed, but the payload is not a claims object.
    const notJson = Buffer.from("hello").toString("base64url");
    const token = signState(claims(), SECRET);
    expect(verifyState(`${notJson}.${token.split(".")[1]}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // `timingSafeEqual` throws on mismatched lengths — the length check has to
    // come first, and this is the case that proves it does.
    const token = signState(claims(), SECRET);
    expect(() => verifyState(`${token.split(".")[0]}.short`, SECRET, NOW)).not.toThrow();
    expect(verifyState(`${token.split(".")[0]}.short`, SECRET, NOW)).toBeNull();
  });

  it("mints a fresh nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
  });
});

describe("safeNextPath", () => {
  it("keeps a relative path", () => {
    expect(safeNextPath("/status")).toBe("/status");
    expect(safeNextPath("/lol/ahri/matches?tab=recap")).toBe(
      "/lol/ahri/matches?tab=recap"
    );
  });

  it("falls back for anything that could leave the site", () => {
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("https://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });

  it("falls back on header injection and on nothing at all", () => {
    expect(safeNextPath("/status\r\nSet-Cookie: x=1")).toBe(DEFAULT_NEXT);
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT);
    expect(safeNextPath(42)).toBe(DEFAULT_NEXT);
  });
});
