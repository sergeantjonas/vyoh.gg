import type { SteamCurationSets } from "@vyoh/shared";
import { NO_CURATION } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { SteamSessionsService } from "./sessions.service";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-09-14T10:00:00Z");

const ONIMUSHA = 3_000_001;
const MORTAL_SHELL = 1_110_910;
const HIDDEN = 1_091_500;

interface SessionSpec {
  id: string;
  appid: number;
  name: string;
  startedAt: Date;
  hours: number;
}

interface UnlockSpec {
  appid: number;
  apiName: string;
  unlockedAt: Date;
  percent?: number | null;
  hidden?: boolean;
}

function daysAgo(n: number, hour = 18): Date {
  const d = new Date(NOW.getTime() - n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function session(
  id: string,
  appid: number,
  name: string,
  startedAt: Date,
  hours: number
): SessionSpec {
  return { id, appid, name, startedAt, hours };
}

function mockPrisma(options: {
  sessions: SessionSpec[];
  /** A session still open as the response is built. */
  open?: { id: string; appid: number; name: string; startedAt: Date };
  /** The poller's last tick; defaults to a minute ago, still seeing `open`. */
  poll?: { currentAppid: number | null; lastPolledAt: Date };
  unlocks?: UnlockSpec[];
  /** appid → [snapshotDate, playtimeForeverMinutes][] */
  snapshots?: Record<number, Array<[Date, number]>>;
  /** appid → schema size. */
  totals?: Record<number, number>;
  /** appid → unlocked count. */
  unlocked?: Record<number, number>;
}) {
  const sessionFindMany = vi.fn(async () =>
    options.sessions.map((s) => ({
      id: s.id,
      appid: s.appid,
      gameNameSnapshot: s.name,
      startedAt: s.startedAt,
      endedAt: new Date(s.startedAt.getTime() + s.hours * HOUR),
    }))
  );
  const unlockFindMany = vi.fn(async (args: { where: { appid: { notIn: number[] } } }) =>
    (options.unlocks ?? [])
      .filter((u) => !args.where.appid.notIn.includes(u.appid))
      .map((u) => ({
        appid: u.appid,
        apiName: u.apiName,
        unlockedAt: u.unlockedAt,
        achievement: {
          displayName: `${u.apiName} label`,
          hidden: u.hidden ?? false,
          rarity:
            u.percent === undefined
              ? { percent: 40 }
              : u.percent === null
                ? null
                : { percent: u.percent },
          game: {
            name:
              options.sessions.find((s) => s.appid === u.appid)?.name ??
              `Game ${u.appid}`,
          },
        },
      }))
  );
  const counts = (rows?: Record<number, number>) =>
    Object.entries(rows ?? {}).map(([appid, n]) => ({
      appid: Number(appid),
      _count: { apiName: n },
    }));
  const prisma = {
    steamPlayerState: {
      findFirst: vi.fn(
        async () =>
          options.poll ?? {
            currentAppid: options.open?.appid ?? null,
            lastPolledAt: new Date(NOW.getTime() - 60_000),
          }
      ),
    },
    steamPlaySession: {
      findMany: sessionFindMany,
      findFirst: vi.fn(async () =>
        options.open
          ? {
              id: options.open.id,
              appid: options.open.appid,
              gameNameSnapshot: options.open.name,
              startedAt: options.open.startedAt,
            }
          : null
      ),
    },
    steamPlayerUnlock: {
      findMany: unlockFindMany,
      groupBy: vi.fn(async () => counts(options.unlocked)),
    },
    steamPlaytimeSnapshot: {
      findMany: vi.fn(async () =>
        Object.entries(options.snapshots ?? {}).flatMap(([appid, rows]) =>
          rows.map(([snapshotDate, playtimeForeverMinutes]) => ({
            appid: Number(appid),
            snapshotDate,
            playtimeForeverMinutes,
          }))
        )
      ),
    },
    steamGameAchievement: { groupBy: vi.fn(async () => counts(options.totals)) },
  } as unknown as PrismaService;
  return { prisma, sessionFindMany, unlockFindMany };
}

function curation(hidden: number[]): SteamCurationSets {
  return { hidden: new Set(hidden), unfeatured: new Set() };
}

/** Nine Onimusha evenings across two weeks, one of them a Saturday marathon. */
function onimushaWeek(): SessionSpec[] {
  return [
    session("s1", ONIMUSHA, "Onimusha", daysAgo(9, 18), 2.5),
    session("s2", ONIMUSHA, "Onimusha", daysAgo(8, 19), 1),
    session("s3", ONIMUSHA, "Onimusha", daysAgo(8, 9), 4.3),
    session("s4", ONIMUSHA, "Onimusha", daysAgo(7, 17), 1.7),
    session("s5", ONIMUSHA, "Onimusha", daysAgo(6, 17), 0.8),
    session("s6", ONIMUSHA, "Onimusha", daysAgo(4, 19), 1),
    session("s7", ONIMUSHA, "Onimusha", daysAgo(1, 7), 0.8),
    session("s8", ONIMUSHA, "Onimusha", daysAgo(1, 9), 1.8),
  ];
}

describe("SteamSessionsService.getSessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers an empty page rather than throwing before the first session", async () => {
    const { prisma } = mockPrisma({ sessions: [] });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.sessions).toEqual([]);
    expect(page.window.observedSince).toBeNull();
    expect(page.window.sessionCount).toBe(0);
    expect(page.records.longest).toBeNull();
    expect(page.hourMatrix).toHaveLength(7);
  });

  it("returns the window's sessions newest first, each with a headline even without unlocks", async () => {
    const { prisma } = mockPrisma({ sessions: onimushaWeek() });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.sessions.map((s) => s.id)).toEqual([
      "s8",
      "s7",
      "s6",
      "s5",
      "s4",
      "s3",
      "s2",
      "s1",
    ]);
    for (const s of page.sessions) {
      expect(s.unlocks).toEqual([]);
      expect(s.beats.length).toBeGreaterThan(0);
      expect(s.beats.at(-1)?.kind).toBe("shape");
    }
    // The marathon earns both "longest" beats; the in-game one edges ahead
    // because it is scaled by distance from the game's median.
    const marathon = page.sessions.find((s) => s.id === "s3");
    expect(marathon?.beats.slice(0, 2).map((b) => b.kind)).toEqual([
      "longest-in-game",
      "longest-in-window",
    ]);
    expect(page.window.sessionCount).toBe(8);
    expect(page.window.observedSince).toBe(daysAgo(9, 18).toISOString());
  });

  it("keeps older sessions out of the page but in the game's history", async () => {
    const old = session("old", ONIMUSHA, "Onimusha", daysAgo(120, 18), 6);
    const { prisma } = mockPrisma({ sessions: [old, ...onimushaWeek()] });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.sessions.map((s) => s.id)).not.toContain("old");
    expect(page.window.observedSince).toBe(old.startedAt.toISOString());
    // The 6 h sitting from June still outranks the marathon inside the game.
    const marathon = page.sessions.find((s) => s.id === "s3");
    expect(marathon?.beats.find((b) => b.kind === "longest-in-game")).toMatchObject({
      rank: 2,
      of: 9,
    });
    // A return beat, since the week's first session follows a 110-day gap.
    expect(page.sessions.at(-1)?.beats.find((b) => b.kind === "return")).toMatchObject({
      daysSince: 110,
    });
  });

  it("joins unlocks to the session whose window holds them and lists the rest off-camera", async () => {
    const sessions = onimushaWeek();
    const s3 = sessions[2];
    if (!s3) throw new Error("fixture");
    const inside = new Date(s3.startedAt.getTime() + 2 * HOUR);
    const afterTick = new Date(s3.startedAt.getTime() + 4.3 * HOUR + 3 * 60 * 1000);
    const orphan = daysAgo(3, 22);
    const { prisma } = mockPrisma({
      sessions,
      unlocks: [
        { appid: ONIMUSHA, apiName: "A", unlockedAt: inside, percent: 2.5 },
        { appid: ONIMUSHA, apiName: "B", unlockedAt: afterTick },
        { appid: MORTAL_SHELL, apiName: "C", unlockedAt: orphan },
        {
          appid: MORTAL_SHELL,
          apiName: "D",
          unlockedAt: new Date(orphan.getTime() + HOUR),
        },
      ],
      totals: { [ONIMUSHA]: 40 },
      unlocked: { [ONIMUSHA]: 12 },
    });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    const marathon = page.sessions.find((s) => s.id === "s3");
    expect(marathon?.unlocks.map((u) => u.apiName)).toEqual(["A", "B"]);
    expect(marathon?.unlocks[0]).toMatchObject({
      displayName: "A label",
      globalPercent: 2.5,
    });
    expect(marathon?.beats.find((b) => b.kind === "unlocks")).toMatchObject({
      count: 2,
      rarestPercent: 2.5,
    });
    expect(page.offCamera).toEqual([
      {
        game: { appid: MORTAL_SHELL, name: `Game ${MORTAL_SHELL}` },
        day: "2026-09-12",
        count: 2,
        sample: [
          expect.objectContaining({ apiName: "C" }),
          expect.objectContaining({ apiName: "D" }),
        ],
      },
    ]);
    expect(page.records.mostUnlocks).toMatchObject({ sessionId: "s3", value: 2 });
    expect(page.records.longestDrySpell).toMatchObject({ sessionId: "s1" });
    expect(page.perGame[0]?.unlockTicks).toEqual([
      inside.toISOString(),
      afterTick.toISOString(),
    ]);
  });

  it("reads the lifetime counter from the first snapshot after the session for milestones", async () => {
    const sessions = onimushaWeek();
    const s3 = sessions[2];
    if (!s3) throw new Error("fixture");
    const { prisma } = mockPrisma({
      sessions,
      snapshots: {
        [ONIMUSHA]: [
          [daysAgo(9, 0), 3 * 60],
          // The row for s3's day also holds s2, played that evening.
          // Subtracting s2 leaves 640 for s3, so only s3 spans the 600 mark.
          [daysAgo(8, 0), 700],
          [daysAgo(2, 0), 20 * 60],
        ],
      },
    });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.milestones).toEqual([
      {
        game: { appid: ONIMUSHA, name: "Onimusha" },
        hours: 10,
        sessionId: "s3",
        crossedAt: expect.any(String),
      },
    ]);
  });

  it("drops a hidden game wherever it would be named, but still counts it in the aggregates", async () => {
    const sessions = [
      ...onimushaWeek(),
      // Right after s8, so it is s8's `after` neighbour.
      session("h1", HIDDEN, "Something Private", daysAgo(1, 11), 3),
    ];
    const { prisma, unlockFindMany } = mockPrisma({
      sessions,
      unlocks: [{ appid: HIDDEN, apiName: "X", unlockedAt: daysAgo(5, 21) }],
    });
    const page = await new SteamSessionsService(prisma).getSessions(
      12,
      curation([HIDDEN])
    );
    expect(unlockFindMany.mock.calls[0]?.[0]?.where.appid).toEqual({ notIn: [HIDDEN] });
    expect(page.sessions.map((s) => s.game.appid)).not.toContain(HIDDEN);
    expect(page.perGame.map((g) => g.game.appid)).toEqual([ONIMUSHA]);
    expect(page.offCamera).toEqual([]);
    const s8 = page.sessions.find((s) => s.id === "s8");
    expect(s8?.beats.map((b) => b.kind)).not.toContain("moved-on-to");
    // Anonymous aggregates keep the hidden hours: 11:00Z is 13:00 Brussels on
    // a Sunday, a cell s3 (the Sunday before) already fills for an hour.
    expect(page.window.sessionCount).toBe(9);
    expect(page.hourMatrix[6]?.[13]).toBe(120);

    const all = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(all.sessions[0]?.game.appid).toBe(HIDDEN);
    expect(all.offCamera[0]?.game.appid).toBe(HIDDEN);
    expect(
      all.sessions.find((s) => s.id === "s8")?.beats.find((b) => b.kind === "moved-on-to")
    ).toMatchObject({ name: "Something Private" });
  });

  it("does not let a session inherit a milestone from later play on the snapshot's own day", async () => {
    // s7 (07:00Z) and s8 (09:00Z) share a local day; the snapshot for that day
    // reads back as midnight but holds both. s7 must not carry the 10 h mark
    // s8 crossed.
    const sessions = onimushaWeek();
    const { prisma } = mockPrisma({
      sessions,
      snapshots: { [ONIMUSHA]: [[daysAgo(1, 0), 10 * 60 + 30]] },
    });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.milestones.map((m) => m.sessionId)).toEqual(["s8"]);
  });

  it("names the records, with a past-midnight finish beating a late-evening one", async () => {
    const sessions = [
      session("eve", ONIMUSHA, "Onimusha", daysAgo(3, 19), 2.98), // 21:00 → 23:59 local
      session("night", ONIMUSHA, "Onimusha", daysAgo(2, 20), 4.2), // 22:00 → 02:12 local
      session("blip", ONIMUSHA, "Onimusha", daysAgo(2, 12), 0.01),
      session("short", ONIMUSHA, "Onimusha", daysAgo(1, 12), 0.5),
    ];
    const { prisma } = mockPrisma({ sessions });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.records.longest).toMatchObject({ sessionId: "night", value: 252 });
    expect(page.records.latestFinish).toMatchObject({
      sessionId: "night",
      value: 26 * 60 + 12,
    });
    // A single-tick session is a poller artefact, not the quickest bounce.
    expect(page.records.quickestBounce).toMatchObject({ sessionId: "short", value: 30 });
    expect(page.records.mostUnlocks).toBeNull();
    expect(page.records.longestDrySpell).toBeNull();
  });

  it("carries the open session as live, with only its launch-time beats", async () => {
    const sessions = onimushaWeek();
    const { prisma } = mockPrisma({
      sessions,
      open: { id: "open", appid: ONIMUSHA, name: "Onimusha", startedAt: daysAgo(0, 9) },
    });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.live).toMatchObject({
      id: "open",
      game: { appid: ONIMUSHA, name: "Onimusha" },
      startedAt: daysAgo(0, 9).toISOString(),
    });
    // s7 and s8 were yesterday, so today's launch is the second day running —
    // short of a streak — and nothing duration-based may appear yet.
    expect(page.live?.beats.map((b) => b.kind)).not.toContain("longest-in-game");
    expect(page.live?.beats.map((b) => b.kind)).not.toContain("shape");
    // The open row is not a closed session.
    expect(page.sessions.map((s) => s.id)).not.toContain("open");
    expect(page.window.sessionCount).toBe(8);
  });

  it("hides a live session in a hidden game from a visitor", async () => {
    const { prisma } = mockPrisma({
      sessions: onimushaWeek(),
      open: {
        id: "open",
        appid: HIDDEN,
        name: "Something Private",
        startedAt: daysAgo(0, 9),
      },
    });
    const svc = new SteamSessionsService(prisma);
    expect((await svc.getSessions(12, curation([HIDDEN]))).live).toBeNull();
    expect((await svc.getSessions(12, NO_CURATION)).live?.game.appid).toBe(HIDDEN);
  });

  it("does not call an open row live once the poller has gone quiet", async () => {
    const open = {
      id: "open",
      appid: ONIMUSHA,
      name: "Onimusha",
      startedAt: daysAgo(0, 9),
    };
    const stale = mockPrisma({
      sessions: onimushaWeek(),
      open,
      poll: {
        currentAppid: ONIMUSHA,
        lastPolledAt: new Date(NOW.getTime() - 16 * 60_000),
      },
    });
    expect(
      (await new SteamSessionsService(stale.prisma).getSessions(12, NO_CURATION)).live
    ).toBeNull();
    const moved = mockPrisma({
      sessions: onimushaWeek(),
      open,
      poll: { currentAppid: null, lastPolledAt: new Date(NOW.getTime() - 60_000) },
    });
    expect(
      (await new SteamSessionsService(moved.prisma).getSessions(12, NO_CURATION)).live
    ).toBeNull();
  });

  it("answers no live session when nothing is open", async () => {
    const { prisma } = mockPrisma({ sessions: onimushaWeek() });
    const page = await new SteamSessionsService(prisma).getSessions(12, NO_CURATION);
    expect(page.live).toBeNull();
  });

  it("clamps the window to the allowed span", async () => {
    const { prisma } = mockPrisma({ sessions: onimushaWeek() });
    const svc = new SteamSessionsService(prisma);
    const wide = await svc.getSessions(500, NO_CURATION);
    expect(new Date(wide.window.from).getTime()).toBe(NOW.getTime() - 52 * 7 * DAY);
    const narrow = await svc.getSessions(0, NO_CURATION);
    expect(new Date(narrow.window.from).getTime()).toBe(NOW.getTime() - 7 * DAY);
  });
});
