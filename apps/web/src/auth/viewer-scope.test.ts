import { describe, expect, it } from "vitest";
import { viewerScope, viewerScopedQuery } from "./viewer-scope";

describe("viewerScope", () => {
  it("separates the owner's projection from the public one", () => {
    expect(viewerScope(true)).toBe("owner");
    expect(viewerScope(false)).toBe("public");
    expect(viewerScope(true)).not.toBe(viewerScope(false));
  });

  // SSR primes the public key because a loader cannot see the visitor's cookie.
  // A hook that read the same key the owner writes would serve one of them the
  // other's body, so the scope has to be part of the key, not a fetch detail.
  it("keys the projection SSR primes as public", () => {
    expect(viewerScope(false)).toBe("public");
  });
});

describe("viewerScopedQuery", () => {
  // The viewer query resolves a tick after hydration, so the key changes under
  // an already-mounted component. Without placeholder data every Steam surface
  // falls back to its skeleton for one round-trip on each owner load.
  it("keeps the previous key's data on screen through the scope flip", () => {
    expect(viewerScopedQuery.placeholderData).toBeTypeOf("function");
    expect(viewerScopedQuery.placeholderData({ games: [] })).toEqual({ games: [] });
  });
});
