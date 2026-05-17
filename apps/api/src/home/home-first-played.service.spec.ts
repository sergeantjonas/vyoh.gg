import { describe, expect, it } from "vitest";
import {
  type LolMatchRow,
  type SteamSnapshotRow,
  detectFirstLolChampion,
  detectFirstSteamCrossing,
  pickMostRecent,
} from "./home-first-played.service";

let nextMatchId = 1;
const lolMatch = (
  champion: string,
  isoDate: string,
  win = true,
  puuid = "p1",
  matchId = `EUW1_${nextMatchId++}`
): LolMatchRow => ({
  matchId,
  champion,
  playedAt: new Date(isoDate),
  win,
  puuid,
});

const snapshot = (
  appid: number,
  isoDate: string,
  playtimeForeverMinutes: number,
  name = `App ${appid}`
): SteamSnapshotRow => ({
  appid,
  name,
  snapshotDate: new Date(isoDate),
  playtimeForeverMinutes,
});

describe("detectFirstLolChampion", () => {
  const asOf = new Date("2026-05-17T12:00:00Z");

  it("returns null for empty input", () => {
    expect(detectFirstLolChampion([], asOf, 30)).toBeNull();
  });

  it("returns null when every champion's first match predates the window", () => {
    // 60-day window from asOf is everything ≥ 2026-03-18. Both matches before that.
    expect(
      detectFirstLolChampion(
        [
          lolMatch("Vex", "2026-01-10T12:00:00Z"),
          lolMatch("Yasuo", "2026-02-05T12:00:00Z"),
        ],
        asOf,
        30
      )
    ).toBeNull();
  });

  it("returns the most-recently-first-played champion within the window", () => {
    const result = detectFirstLolChampion(
      [
        lolMatch("Vex", "2026-05-10T12:00:00Z", true),
        lolMatch("Vex", "2026-05-12T12:00:00Z", false),
        lolMatch("Vex", "2026-05-14T12:00:00Z", true),
        lolMatch("Yasuo", "2026-05-05T12:00:00Z", false),
        lolMatch("Yasuo", "2026-05-06T12:00:00Z", true),
        // Ahri was first played long ago but still has recent activity — should NOT win
        lolMatch("Ahri", "2024-09-01T12:00:00Z", true),
        lolMatch("Ahri", "2026-05-16T12:00:00Z", true),
      ],
      asOf,
      30
    );
    // Vex is the most-recently first-played within the window (first match
    // 2026-05-10). Yasuo is older (2026-05-05). Ahri's first match is outside
    // the window despite recent activity — older first-encounter loses.
    expect(result).toEqual(
      expect.objectContaining({
        champion: "Vex",
        firstPlayedAt: new Date("2026-05-10T12:00:00Z"),
        matchCount: 3,
        wins: 2,
        firstPuuid: "p1",
      })
    );
    expect(typeof result?.firstMatchId).toBe("string");
  });

  it("carries the puuid + matchId of the FIRST match for slug + match-detail routing", () => {
    // Same champion first played on account A, then later on account B.
    // firstPuuid/firstMatchId must come from the account-A first row regardless of input order.
    const result = detectFirstLolChampion(
      [
        lolMatch("Vex", "2026-05-14T12:00:00Z", true, "puuid-B", "EUW1_B14"),
        lolMatch("Vex", "2026-05-10T12:00:00Z", true, "puuid-A", "EUW1_A10"),
        lolMatch("Vex", "2026-05-12T12:00:00Z", true, "puuid-A", "EUW1_A12"),
      ],
      new Date("2026-05-17T12:00:00Z"),
      30
    );
    expect(result?.firstPuuid).toBe("puuid-A");
    expect(result?.firstMatchId).toBe("EUW1_A10");
  });

  it("aggregates W/L across all matches on the champion, not just the first", () => {
    const result = detectFirstLolChampion(
      [
        lolMatch("Vex", "2026-05-10T12:00:00Z", false),
        lolMatch("Vex", "2026-05-11T12:00:00Z", true),
        lolMatch("Vex", "2026-05-12T12:00:00Z", true),
        lolMatch("Vex", "2026-05-13T12:00:00Z", false),
      ],
      asOf,
      30
    );
    expect(result?.matchCount).toBe(4);
    expect(result?.wins).toBe(2);
  });

  it("treats input order as irrelevant — firstPlayedAt is the min, not the first row", () => {
    const result = detectFirstLolChampion(
      [
        lolMatch("Vex", "2026-05-14T12:00:00Z"),
        lolMatch("Vex", "2026-05-10T12:00:00Z"),
        lolMatch("Vex", "2026-05-12T12:00:00Z"),
      ],
      asOf,
      30
    );
    expect(result?.firstPlayedAt).toEqual(new Date("2026-05-10T12:00:00Z"));
  });
});

describe("detectFirstSteamCrossing", () => {
  const asOf = new Date("2026-05-17T12:00:00Z");

  it("returns null for empty input", () => {
    expect(detectFirstSteamCrossing([], asOf, 30, 30)).toBeNull();
  });

  it("excludes appids whose first observed snapshot is already above threshold (unknown baseline)", () => {
    // appid 1 starts at 500 min — no pre-threshold baseline. We don't know
    // when the true first-meaningful moment was; exclude.
    const result = detectFirstSteamCrossing(
      [
        snapshot(1, "2026-05-10T00:00:00Z", 500),
        snapshot(1, "2026-05-15T00:00:00Z", 800),
      ],
      asOf,
      30,
      30
    );
    expect(result).toBeNull();
  });

  it("detects a clean crossing from below to above threshold", () => {
    const result = detectFirstSteamCrossing(
      [
        snapshot(1, "2026-05-10T00:00:00Z", 5, "Hades II"),
        snapshot(1, "2026-05-12T00:00:00Z", 45, "Hades II"),
        snapshot(1, "2026-05-15T00:00:00Z", 180, "Hades II"),
      ],
      asOf,
      30,
      30
    );
    expect(result).toEqual({
      kind: "steam",
      appid: 1,
      name: "Hades II",
      firstPlayedAt: new Date("2026-05-12T00:00:00Z").toISOString(),
      totalMinutes: 180,
    });
  });

  it("returns null when the crossing falls outside the window", () => {
    const result = detectFirstSteamCrossing(
      [
        snapshot(1, "2024-01-10T00:00:00Z", 5),
        snapshot(1, "2024-01-12T00:00:00Z", 45),
        snapshot(1, "2026-05-15T00:00:00Z", 800),
      ],
      asOf,
      30,
      30
    );
    expect(result).toBeNull();
  });

  it("picks the most recent crossing across multiple appids", () => {
    const result = detectFirstSteamCrossing(
      [
        // appid 1 crossed on 05-10
        snapshot(1, "2026-05-08T00:00:00Z", 5, "Hades II"),
        snapshot(1, "2026-05-10T00:00:00Z", 50, "Hades II"),
        snapshot(1, "2026-05-15T00:00:00Z", 200, "Hades II"),
        // appid 2 crossed on 05-14 — more recent, should win
        snapshot(2, "2026-05-12T00:00:00Z", 10, "Balatro 2"),
        snapshot(2, "2026-05-14T00:00:00Z", 40, "Balatro 2"),
        snapshot(2, "2026-05-16T00:00:00Z", 90, "Balatro 2"),
      ],
      asOf,
      30,
      30
    );
    expect(result?.appid).toBe(2);
    expect(result?.name).toBe("Balatro 2");
    expect(result?.totalMinutes).toBe(90);
  });

  it("totalMinutes is the LATEST snapshot, not the crossing snapshot", () => {
    const result = detectFirstSteamCrossing(
      [
        snapshot(1, "2026-05-10T00:00:00Z", 5),
        snapshot(1, "2026-05-12T00:00:00Z", 35),
        snapshot(1, "2026-05-16T00:00:00Z", 500),
      ],
      asOf,
      30,
      30
    );
    expect(result?.totalMinutes).toBe(500);
  });

  it("snapshots arrive unsorted — internal sort still picks the true first crossing", () => {
    const result = detectFirstSteamCrossing(
      [
        snapshot(1, "2026-05-15T00:00:00Z", 180),
        snapshot(1, "2026-05-10T00:00:00Z", 5),
        snapshot(1, "2026-05-12T00:00:00Z", 45),
      ],
      asOf,
      30,
      30
    );
    expect(result?.firstPlayedAt).toBe(new Date("2026-05-12T00:00:00Z").toISOString());
  });
});

describe("pickMostRecent", () => {
  const lol = {
    kind: "lol" as const,
    champion: "Vex",
    firstPlayedAt: "2026-05-10T00:00:00.000Z",
    matchId: "EUW1_12345",
    matchCount: 3,
    wins: 2,
    accountSlug: "vyoh-euw",
  };
  const steam = {
    kind: "steam" as const,
    appid: 1,
    name: "Hades II",
    firstPlayedAt: "2026-05-14T00:00:00.000Z",
    totalMinutes: 180,
  };

  it("returns null when both are null", () => {
    expect(pickMostRecent(null, null)).toBeNull();
  });

  it("returns steam when only steam is non-null", () => {
    expect(pickMostRecent(null, steam)).toBe(steam);
  });

  it("returns lol when only lol is non-null", () => {
    expect(pickMostRecent(lol, null)).toBe(lol);
  });

  it("picks the more-recent firstPlayedAt", () => {
    expect(pickMostRecent(lol, steam)).toBe(steam);
    const earlierSteam = { ...steam, firstPlayedAt: "2026-05-01T00:00:00.000Z" };
    expect(pickMostRecent(lol, earlierSteam)).toBe(lol);
  });

  it("favors LoL on a tie (deterministic ordering)", () => {
    const sameDay = { ...steam, firstPlayedAt: lol.firstPlayedAt };
    expect(pickMostRecent(lol, sameDay)).toBe(lol);
  });
});
