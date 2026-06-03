import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { SteamMomentsService } from "./steam-moments.service";

const NOW = new Date("2026-06-02T12:00:00Z");

interface OwnedGameRow {
  appid: number;
  name: string;
  firstSeenAt: Date;
}

interface EnrichmentRow {
  appid: number;
  appType: number | null;
}

interface PlaySessionRow {
  appid: number;
  startedAt: Date;
  endedAt: Date | null;
}

function makeService(opts: {
  /** Rows returned by the `where: { firstSeenAt: { gte: cutoff } }` query. */
  eligibleGames?: OwnedGameRow[];
  /** Rows returned by the bootstrap-detection query (unfiltered findMany on
   *  `firstSeenAt` only). Defaults to mirroring `eligibleGames` so callers
   *  who don't care about the bootstrap guard get a sensible default. */
  allOwnedGames?: OwnedGameRow[];
  enrichments?: EnrichmentRow[];
  sessions?: PlaySessionRow[];
}) {
  const ownedFindMany = vi
    .fn()
    .mockImplementation((args: { where?: object } | undefined) => {
      // Bootstrap-detection call: no `where` filter (selects all owned games
      // to bucket by firstSeenAt day). Eligible-games call: `where` carries
      // the `firstSeenAt: { gte: cutoff }` + `removedAt: null` filter.
      if (!args?.where) {
        return Promise.resolve(opts.allOwnedGames ?? opts.eligibleGames ?? []);
      }
      return Promise.resolve(opts.eligibleGames ?? []);
    });
  const prisma = {
    steamOwnedGame: { findMany: ownedFindMany },
    steamGameEnrichment: {
      findMany: vi.fn().mockResolvedValue(opts.enrichments ?? []),
    },
    steamPlaySession: {
      findMany: vi.fn().mockResolvedValue(opts.sessions ?? []),
    },
  } as unknown as PrismaService;
  return { service: new SteamMomentsService(prisma), prisma };
}

describe("SteamMomentsService.detectFirstTimeGames", () => {
  it("returns no candidates when no games were added inside the recency window", async () => {
    const { service } = makeService({ eligibleGames: [] });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toEqual([]);
  });

  it("surfaces a first-time candidate when a fresh game has ≥30 min of in-window play", async () => {
    const firstSeenAt = new Date("2026-05-28T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 100, name: "Pragmata", firstSeenAt }],
      allOwnedGames: [{ appid: 100, name: "Pragmata", firstSeenAt }],
      enrichments: [{ appid: 100, appType: 0 }],
      sessions: [
        {
          appid: 100,
          startedAt: new Date("2026-05-28T11:00:00Z"),
          endedAt: new Date("2026-05-28T13:30:00Z"), // 150 min
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    const [candidate] = result;
    expect(candidate).toMatchObject({
      kind: "steam-moment",
      momentType: "FIRST_TIME_GAME",
      appid: 100,
      name: "Pragmata",
      slug: "steam-moment-first-100",
      firstTime: {
        windowPlayMinutes: 150,
        sessionCount: 1,
        firstSessionMinutes: 150,
        addedAt: "2026-05-28T10:00:00.000Z",
        firstPlayedAt: "2026-05-28T11:00:00.000Z",
      },
    });
    expect(candidate?.daysSince).toBe(5);
    if (candidate?.kind === "steam-moment") {
      // 150 / 15 = 10
      expect(candidate.baseSignal).toBeCloseTo(10);
    }
  });

  it("counts each post-firstSeenAt closed session toward the sessionCount receipt", async () => {
    // Three distinct same-appid sessions spread across the window. Sums
    // playtime as expected AND the receipt carries the session count so
    // the chapter can render "Xh across N sessions".
    const firstSeenAt = new Date("2026-05-26T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 110, name: "Pragmata", firstSeenAt }],
      allOwnedGames: [{ appid: 110, name: "Pragmata", firstSeenAt }],
      enrichments: [{ appid: 110, appType: 0 }],
      sessions: [
        {
          appid: 110,
          startedAt: new Date("2026-05-26T11:00:00Z"),
          endedAt: new Date("2026-05-26T12:30:00Z"), // 90 min
        },
        {
          appid: 110,
          startedAt: new Date("2026-05-29T20:00:00Z"),
          endedAt: new Date("2026-05-29T21:00:00Z"), // 60 min
        },
        {
          appid: 110,
          startedAt: new Date("2026-06-01T19:00:00Z"),
          endedAt: new Date("2026-06-01T20:30:00Z"), // 90 min
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    const [candidate] = result;
    if (candidate?.kind !== "steam-moment") throw new Error("expected steam-moment");
    expect(candidate.firstTime).toMatchObject({
      windowPlayMinutes: 240,
      sessionCount: 3,
    });
  });

  it("emits addedAt + firstPlayedAt + firstSessionMinutes — picks the earliest session start, not the longest", async () => {
    // Game added Tue, played first on Thu — the chapter renders the
    // (added → first played) pair as the narrative seed. firstSession*
    // tracks the EARLIEST session by start time, even when a later session
    // is longer. (Editorially: "your first sit-down was 90min" should mean
    // what you actually did *first*, not your longest engagement.)
    const addedAt = new Date("2026-05-26T10:00:00Z");
    const earliestStart = new Date("2026-05-28T20:00:00Z");
    const longestStart = new Date("2026-05-30T19:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 120, name: "Pragmata", firstSeenAt: addedAt }],
      allOwnedGames: [{ appid: 120, name: "Pragmata", firstSeenAt: addedAt }],
      enrichments: [{ appid: 120, appType: 0 }],
      sessions: [
        {
          appid: 120,
          startedAt: longestStart,
          endedAt: new Date("2026-05-30T22:30:00Z"), // 150 min — longest
        },
        {
          appid: 120,
          startedAt: earliestStart,
          endedAt: new Date("2026-05-28T21:30:00Z"), // 90 min — earliest
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    const [candidate] = result;
    if (candidate?.kind !== "steam-moment") throw new Error("expected steam-moment");
    expect(candidate.firstTime?.addedAt).toBe(addedAt.toISOString());
    expect(candidate.firstTime?.firstPlayedAt).toBe(earliestStart.toISOString());
    expect(candidate.firstTime?.firstSessionMinutes).toBe(90);
  });

  it("drops a candidate whose total in-window playtime is below the 30 min floor", async () => {
    const firstSeenAt = new Date("2026-05-30T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 101, name: "Brief Demo", firstSeenAt }],
      allOwnedGames: [{ appid: 101, name: "Brief Demo", firstSeenAt }],
      enrichments: [{ appid: 101, appType: 0 }],
      sessions: [
        {
          appid: 101,
          startedAt: new Date("2026-05-30T11:00:00Z"),
          endedAt: new Date("2026-05-30T11:25:00Z"), // 25 min — below floor
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toEqual([]);
  });

  it("excludes non-game appTypes (Wallpaper Engine, 3DMark, …)", async () => {
    const firstSeenAt = new Date("2026-05-28T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 431960, name: "Wallpaper Engine", firstSeenAt }],
      allOwnedGames: [{ appid: 431960, name: "Wallpaper Engine", firstSeenAt }],
      enrichments: [{ appid: 431960, appType: 6 }],
      sessions: [
        {
          appid: 431960,
          startedAt: new Date("2026-05-28T11:00:00Z"),
          endedAt: new Date("2026-05-28T13:00:00Z"),
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toEqual([]);
  });

  it("excludes appids whose firstSeenAt day was a bootstrap day (≥4 rows)", async () => {
    // Bootstrap day: 2026-05-15 with 4 games seeded by the owned-games
    // sync's first run. Even though all four are inside the 30d window
    // and have enough play minutes, they're a tracking artefact, not
    // editorial first-time events.
    const bootstrapDay = new Date("2026-05-15T08:00:00Z");
    const bootstrapGames = [101, 102, 103, 104].map((appid) => ({
      appid,
      name: `Legacy ${appid}`,
      firstSeenAt: bootstrapDay,
    }));
    // Genuine fresh add on 2026-05-28 — single row on its day, should
    // survive the bootstrap filter.
    const freshGame = {
      appid: 200,
      name: "Pragmata",
      firstSeenAt: new Date("2026-05-28T10:00:00Z"),
    };
    const { service } = makeService({
      eligibleGames: [...bootstrapGames, freshGame],
      allOwnedGames: [...bootstrapGames, freshGame],
      enrichments: [101, 102, 103, 104, 200].map((appid) => ({ appid, appType: 0 })),
      sessions: [101, 102, 103, 104, 200].map((appid) => ({
        appid,
        startedAt: new Date("2026-05-29T10:00:00Z"),
        endedAt: new Date("2026-05-29T12:00:00Z"),
      })),
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind === "steam-moment" && result[0].appid).toBe(200);
  });

  it("ignores sessions that started before the game's firstSeenAt timestamp", async () => {
    // Out-of-order data: a session row predates the game's own
    // firstSeenAt (shouldn't happen by construction but stays correct
    // under data mutation). The pre-firstSeenAt session is dropped.
    const firstSeenAt = new Date("2026-05-28T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 300, name: "Re-added", firstSeenAt }],
      allOwnedGames: [{ appid: 300, name: "Re-added", firstSeenAt }],
      enrichments: [{ appid: 300, appType: 0 }],
      sessions: [
        {
          appid: 300,
          startedAt: new Date("2026-01-01T10:00:00Z"),
          endedAt: new Date("2026-01-01T14:00:00Z"), // 240 min, but pre-firstSeenAt
        },
        {
          appid: 300,
          startedAt: new Date("2026-05-29T10:00:00Z"),
          endedAt: new Date("2026-05-29T10:45:00Z"), // 45 min, post-firstSeenAt
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    expect(
      result[0]?.kind === "steam-moment" ? result[0].firstTime?.windowPlayMinutes : null
    ).toBe(45);
  });

  it("ignores sessions without an endedAt (in-flight rows)", async () => {
    const firstSeenAt = new Date("2026-05-28T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 400, name: "Mid-session", firstSeenAt }],
      allOwnedGames: [{ appid: 400, name: "Mid-session", firstSeenAt }],
      enrichments: [{ appid: 400, appType: 0 }],
      sessions: [
        {
          appid: 400,
          startedAt: new Date("2026-05-28T11:00:00Z"),
          endedAt: null,
        },
        {
          appid: 400,
          startedAt: new Date("2026-05-28T15:00:00Z"),
          endedAt: new Date("2026-05-28T16:30:00Z"), // 90 min, complete
        },
      ],
    });
    const result = await service.detectFirstTimeGames(NOW);
    expect(result).toHaveLength(1);
    expect(
      result[0]?.kind === "steam-moment" ? result[0].firstTime?.windowPlayMinutes : null
    ).toBe(90);
  });
});

describe("SteamMomentsService.detectAll", () => {
  it("aggregates from each per-momentType detector", async () => {
    // For R-7f this is just FIRST_TIME_GAME, but the contract is the same
    // shape `selectChapters` consumes, so the assembly seam stays honest.
    const firstSeenAt = new Date("2026-05-28T10:00:00Z");
    const { service } = makeService({
      eligibleGames: [{ appid: 100, name: "Pragmata", firstSeenAt }],
      enrichments: [{ appid: 100, appType: 0 }],
      sessions: [
        {
          appid: 100,
          startedAt: new Date("2026-05-28T11:00:00Z"),
          endedAt: new Date("2026-05-28T13:00:00Z"),
        },
      ],
    });
    const result = await service.detectAll(NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("steam-moment");
  });
});
