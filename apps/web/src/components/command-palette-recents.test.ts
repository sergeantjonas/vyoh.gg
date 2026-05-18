import { beforeEach, describe, expect, it } from "vitest";
import {
  type RecentItem,
  deriveRecentsScope,
  loadRecents,
  recordRecent,
} from "./command-palette-recents";

const item = (path: string, label = path): RecentItem => ({
  path,
  label,
  kind: "page",
});

describe("deriveRecentsScope", () => {
  it("returns per-account scope for /lol/<slug>/...", () => {
    expect(deriveRecentsScope("/lol/jonas-euw")).toBe("lol:jonas-euw");
    expect(deriveRecentsScope("/lol/jonas-euw/matches/X_1")).toBe("lol:jonas-euw");
  });

  it("returns plain 'lol' scope for /lol index", () => {
    expect(deriveRecentsScope("/lol")).toBe("lol");
  });

  it("returns 'steam' scope for /steam routes", () => {
    expect(deriveRecentsScope("/steam")).toBe("steam");
    expect(deriveRecentsScope("/steam/library/440")).toBe("steam");
  });

  it("returns 'global' scope for / and unknown paths", () => {
    expect(deriveRecentsScope("/")).toBe("global");
    expect(deriveRecentsScope("/about")).toBe("global");
  });
});

describe("recordRecent + loadRecents", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists across calls", () => {
    recordRecent("global", item("/"));
    expect(loadRecents("global")).toEqual([item("/")]);
  });

  it("prepends new entries (most recent first)", () => {
    recordRecent("global", item("/a"));
    recordRecent("global", item("/b"));
    expect(loadRecents("global").map((r) => r.path)).toEqual(["/b", "/a"]);
  });

  it("deduplicates by path, keeping the most-recent occurrence at the top", () => {
    recordRecent("global", item("/a"));
    recordRecent("global", item("/b"));
    recordRecent("global", item("/a"));
    expect(loadRecents("global").map((r) => r.path)).toEqual(["/a", "/b"]);
  });

  it("caps at 5 entries", () => {
    for (const p of ["/1", "/2", "/3", "/4", "/5", "/6"]) {
      recordRecent("global", item(p));
    }
    const loaded = loadRecents("global");
    expect(loaded).toHaveLength(5);
    expect(loaded.map((r) => r.path)).toEqual(["/6", "/5", "/4", "/3", "/2"]);
  });

  it("isolates scopes — lol:jonas-euw and steam don't see each other", () => {
    recordRecent("lol:jonas-euw", item("/lol/jonas-euw"));
    recordRecent("steam", item("/steam"));
    expect(loadRecents("lol:jonas-euw").map((r) => r.path)).toEqual(["/lol/jonas-euw"]);
    expect(loadRecents("steam").map((r) => r.path)).toEqual(["/steam"]);
  });

  it("returns [] when the stored value is not valid JSON", () => {
    localStorage.setItem("vyoh:palette-recents:global", "{not json");
    expect(loadRecents("global")).toEqual([]);
  });

  it("filters out entries with unknown kind", () => {
    localStorage.setItem(
      "vyoh:palette-recents:global",
      JSON.stringify([
        { path: "/a", label: "A", kind: "page" },
        { path: "/b", label: "B", kind: "bogus" },
      ])
    );
    expect(loadRecents("global").map((r) => r.path)).toEqual(["/a"]);
  });
});
