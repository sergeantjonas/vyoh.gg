import { describe, expect, it } from "vitest";
import {
  achievementIconCandidates,
  composeAchievementIconUrl,
} from "./achievement-icon-url";

describe("composeAchievementIconUrl", () => {
  it("stores the canonical URL on the community_assets root", () => {
    expect(composeAchievementIconUrl(42, "abc.jpg")).toBe(
      "https://shared.akamai.steamstatic.com/community_assets/images/apps/42/abc.jpg"
    );
  });
});

describe("achievementIconCandidates", () => {
  it("returns every known root in order with no duplicate when the stored URL is a known root", () => {
    const stored = composeAchievementIconUrl(42, "abc.jpg");
    const chain = achievementIconCandidates(42, stored);
    expect(chain[0]).toBe(stored);
    expect(chain).toHaveLength(3);
    expect(new Set(chain).size).toBe(3);
  });

  it("appends an unknown stored host after the known roots", () => {
    const chain = achievementIconCandidates(42, "https://example.com/x/abc.jpg");
    expect(chain).toHaveLength(4);
    expect(chain.at(-1)).toBe("https://example.com/x/abc.jpg");
    expect(chain[0]).toBe(
      "https://shared.akamai.steamstatic.com/community_assets/images/apps/42/abc.jpg"
    );
  });

  it("drops a query string before deriving the filename", () => {
    const chain = achievementIconCandidates(42, "https://example.com/x/abc.jpg?t=1");
    expect(chain[0]).toBe(
      "https://shared.akamai.steamstatic.com/community_assets/images/apps/42/abc.jpg"
    );
    expect(chain.at(-1)).toBe("https://example.com/x/abc.jpg?t=1");
  });

  it("falls back to the stored URL alone when no filename can be derived", () => {
    expect(achievementIconCandidates(42, "https://example.com/")).toEqual([
      "https://example.com/",
    ]);
  });
});
