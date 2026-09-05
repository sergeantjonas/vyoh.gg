import { describe, expect, it } from "vitest";

import { verdictPreview } from "../lol/champion-recap.ts";
import type { SteamAchievement, SteamGameAchievements } from "./achievements.ts";
import {
  STEAM_RECAP_RECENT_UNLOCKS_LIMIT,
  STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT,
  deriveSteamGameRecap,
  formatReleaseDateChip,
  verdictParagraphSteam,
} from "./game-recap.ts";
import type { SteamOwnedGame } from "./owned-games.ts";
import type { SteamScreenshotEntry } from "./screenshots.ts";

const NOW = new Date("2026-06-01T12:00:00Z");

function makeOwnedGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 367520,
    name: "Hollow Knight",
    playtimeForeverMinutes: 2800,
    playtime2WeeksMinutes: 360,
    assetUrlFormat: "https://example.test/${FILENAME}?t=12345",
    assetTimestamp: 12345,
    libraryCapsulePath: "library_capsule.jpg",
    libraryCapsule2xPath: "library_capsule_2x.jpg",
    libraryHeroPath: "library_hero.jpg",
    libraryHero2xPath: "library_hero_2x.jpg",
    headerPath: "header.jpg",
    heroCapsulePath: "hero_capsule.jpg",
    logoPath: "logo.png",
    appType: 0,
    tagIds: [1],
    rtimeLastPlayedAt: "2026-05-30T20:00:00Z",
    shortDescription: "Forge your own path in Hollow Knight!",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: true,
    platformLinux: true,
    platformVr: false,
    reviewSummary: null,
    gameRating: null,
    publisherNames: ["Team Cherry"],
    developerNames: ["Team Cherry"],
    franchiseNames: [],
    subjectXPercent: 50,
    subjectYPercent: 50,
    flipHero: false,
    dominantHex: "#1a1a2e",
    microtrailerWebm: null,
    microtrailerMp4: null,
    microtrailerPoster: null,
    microtrailerName: null,
    trailers: null,
    recentPlaytimeMinutes: [0, 0, 30, 45, 90, 120, 75],
    releaseDate: null,
    ...overrides,
  };
}

function makeAchievement(overrides: Partial<SteamAchievement>): SteamAchievement {
  return {
    apiName: overrides.apiName ?? "ACH_DEFAULT",
    displayName: overrides.displayName ?? "Default Achievement",
    description: overrides.description ?? "",
    hidden: overrides.hidden ?? false,
    unlockedAt: overrides.unlockedAt ?? null,
    globalPercent: overrides.globalPercent ?? null,
  };
}

function makeAchievements(
  achievements: SteamAchievement[] | null
): SteamGameAchievements {
  return {
    appid: 367520,
    achievements,
    lastSchemaCheckedAt: "2026-05-31T00:00:00Z",
    lastUnlocksCheckedAt: "2026-05-31T00:00:00Z",
    lastRarityCheckedAt: "2026-05-31T00:00:00Z",
    statsPrivateAt: null,
  };
}

const SCREENSHOTS: SteamScreenshotEntry[] = [
  { filename: "steam/apps/367520/ss_a.jpg?t=1", ordinal: 0 },
  { filename: "steam/apps/367520/ss_b.jpg?t=1", ordinal: 1 },
];

describe("deriveSteamGameRecap", () => {
  it("returns zero-state when ownedGame is null", () => {
    const recap = deriveSteamGameRecap(367520, null, null, [], NOW);
    expect(recap).toEqual({
      appid: 367520,
      name: "",
      assetTimestamp: null,
      hasLibraryHero: false,
      flipHero: false,
      subjectXPercent: null,
      subjectYPercent: null,
      hasLogo: false,
      dominantHex: null,
      shortDescription: null,
      playtimeForeverMinutes: 0,
      playtime2WeeksMinutes: null,
      lastPlayedAt: null,
      recentPlaytimeMinutes: [],
      achievementsTotal: null,
      achievementsUnlocked: 0,
      completionPct: null,
      recentUnlocks: [],
      unlocksPerWeek: [],
      medianAchievementRarity: null,
      daysToCompletion: null,
      remainingRarestUnlocks: [],
      playtimeTrend: null,
      standoutUnlock: null,
      screenshots: [],
      microtrailerWebm: null,
      microtrailerMp4: null,
      microtrailerPoster: null,
      microtrailerName: null,
      ageBucket: null,
      releaseDate: null,
    });
  });

  it("forwards owned-game fields and asset bookkeeping", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    expect(recap.appid).toBe(367520);
    expect(recap.name).toBe("Hollow Knight");
    expect(recap.assetTimestamp).toBe(12345);
    expect(recap.hasLibraryHero).toBe(true);
    expect(recap.flipHero).toBe(false);
    expect(recap.subjectXPercent).toBe(50);
    expect(recap.subjectYPercent).toBe(50);
    expect(recap.hasLogo).toBe(true);
    expect(recap.dominantHex).toBe("#1a1a2e");
    expect(recap.shortDescription).toBe("Forge your own path in Hollow Knight!");
    expect(recap.playtimeForeverMinutes).toBe(2800);
    expect(recap.playtime2WeeksMinutes).toBe(360);
    expect(recap.recentPlaytimeMinutes).toEqual([0, 0, 30, 45, 90, 120, 75]);
    expect(recap.screenshots).toHaveLength(2);
  });

  it("forwards a non-default subject anchor for face-detected hero art", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ subjectXPercent: 35, subjectYPercent: 28 }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    expect(recap.subjectXPercent).toBe(35);
    expect(recap.subjectYPercent).toBe(28);
  });

  it("flips hasLogo to false when the enrichment row is missing a logoPath", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ logoPath: null }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    expect(recap.hasLogo).toBe(false);
  });

  it("hides achievementsTotal when the schema is null", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(null),
      SCREENSHOTS,
      NOW
    );
    expect(recap.achievementsTotal).toBeNull();
    expect(recap.achievementsUnlocked).toBe(0);
    expect(recap.completionPct).toBeNull();
    expect(recap.recentUnlocks).toEqual([]);
    expect(recap.standoutUnlock).toBeNull();
  });

  it("computes completionPct from unlocked / total", () => {
    const achievements = [
      makeAchievement({ apiName: "A", unlockedAt: "2026-05-30T00:00:00Z" }),
      makeAchievement({ apiName: "B", unlockedAt: "2026-05-29T00:00:00Z" }),
      makeAchievement({ apiName: "C", unlockedAt: null }),
      makeAchievement({ apiName: "D", unlockedAt: null }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    expect(recap.achievementsTotal).toBe(4);
    expect(recap.achievementsUnlocked).toBe(2);
    expect(recap.completionPct).toBe(0.5);
  });

  it("caps recentUnlocks at the limit and orders newest-first", () => {
    const achievements = Array.from({ length: 8 }, (_, i) =>
      makeAchievement({
        apiName: `ACH_${i}`,
        displayName: `Achievement ${i}`,
        // Ascending timestamps; the deriver should reverse to newest-first.
        unlockedAt: `2026-05-${String(20 + i).padStart(2, "0")}T00:00:00Z`,
      })
    );
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    expect(recap.recentUnlocks).toHaveLength(STEAM_RECAP_RECENT_UNLOCKS_LIMIT);
    expect(recap.recentUnlocks[0]?.apiName).toBe("ACH_7");
    expect(recap.recentUnlocks[4]?.apiName).toBe("ACH_3");
  });

  // `unlocksPerWeek` series. NOW is Mon 2026-06-01 12:00 UTC = Mon 14:00
  // Brussels, so the current Brussels week anchor is itself Mon 2026-06-01.
  // Week anchors used below:
  //  0w  ago → Mon Jun 1
  //  1w  ago → Mon May 25
  //  3w  ago → Mon May 11
  // 11w  ago → Mon Mar 16   (last in-window week, 12-entry max series)
  // 12w  ago → Mon Mar  9   (out of window)
  describe("unlocksPerWeek", () => {
    it("returns empty when no achievements are unlocked", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([makeAchievement({ unlockedAt: null })]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.unlocksPerWeek).toEqual([]);
    });

    it("returns [count] when all unlocks fall in the current Brussels week", () => {
      const achievements = [
        makeAchievement({ apiName: "A", unlockedAt: "2026-06-01T10:00:00Z" }),
        makeAchievement({ apiName: "B", unlockedAt: "2026-06-01T11:00:00Z" }),
        makeAchievement({ apiName: "C", unlockedAt: "2026-06-01T08:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      expect(recap.unlocksPerWeek).toEqual([3]);
    });

    it("builds a right-anchored, oldest-first series with zero-filled gaps", () => {
      const achievements = [
        // 0w ago — 2 unlocks
        makeAchievement({ apiName: "A", unlockedAt: "2026-06-01T10:00:00Z" }),
        makeAchievement({ apiName: "B", unlockedAt: "2026-06-01T11:00:00Z" }),
        // 1w ago — 1 unlock
        makeAchievement({ apiName: "C", unlockedAt: "2026-05-26T10:00:00Z" }),
        // 3w ago — 1 unlock (2w bucket is empty)
        makeAchievement({ apiName: "D", unlockedAt: "2026-05-13T10:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      // Oldest first: [3w, 2w, 1w, 0w] = [1, 0, 1, 2]
      expect(recap.unlocksPerWeek).toEqual([1, 0, 1, 2]);
    });

    it("buckets by Brussels calendar week, not UTC week", () => {
      // 2026-05-31T22:00:00Z = Mon Jun 1 00:00 Brussels → 0w ago (same week as NOW).
      // 2026-05-31T20:00:00Z = Sun May 31 22:00 Brussels → 1w ago.
      const achievements = [
        makeAchievement({ apiName: "BRUSSELS_MON", unlockedAt: "2026-05-31T22:00:00Z" }),
        makeAchievement({ apiName: "BRUSSELS_SUN", unlockedAt: "2026-05-31T20:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      // Oldest first: [1w (Sun), 0w (Mon)] = [1, 1]
      expect(recap.unlocksPerWeek).toEqual([1, 1]);
    });

    it("includes weeks across the spring DST transition", () => {
      // 2026-03-28T12:00:00Z — Sat in CET (UTC+1) — week of Mar 23.
      // 2026-03-30T12:00:00Z — Mon in CEST (UTC+2) — week of Mar 30 (DST started Sun Mar 29).
      // Both within the 12-week window — Mar 23 = 10w ago, Mar 30 = 9w ago.
      const achievements = [
        makeAchievement({ apiName: "CET", unlockedAt: "2026-03-28T12:00:00Z" }),
        makeAchievement({ apiName: "CEST", unlockedAt: "2026-03-30T12:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      // Oldest first across 10w..0w: 11 entries with CET at idx 0, CEST at idx 1.
      expect(recap.unlocksPerWeek).toHaveLength(11);
      expect(recap.unlocksPerWeek[0]).toBe(1);
      expect(recap.unlocksPerWeek[1]).toBe(1);
      expect(recap.unlocksPerWeek.slice(2)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("caps the series at the 12-week window when the oldest unlock is at the edge", () => {
      const achievements = [
        // 11w ago (in window, oldest possible) — Tue Mar 17
        makeAchievement({ apiName: "OLD", unlockedAt: "2026-03-17T10:00:00Z" }),
        // 0w ago
        makeAchievement({ apiName: "NEW", unlockedAt: "2026-06-01T10:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      expect(recap.unlocksPerWeek).toHaveLength(STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT);
      expect(recap.unlocksPerWeek[0]).toBe(1);
      expect(recap.unlocksPerWeek[STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT - 1]).toBe(1);
    });

    it("excludes unlocks older than the window", () => {
      const achievements = [
        // 13w ago — Sunday Mar 8 → anchor Mar 2 → 13w. Out of window.
        makeAchievement({ apiName: "ANCIENT", unlockedAt: "2026-03-08T20:00:00Z" }),
        // 0w ago
        makeAchievement({ apiName: "NEW", unlockedAt: "2026-06-01T10:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      // Only NEW contributes; series collapses to [1].
      expect(recap.unlocksPerWeek).toEqual([1]);
    });

    it("returns empty when every unlock is older than the window", () => {
      const achievements = [
        makeAchievement({ apiName: "A", unlockedAt: "2025-12-01T10:00:00Z" }),
        makeAchievement({ apiName: "B", unlockedAt: "2026-01-15T10:00:00Z" }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      expect(recap.unlocksPerWeek).toEqual([]);
    });
  });

  it("picks the rarest unlock as the standout when rarity data exists", () => {
    const achievements = [
      makeAchievement({
        apiName: "COMMON",
        displayName: "Common One",
        unlockedAt: "2026-05-30T00:00:00Z",
        globalPercent: 65,
      }),
      makeAchievement({
        apiName: "RARE",
        displayName: "Rare One",
        unlockedAt: "2026-05-20T00:00:00Z",
        globalPercent: 2.3,
      }),
      makeAchievement({
        apiName: "MID",
        displayName: "Mid One",
        unlockedAt: "2026-05-29T00:00:00Z",
        globalPercent: 30,
      }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    expect(recap.standoutUnlock?.apiName).toBe("RARE");
    expect(recap.standoutUnlock?.globalPercent).toBe(2.3);
    expect(recap.standoutUnlock?.daysAgo).toBe(12);
  });

  it("falls back to most-recent unlock when no rarity data is available", () => {
    const achievements = [
      makeAchievement({
        apiName: "OLD",
        unlockedAt: "2026-04-01T00:00:00Z",
        globalPercent: null,
      }),
      makeAchievement({
        apiName: "NEW",
        unlockedAt: "2026-05-30T00:00:00Z",
        globalPercent: null,
      }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    expect(recap.standoutUnlock?.apiName).toBe("NEW");
    expect(recap.standoutUnlock?.globalPercent).toBeNull();
  });

  it("uses recency tiebreak when two unlocks share rarity", () => {
    const achievements = [
      makeAchievement({
        apiName: "RARE_OLD",
        unlockedAt: "2026-04-01T00:00:00Z",
        globalPercent: 5,
      }),
      makeAchievement({
        apiName: "RARE_NEW",
        unlockedAt: "2026-05-30T00:00:00Z",
        globalPercent: 5,
      }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    expect(recap.standoutUnlock?.apiName).toBe("RARE_NEW");
  });

  it.each([
    [0, "current"],
    [3, "current"],
    [7, "current"],
    [8, "recent"],
    [30, "recent"],
    [31, "season"],
    [90, "season"],
    [91, "year"],
    [400, "year"],
  ])("buckets %s days as %s", (days, expected) => {
    const lastPlayed = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ rtimeLastPlayedAt: lastPlayed.toISOString() }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    expect(recap.ageBucket).toBe(expected);
  });

  it("returns null ageBucket when lastPlayedAt is null", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ rtimeLastPlayedAt: null }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    expect(recap.ageBucket).toBeNull();
  });

  describe("medianAchievementRarity", () => {
    it("returns null when no unlocked achievement has rarity data", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({
            unlockedAt: "2026-05-01T00:00:00Z",
            globalPercent: null,
          }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.medianAchievementRarity).toBeNull();
    });

    it("returns the middle value for an odd-length series", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ unlockedAt: "2026-05-01T00:00:00Z", globalPercent: 10 }),
          makeAchievement({ unlockedAt: "2026-05-02T00:00:00Z", globalPercent: 50 }),
          makeAchievement({ unlockedAt: "2026-05-03T00:00:00Z", globalPercent: 80 }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.medianAchievementRarity).toBe(50);
    });

    it("averages the two middle values for an even-length series", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ unlockedAt: "2026-05-01T00:00:00Z", globalPercent: 20 }),
          makeAchievement({ unlockedAt: "2026-05-02T00:00:00Z", globalPercent: 40 }),
          makeAchievement({ unlockedAt: "2026-05-03T00:00:00Z", globalPercent: 60 }),
          makeAchievement({ unlockedAt: "2026-05-04T00:00:00Z", globalPercent: 80 }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.medianAchievementRarity).toBe(50);
    });

    it("ignores locked achievements when computing the median", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ unlockedAt: "2026-05-01T00:00:00Z", globalPercent: 30 }),
          // Locked — should be excluded from the median, even though it has rarity.
          makeAchievement({ unlockedAt: null, globalPercent: 90 }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.medianAchievementRarity).toBe(30);
    });
  });

  describe("daysToCompletion", () => {
    it("is null when the game is not 100%'d", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({
            apiName: "A",
            unlockedAt: "2026-05-01T00:00:00Z",
          }),
          makeAchievement({ apiName: "B", unlockedAt: null }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.daysToCompletion).toBeNull();
    });

    it("returns the day delta between first and last unlock when 100%'d", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ apiName: "A", unlockedAt: "2026-04-01T00:00:00Z" }),
          makeAchievement({ apiName: "B", unlockedAt: "2026-04-15T00:00:00Z" }),
          makeAchievement({ apiName: "C", unlockedAt: "2026-04-30T00:00:00Z" }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.daysToCompletion).toBe(29);
    });

    it("is null when only one unlock has a timestamp (cleared-in-zero-days is editorial whiplash)", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ apiName: "A", unlockedAt: "2026-04-30T00:00:00Z" }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.daysToCompletion).toBeNull();
    });
  });

  describe("remainingRarestUnlocks", () => {
    it("is empty when the game is 100%'d", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements([
          makeAchievement({ apiName: "A", unlockedAt: "2026-05-01T00:00:00Z" }),
        ]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.remainingRarestUnlocks).toEqual([]);
    });

    it("is empty when the game has no schema", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(null),
        SCREENSHOTS,
        NOW
      );
      expect(recap.remainingRarestUnlocks).toEqual([]);
    });

    it("returns top 3 LOCKED achievements ordered by rarity (lowest globalPercent first)", () => {
      const achievements = [
        makeAchievement({
          apiName: "UNLOCKED",
          unlockedAt: "2026-05-01T00:00:00Z",
          globalPercent: 60,
        }),
        makeAchievement({
          apiName: "COMMON_LOCKED",
          unlockedAt: null,
          globalPercent: 70,
        }),
        makeAchievement({ apiName: "RARE_LOCKED", unlockedAt: null, globalPercent: 3 }),
        makeAchievement({ apiName: "MID_LOCKED", unlockedAt: null, globalPercent: 25 }),
        makeAchievement({ apiName: "OTHER_LOCKED", unlockedAt: null, globalPercent: 40 }),
        makeAchievement({ apiName: "NO_RARITY", unlockedAt: null, globalPercent: null }),
      ];
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame(),
        makeAchievements(achievements),
        SCREENSHOTS,
        NOW
      );
      expect(recap.remainingRarestUnlocks.map((u) => u.apiName)).toEqual([
        "RARE_LOCKED",
        "MID_LOCKED",
        "OTHER_LOCKED",
      ]);
    });
  });

  describe("playtimeTrend", () => {
    it("is null when there are no recent-playtime snapshots", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame({ recentPlaytimeMinutes: [] }),
        makeAchievements([]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.playtimeTrend).toBeNull();
    });

    it("buckets a 30-day total above the active threshold as 'active'", () => {
      // 30 days × 15 min each = 450 min total, no 7-day spike.
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame({
          recentPlaytimeMinutes: Array.from({ length: 30 }, () => 15),
        }),
        makeAchievements([]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.playtimeTrend).toBe("active");
    });

    it("buckets a sub-300min 30-day total as 'dormant'", () => {
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame({
          recentPlaytimeMinutes: [
            0, 0, 0, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0,
          ],
        }),
        makeAchievements([]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.playtimeTrend).toBe("dormant");
    });

    it("flips to 'spike' when last 7d daily avg is ≥ 2× prior 23d daily avg", () => {
      // Prior 23d: 23 × 5 = 115 min total, daily avg 5. Last 7d: 7 × 60 = 420 min, daily avg 60.
      // 60 ≥ 2 × 5 → spike.
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame({
          recentPlaytimeMinutes: [
            ...Array.from({ length: 23 }, () => 5),
            ...Array.from({ length: 7 }, () => 60),
          ],
        }),
        makeAchievements([]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.playtimeTrend).toBe("spike");
    });

    it("flips a fresh-start week into 'spike' when prior history is zero", () => {
      // No prior activity, then last 7d totals ≥ 300 (active threshold).
      const recap = deriveSteamGameRecap(
        367520,
        makeOwnedGame({
          recentPlaytimeMinutes: [
            ...Array.from({ length: 23 }, () => 0),
            ...Array.from({ length: 7 }, () => 50),
          ],
        }),
        makeAchievements([]),
        SCREENSHOTS,
        NOW
      );
      expect(recap.playtimeTrend).toBe("spike");
    });
  });
});

describe("verdictParagraphSteam", () => {
  it("produces the empty-state line when nothing is tracked", () => {
    const recap = deriveSteamGameRecap(367520, null, null, [], NOW);
    const clauses = verdictParagraphSteam(recap);
    expect(verdictPreview(clauses)).toBe("No tracked this game activity yet.");
  });

  it("calls a currently-active game 'Currently in'", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ playtime2WeeksMinutes: 600 }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toMatch(/^Currently in/);
  });

  it("calls a 100% game 'Cleared'", () => {
    const achievements = Array.from({ length: 10 }, (_, i) =>
      makeAchievement({
        apiName: `A_${i}`,
        unlockedAt: "2026-05-01T00:00:00Z",
      })
    );
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ playtime2WeeksMinutes: 0 }),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toMatch(/^Cleared/);
  });

  it("does NOT call a 95%-but-not-100% game 'Cleared'", () => {
    const achievements = Array.from({ length: 20 }, (_, i) =>
      makeAchievement({
        apiName: `A_${i}`,
        unlockedAt: i < 19 ? "2026-05-01T00:00:00Z" : null,
      })
    );
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ playtime2WeeksMinutes: 0 }),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).not.toMatch(/^Cleared/);
    expect(text).toContain("1 achievement left");
  });

  it("calls a deeply-played-but-old game 'Engrossed'", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({
        playtimeForeverMinutes: 5000,
        playtime2WeeksMinutes: 0,
        rtimeLastPlayedAt: "2026-04-01T00:00:00Z", // 61d → season
      }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toMatch(/^Engrossed/);
  });

  it("calls a year+-quiet game 'Dormant'", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({
        playtime2WeeksMinutes: 0,
        rtimeLastPlayedAt: "2025-01-01T00:00:00Z",
      }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toMatch(/^Dormant/);
  });

  it("falls back to 'Sampled' for a low-time, no-recent-activity game", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({
        playtimeForeverMinutes: 60,
        playtime2WeeksMinutes: 0,
        rtimeLastPlayedAt: "2026-05-01T00:00:00Z",
      }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toMatch(/^Sampled/);
  });

  it("includes the rarest milestone framing when rarity is genuinely rare", () => {
    const achievements = [
      makeAchievement({
        apiName: "RARE",
        displayName: "Hollow Knight",
        unlockedAt: "2026-05-25T00:00:00Z",
        globalPercent: 1.8,
      }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toContain("Rarest milestone so far: Hollow Knight");
    expect(text).toContain("1.8%");
  });

  it("uses the soft 'Latest milestone' framing when rarity is common", () => {
    const achievements = [
      makeAchievement({
        apiName: "EASY",
        displayName: "Pressed Start",
        unlockedAt: "2026-05-30T00:00:00Z",
        globalPercent: 88,
      }),
    ];
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toContain("Latest milestone: Pressed Start");
    expect(text).not.toContain("Rarest milestone");
  });

  it("omits the achievement half of the volume clause when nothing is unlocked", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame(),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toContain("has 47h logged.");
    expect(text).not.toContain("achievements unlocked");
  });

  it("emits a 'Picked back up' context clause when 2-week ramps without being current", () => {
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({
        playtime2WeeksMinutes: 200,
        playtimeForeverMinutes: 60,
        rtimeLastPlayedAt: "2026-05-29T00:00:00Z",
      }),
      makeAchievements([]),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toContain("Picked back up");
    expect(text).toContain("3h");
  });

  it("pluralizes 'achievements left' when remaining > 1", () => {
    const achievements = Array.from({ length: 10 }, (_, i) =>
      makeAchievement({
        apiName: `A_${i}`,
        unlockedAt: i < 9 ? "2026-05-01T00:00:00Z" : null,
      })
    );
    const recap = deriveSteamGameRecap(
      367520,
      makeOwnedGame({ playtime2WeeksMinutes: 0 }),
      makeAchievements(achievements),
      SCREENSHOTS,
      NOW
    );
    const text = verdictPreview(verdictParagraphSteam(recap));
    expect(text).toContain("1 achievement left.");
    expect(text).not.toContain("achievements left");
  });
});

describe("formatReleaseDateChip", () => {
  // Anchor `now` to mid-month so the day-boundary cases (this week / last
  // month) don't drift on month rollovers.
  const NOW_CHIP = new Date("2026-06-15T12:00:00Z");

  it("returns null when releaseDate is null", () => {
    expect(formatReleaseDateChip(null, NOW_CHIP)).toBeNull();
  });

  it("returns null when releaseDate is in the future (pre-order edge case)", () => {
    expect(formatReleaseDateChip("2026-07-01", NOW_CHIP)).toBeNull();
  });

  it("returns null on an unparseable date string", () => {
    expect(formatReleaseDateChip("not-a-date", NOW_CHIP)).toBeNull();
  });

  it("reads as 'this week' for 0-6 days old", () => {
    expect(formatReleaseDateChip("2026-06-15", NOW_CHIP)).toBe("Released this week");
    expect(formatReleaseDateChip("2026-06-09", NOW_CHIP)).toBe("Released this week");
  });

  it("reads as 'last month' for 7-30 days old", () => {
    expect(formatReleaseDateChip("2026-06-08", NOW_CHIP)).toBe("Released last month");
    expect(formatReleaseDateChip("2026-05-16", NOW_CHIP)).toBe("Released last month");
  });

  it("reads as 'Released Mon YYYY' for 31-365 days old", () => {
    expect(formatReleaseDateChip("2026-05-15", NOW_CHIP)).toBe("Released May 2026");
    expect(formatReleaseDateChip("2025-09-20", NOW_CHIP)).toBe("Released Sep 2025");
  });

  it("reads as 'Released YYYY' for >1y old", () => {
    expect(formatReleaseDateChip("2023-04-22", NOW_CHIP)).toBe("Released 2023");
    expect(formatReleaseDateChip("2014-11-25", NOW_CHIP)).toBe("Released 2014");
  });
});
