import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamPortraitService, pickBaselineDate } from "./portrait.service";

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// 2026-05-03 is exactly 90 days before 2026-08-01.
const LATEST = date("2026-08-01");

describe("pickBaselineDate", () => {
  it("measures from the last snapshot on or before the window mark", () => {
    const dates = [date("2026-04-01"), date("2026-05-03"), date("2026-06-01"), LATEST];

    expect(pickBaselineDate(dates, 90)).toEqual(date("2026-05-03"));
  });

  it("falls back to the oldest snapshot when history is shorter than the window", () => {
    // Reporting a 90-day window off 61 days of evidence would be a lie the
    // card has no way to detect; the window labels itself from what it got.
    const dates = [date("2026-06-01"), date("2026-07-01"), LATEST];

    expect(pickBaselineDate(dates, 90)).toEqual(date("2026-06-01"));
  });

  it("returns null when there is only one observation to measure from", () => {
    expect(pickBaselineDate([LATEST], 90)).toBeNull();
    expect(pickBaselineDate([], 90)).toBeNull();
  });
});

type Snapshot = { appid: number; snapshotDate: Date; playtimeForeverMinutes: number };
type Enrichment = { appid: number; appType: number | null; tagIds: number[] };

const counts = (rows: Record<number, number> | undefined) =>
  Object.entries(rows ?? {}).map(([appid, count]) => ({
    appid: Number(appid),
    _count: { apiName: count },
  }));

function mockPrisma(options: {
  dates: Date[];
  snapshots: Snapshot[];
  enrichment: Enrichment[];
  sessions?: { appid: number; startedAt: Date }[];
  /** appid → achievements in the schema. */
  schemas?: Record<number, number>;
  /** appid → achievements unlocked. */
  unlocks?: Record<number, number>;
  /** appid → display name; defaults to `Game <appid>`. */
  names?: Record<number, string>;
  /** appid → Steam's `rtime_last_played`; absent means never launched. */
  lastPlayed?: Record<number, Date>;
}): PrismaService {
  const appids = [...new Set(options.enrichment.map((row) => row.appid))];
  return {
    steamPlaytimeSnapshot: {
      findMany: vi.fn(async (args: { distinct?: string[] }) =>
        args.distinct === undefined
          ? options.snapshots
          : options.dates.map((snapshotDate) => ({ snapshotDate }))
      ),
    },
    steamOwnedGame: {
      findMany: vi.fn(async () =>
        appids.map((appid) => ({
          appid,
          name: options.names?.[appid] ?? `Game ${appid}`,
          rtimeLastPlayed: options.lastPlayed?.[appid] ?? null,
        }))
      ),
    },
    steamGameEnrichment: { findMany: vi.fn(async () => options.enrichment) },
    steamTag: {
      findMany: vi.fn(async () => [
        { id: 1, name: "Souls-like" },
        { id: 2, name: "Action RPG" },
        { id: 3, name: "Atmospheric" },
        { id: 4, name: "Roguelite" },
      ]),
    },
    steamPlaySession: { findMany: vi.fn(async () => options.sessions ?? []) },
    steamGameAchievement: { groupBy: vi.fn(async () => counts(options.schemas)) },
    steamPlayerUnlock: { groupBy: vi.fn(async () => counts(options.unlocks)) },
  } as unknown as PrismaService;
}

describe("SteamPortraitService.getPortrait", () => {
  it("returns an empty portrait rather than throwing before the first poll", async () => {
    const prisma = mockPrisma({ dates: [], snapshots: [], enrichment: [] });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.lastSyncedAt).toBeNull();
    expect(portrait.recent).toBeNull();
    expect(portrait.lifetime.genres).toEqual([]);
    expect(portrait.posture.ownedCount).toBe(0);
  });

  it("keeps games below the lifetime floor out of the fingerprint but in the posture", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 12 },
        { appid: 3, snapshotDate: LATEST, playtimeForeverMinutes: 0 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [2] },
        { appid: 3, appType: 0, tagIds: [2] },
      ],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.lifetime.genres.map((g) => g.tag)).toEqual(["Souls-like"]);
    expect(portrait.posture).toEqual({
      ownedCount: 3,
      meaningfulCount: 1,
      tastedCount: 1,
      ghostCount: 1,
      totalMinutes: 612,
      meaningfulMinutes: 600,
    });
  });

  it("excludes apps that are not games, whose tags would speak loudly", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 60_000 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 6, tagIds: [2] }, // Wallpaper Engine
      ],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.posture.ownedCount).toBe(1);
    expect(portrait.lifetime.genres.map((g) => g.tag)).toEqual(["Souls-like"]);
  });

  it("weights the recency fingerprint by in-window minutes, not lifetime", async () => {
    // The whole point of card 2: a 1000-hour favourite touched for an hour
    // must not outrank the thing actually being played this month.
    const baseline = date("2026-05-03");
    const prisma = mockPrisma({
      dates: [baseline, LATEST],
      snapshots: [
        { appid: 1, snapshotDate: baseline, playtimeForeverMinutes: 59_940 },
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 60_000 },
        { appid: 2, snapshotDate: baseline, playtimeForeverMinutes: 0 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [4] },
      ],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.lifetime.genres[0]?.tag).toBe("Souls-like");
    expect(portrait.recent?.fingerprint.genres[0]?.tag).toBe("Roguelite");
    expect(portrait.recent?.window).toEqual({
      days: 90,
      since: baseline.toISOString(),
      until: LATEST.toISOString(),
    });
  });

  it("credits a game bought inside the window with all of its playtime", async () => {
    const baseline = date("2026-05-03");
    const prisma = mockPrisma({
      dates: [baseline, LATEST],
      snapshots: [
        { appid: 1, snapshotDate: baseline, playtimeForeverMinutes: 600 },
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
        // No baseline row: appid 2 was not owned when the window opened.
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 900 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [4] },
      ],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.recent?.fingerprint.genres).toEqual([
      { tag: "Roguelite", minutes: 900, share: 1, gameCount: 1 },
    ]);
  });

  it("drops games below the recency floor without dropping them from lifetime", async () => {
    const baseline = date("2026-05-03");
    const prisma = mockPrisma({
      dates: [baseline, LATEST],
      snapshots: [
        { appid: 1, snapshotDate: baseline, playtimeForeverMinutes: 590 },
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 }, // 10 min in-window
      ],
      enrichment: [{ appid: 1, appType: 0, tagIds: [1] }],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.lifetime.genres.map((g) => g.tag)).toEqual(["Souls-like"]);
    expect(portrait.recent?.fingerprint.genres).toEqual([]);
  });

  it("computes completion only over games with a schema and ten hours in them", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 3_000 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 3_000 },
        { appid: 3, snapshotDate: LATEST, playtimeForeverMinutes: 120 },
        { appid: 4, snapshotDate: LATEST, playtimeForeverMinutes: 3_000 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [1] },
        { appid: 3, appType: 0, tagIds: [1] },
        { appid: 4, appType: 0, tagIds: [1] },
      ],
      // appid 3 is perfect but two hours long; appid 4 has no schema at all.
      schemas: { 1: 10, 2: 10, 3: 10 },
      unlocks: { 1: 10, 2: 2, 3: 10 },
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.completion).toEqual({
      cohortCount: 2,
      finishedCount: 1,
      perfectCount: 1,
      medianCompletion: 0.6,
    });
  });

  it("names the tasted cohort the lifetime fingerprint threw away", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 22 },
        { appid: 3, snapshotDate: LATEST, playtimeForeverMinutes: 1 },
        { appid: 4, snapshotDate: LATEST, playtimeForeverMinutes: 0 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [2] },
        { appid: 3, appType: 0, tagIds: [2] },
        { appid: 4, appType: 0, tagIds: [2] },
      ],
      names: { 2: "Path of Exile", 3: "NieR Replicant" },
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.anti.tasted.count).toBe(2);
    expect(portrait.anti.tasted.totalMinutes).toBe(23);
    expect(portrait.anti.tasted.medianMinutes).toBe(11.5);
    // Shortest first, and the never-launched game stays out — a ghost was
    // never abandoned, it was never opened.
    expect(portrait.anti.tasted.quickest.map((g) => g.name)).toEqual([
      "NieR Replicant",
      "Path of Exile",
    ]);
    // The same two games, weighted by the genre they bounced off.
    expect(portrait.anti.tasted.fingerprint.genres.map((g) => g.gameCount)).toEqual([2]);
  });

  it("counts a lone unlock but not a one-achievement schema", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 3_000 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
        { appid: 3, snapshotDate: LATEST, playtimeForeverMinutes: 600 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [1] },
        { appid: 3, appType: 0, tagIds: [1] },
      ],
      // appid 2's single unlock is its whole schema — that is 100%, not the joke.
      schemas: { 1: 54, 2: 1, 3: 12 },
      unlocks: { 1: 1, 2: 1 },
      names: { 1: "Monster Hunter: World" },
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.anti.singleAchievement).toEqual({
      games: [{ appid: 1, name: "Monster Hunter: World", minutes: 3_000 }],
      withAnyUnlock: 2,
      withSchema: 3,
    });
  });

  it("crowns the oldest real last-played date, not Steam's epoch sentinel", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [
        { appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 410 },
        { appid: 2, snapshotDate: LATEST, playtimeForeverMinutes: 297 },
        { appid: 3, snapshotDate: LATEST, playtimeForeverMinutes: 30 },
      ],
      enrichment: [
        { appid: 1, appType: 0, tagIds: [1] },
        { appid: 2, appType: 0, tagIds: [1] },
        { appid: 3, appType: 0, tagIds: [1] },
      ],
      names: { 1: "Modern Warfare 2", 2: "Mirror's Edge", 3: "BioShock" },
      lastPlayed: {
        1: new Date("1970-01-02T00:00:00.000Z"),
        2: new Date("2012-07-18T00:00:00.000Z"),
        3: new Date("2011-01-01T00:00:00.000Z"),
      },
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    // appid 3 is older still, but half an hour in it is an abandon rather
    // than a cold streak, so the meaningful cohort has already dropped it.
    expect(portrait.anti.coldest).toEqual({
      appid: 2,
      name: "Mirror's Edge",
      minutes: 297,
      lastPlayed: "2012-07-18T00:00:00.000Z",
    });
  });

  it("reports no cold streak when nothing carries a usable last-played date", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [{ appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 }],
      enrichment: [{ appid: 1, appType: 0, tagIds: [1] }],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.anti.coldest).toBeNull();
  });

  it("reports no recency window when only one snapshot date exists", async () => {
    const prisma = mockPrisma({
      dates: [LATEST],
      snapshots: [{ appid: 1, snapshotDate: LATEST, playtimeForeverMinutes: 600 }],
      enrichment: [{ appid: 1, appType: 0, tagIds: [1] }],
    });

    const portrait = await new SteamPortraitService(prisma).getPortrait();

    expect(portrait.recent).toBeNull();
    expect(portrait.lastSyncedAt).toBe(LATEST.toISOString());
  });
});
