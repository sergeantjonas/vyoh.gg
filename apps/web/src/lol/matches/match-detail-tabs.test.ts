import { describe, expect, it } from "vitest";
import {
  type MatchDetailTabId,
  activeMatchDetailTab,
  buildMatchDetailSectionTabs,
} from "./match-detail-tabs";

const SLUG = "ahri";
const ID = "EUW1_123";

describe("activeMatchDetailTab", () => {
  const cases: Array<[string, MatchDetailTabId]> = [
    [`/lol/${SLUG}/matches/${ID}`, "recap"],
    [`/lol/${SLUG}/matches/${ID}/recap`, "recap"],
    [`/lol/${SLUG}/matches/${ID}/your-game`, "your-game"],
    [`/lol/${SLUG}/matches/${ID}/review`, "review"],
    [`/lol/${SLUG}/matches/${ID}/timeline`, "timeline"],
  ];

  it.each(cases)("maps %s → %s", (path, expected) => {
    expect(activeMatchDetailTab(path, ID)).toBe(expected);
  });

  it("falls back to recap for an unknown trailing segment", () => {
    expect(activeMatchDetailTab(`/lol/${SLUG}/matches/${ID}/bogus`, ID)).toBe("recap");
  });

  it("tolerates a trailing slash", () => {
    expect(activeMatchDetailTab(`/lol/${SLUG}/matches/${ID}/timeline/`, ID)).toBe(
      "timeline"
    );
  });
});

describe("buildMatchDetailSectionTabs", () => {
  it("returns the four detail tabs in order, all routing under the match id", () => {
    const tabs = buildMatchDetailSectionTabs({
      accountSlug: SLUG,
      matchId: ID,
      activeTabId: "recap",
    });
    expect(tabs.map((t) => t.label)).toEqual([
      "Recap",
      "Your game",
      "Review",
      "Timeline",
    ]);
    for (const tab of tabs) {
      expect(tab.params).toEqual({ accountSlug: SLUG, matchId: ID });
      // Detail sub-tabs replace history so the whole page is one back-entry.
      expect(tab.replace).toBe(true);
    }
  });

  it("marks exactly the active tab", () => {
    const tabs = buildMatchDetailSectionTabs({
      accountSlug: SLUG,
      matchId: ID,
      activeTabId: "review",
    });
    expect(tabs.filter((t) => t.active).map((t) => t.label)).toEqual(["Review"]);
  });
});
