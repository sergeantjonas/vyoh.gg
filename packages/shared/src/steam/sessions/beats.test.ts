import { describe, expect, it } from "vitest";
import { OWNER_TIME_ZONE } from "../../time-zone.ts";
import {
  BEAT_RANK_MIN_SESSIONS,
  BEAT_RETURN_MIN_DAYS,
  type BeatSession,
  type SessionBeatContext,
  type SteamSessionBeat,
  selectLiveSessionBeats,
  selectSessionBeats,
} from "./beats.ts";
import { buildHourMatrix } from "./hour-matrix.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ONIMUSHA = 3_000_001;
const WALLPAPER = 431960;

/** Brussels is UTC+2 in September; local 20:00 on 2026-09-08 (a Tuesday). */
const TUE_2000 = new Date("2026-09-08T18:00:00Z");

function session(appid: number, startedAt: Date, hours: number): BeatSession {
  return { appid, startedAt, endedAt: new Date(startedAt.getTime() + hours * HOUR) };
}

/** Evenings of the same game on the given day offsets, two hours each. */
function evenings(appid: number, dayOffsets: number[], hours = 2): BeatSession[] {
  return dayOffsets.map((d) =>
    session(appid, new Date(TUE_2000.getTime() + d * DAY), hours)
  );
}

function context(
  target: BeatSession,
  overrides: Partial<SessionBeatContext> = {}
): SessionBeatContext {
  const gameSessions = overrides.gameSessions ?? [target];
  const windowSessions = overrides.windowSessions ?? gameSessions;
  return {
    session: target,
    gameSessions,
    windowSessions,
    before: null,
    after: null,
    playtimeForeverMinutes: null,
    completion: null,
    unlocks: [],
    hourMatrix: buildHourMatrix(windowSessions, OWNER_TIME_ZONE),
    timeZone: OWNER_TIME_ZONE,
    ...overrides,
  };
}

/** Two-hour evenings on the given past days, plus a longer one today as the target. */
function marathonAmong(
  pastDayOffsets: number[],
  hours: number
): { target: BeatSession; gameSessions: BeatSession[] } {
  const target = session(ONIMUSHA, TUE_2000, hours);
  return { target, gameSessions: [...evenings(ONIMUSHA, pastDayOffsets), target] };
}

/** Indexed fixture access that fails loudly instead of leaking `undefined`. */
function nth<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new Error(`fixture has no entry ${i}`);
  return v;
}

function strength(beats: SteamSessionBeat[], kind: SteamSessionBeat["kind"]): number {
  const b = beats.find((x) => x.kind === kind);
  if (!b) throw new Error(`no ${kind} beat`);
  return b.strength;
}

function kinds(beats: SteamSessionBeat[]): string[] {
  return beats.map((b) => b.kind);
}

function find<K extends SteamSessionBeat["kind"]>(
  beats: SteamSessionBeat[],
  kind: K
): Extract<SteamSessionBeat, { kind: K }> | undefined {
  return beats.find((b): b is Extract<SteamSessionBeat, { kind: K }> => b.kind === kind);
}

describe("selectSessionBeats", () => {
  it("always ends with the session's shape, so a quiet session still has a headline", () => {
    const only = session(ONIMUSHA, TUE_2000, 1.5);
    const beats = selectSessionBeats(context(only));
    expect(beats.at(-1)).toEqual({
      kind: "shape",
      strength: 0.1,
      slot: { weekday: 1, hour: 20 },
      durationMinutes: 90,
    });
    expect(beats).toHaveLength(1);
  });

  it("gives a zero-unlock session a real headline when it is the longest of its game", () => {
    const { target, gameSessions } = marathonAmong([-6, -3], 5);
    const beats = selectSessionBeats(context(target, { gameSessions }));
    expect(beats[0]?.kind).toBe("longest-in-game");
    expect(find(beats, "longest-in-game")).toMatchObject({ rank: 1, of: 3 });
    expect(find(beats, "unlocks")).toBeUndefined();
  });

  it("withholds a rank while the game has too few sessions to rank in", () => {
    const few = evenings(ONIMUSHA, [-1, 0]);
    expect(few).toHaveLength(BEAT_RANK_MIN_SESSIONS - 1);
    const beats = selectSessionBeats(context(nth(few, 1), { gameSessions: few }));
    expect(find(beats, "longest-in-game")).toBeUndefined();
  });

  it("ranks unlocks by count and lifts a rare one above a common handful", () => {
    const target = session(ONIMUSHA, TUE_2000, 2);
    const at = (h: number) => ({ unlockedAt: new Date(TUE_2000.getTime() + h * HOUR) });
    const common = selectSessionBeats(
      context(target, {
        unlocks: [
          { ...at(0.5), globalPercent: 60 },
          { ...at(1), globalPercent: 45 },
          { ...at(1.5), globalPercent: 30 },
        ],
      })
    );
    const rare = selectSessionBeats(
      context(target, { unlocks: [{ ...at(1), globalPercent: 0.8 }] })
    );
    expect(find(common, "unlocks")).toMatchObject({ count: 3, rarestPercent: 30 });
    expect(find(rare, "unlocks")).toMatchObject({ count: 1, rarestPercent: 0.8 });
    expect(strength(rare, "unlocks")).toBeGreaterThan(strength(common, "unlocks"));
  });

  it("reads a return after a long gap and scales it with the gap", () => {
    const june = session(ONIMUSHA, new Date(TUE_2000.getTime() - 80 * DAY), 2);
    const target = session(ONIMUSHA, TUE_2000, 2);
    const beats = selectSessionBeats(context(target, { gameSessions: [june, target] }));
    const ret = find(beats, "return");
    // 80 days between the starts, minus the two hours June ran, floors to 79.
    expect(ret).toMatchObject({ daysSince: 79 });
    const recent = session(
      ONIMUSHA,
      new Date(TUE_2000.getTime() - (BEAT_RETURN_MIN_DAYS - 1) * DAY),
      2
    );
    expect(
      find(
        selectSessionBeats(context(target, { gameSessions: [recent, target] })),
        "return"
      )
    ).toBeUndefined();
    const year = session(ONIMUSHA, new Date(TUE_2000.getTime() - 365 * DAY), 2);
    expect(
      strength(
        selectSessionBeats(context(target, { gameSessions: [year, target] })),
        "return"
      )
    ).toBeGreaterThan(strength(beats, "return"));
  });

  it("counts a streak of consecutive local days ending today", () => {
    const run = evenings(ONIMUSHA, [-3, -2, -1, 0]);
    const beats = selectSessionBeats(context(nth(run, 3), { gameSessions: run }));
    expect(find(beats, "streak")).toMatchObject({ days: 4 });
    const broken = evenings(ONIMUSHA, [-4, -2, -1, 0]);
    expect(
      find(
        selectSessionBeats(context(nth(broken, 3), { gameSessions: broken })),
        "streak"
      )
    ).toMatchObject({
      days: 3,
    });
  });

  it("finds the lifetime hour mark a session carried the game across", () => {
    const target = session(ONIMUSHA, TUE_2000, 3);
    const beats = selectSessionBeats(
      context(target, { playtimeForeverMinutes: 51 * 60 })
    );
    expect(find(beats, "milestone")).toMatchObject({ hours: 50 });
    const flat = selectSessionBeats(context(target, { playtimeForeverMinutes: 40 * 60 }));
    expect(find(flat, "milestone")).toBeUndefined();
  });

  it("calls a first session that is nearly all of the game's playtime a first session", () => {
    const target = session(ONIMUSHA, TUE_2000, 3);
    const beats = selectSessionBeats(context(target, { playtimeForeverMinutes: 185 }));
    expect(find(beats, "first-session")).toMatchObject({ shareOfLifetime: 180 / 185 });
    const partial = selectSessionBeats(context(target, { playtimeForeverMinutes: 600 }));
    expect(find(partial, "first-session")).toBeUndefined();
  });

  it("crowns the longest session in the window and breaks a tie toward the newer one", () => {
    const others = [
      ...evenings(ONIMUSHA, [-8, -6, -4], 1),
      session(WALLPAPER, new Date(TUE_2000.getTime() - 2 * DAY), 3),
    ];
    const target = session(ONIMUSHA, TUE_2000, 3);
    const windowSessions = [...others, target];
    const beats = selectSessionBeats(
      context(target, { gameSessions: [target], windowSessions })
    );
    expect(find(beats, "longest-in-window")).toMatchObject({ of: 5 });
    const olderTie = nth(others, 3);
    const tieBeats = selectSessionBeats(
      context(olderTie, { gameSessions: [olderTie], windowSessions })
    );
    expect(find(tieBeats, "longest-in-window")).toBeUndefined();
    const thin = selectSessionBeats(
      context(target, {
        gameSessions: [target],
        windowSessions: [target, nth(others, 0)],
      })
    );
    expect(find(thin, "longest-in-window")).toBeUndefined();
  });

  it("marks an early start between five and eight in the morning", () => {
    const dawn = session(ONIMUSHA, new Date("2026-09-08T04:30:00Z"), 1); // 06:30 local
    expect(find(selectSessionBeats(context(dawn)), "early-start")).toMatchObject({
      startHour: 6,
    });
    const morning = session(ONIMUSHA, new Date("2026-09-08T07:00:00Z"), 1); // 09:00 local
    expect(find(selectSessionBeats(context(morning)), "early-start")).toBeUndefined();
  });

  it("marks a past-midnight finish but not a session that merely sits in the small hours", () => {
    const late = session(ONIMUSHA, new Date("2026-09-08T20:40:00Z"), 4.2);
    expect(find(selectSessionBeats(context(late)), "late-finish")).toMatchObject({
      endHour: 2,
    });
    const straddle = session(ONIMUSHA, new Date("2026-09-08T21:55:00Z"), 0.2); // 23:55 → 00:07
    expect(find(selectSessionBeats(context(straddle)), "late-finish")).toBeUndefined();
    const smallHours = session(ONIMUSHA, new Date("2026-09-09T00:00:00Z"), 1);
    expect(find(selectSessionBeats(context(smallHours)), "late-finish")).toBeUndefined();
  });

  it("names a short neighbour before it as a bounce and a different game after it", () => {
    const target = session(ONIMUSHA, TUE_2000, 2);
    const before = {
      appid: WALLPAPER,
      name: "Wallpaper Engine",
      startedAt: new Date(TUE_2000.getTime() - 10 * 60 * 1000),
      endedAt: new Date(TUE_2000.getTime() - 2 * 60 * 1000),
    };
    const after = {
      appid: 2_000_002,
      name: "ELDEN RING NIGHTREIGN",
      startedAt: target.endedAt,
      endedAt: new Date(target.endedAt.getTime() + HOUR),
    };
    const beats = selectSessionBeats(context(target, { before, after }));
    expect(find(beats, "bounced-from")).toMatchObject({
      name: "Wallpaper Engine",
      minutes: 8,
    });
    expect(find(beats, "moved-on-to")).toMatchObject({ name: "ELDEN RING NIGHTREIGN" });
    const longBefore = { ...before, startedAt: new Date(TUE_2000.getTime() - 2 * HOUR) };
    expect(
      find(selectSessionBeats(context(target, { before: longBefore })), "bounced-from")
    ).toBeUndefined();
  });

  it("treats a finished game the owner keeps opening as a beat, and near-completion as a weaker one", () => {
    const target = session(ONIMUSHA, TUE_2000, 2);
    expect(
      find(
        selectSessionBeats(context(target, { completion: { total: 40, unlocked: 40 } })),
        "completed-and-back"
      )
    ).toMatchObject({ total: 40 });
    expect(
      find(
        selectSessionBeats(context(target, { completion: { total: 40, unlocked: 38 } })),
        "nearly-complete"
      )
    ).toMatchObject({ remaining: 2 });
    expect(
      find(
        selectSessionBeats(context(target, { completion: { total: 40, unlocked: 10 } })),
        "nearly-complete"
      )
    ).toBeUndefined();
  });

  it("only speaks about the usual slot once the heatmap has enough behind it", () => {
    const thin = evenings(ONIMUSHA, [-2, -1, 0], 1);
    expect(
      kinds(selectSessionBeats(context(nth(thin, 2), { gameSessions: thin })))
    ).not.toContain("usual-slot");
    const habit = evenings(ONIMUSHA, [-14, -12, -10, -8, -6, -4, -2, 0], 3);
    const beats = selectSessionBeats(context(nth(habit, 7), { gameSessions: habit }));
    expect(find(beats, "usual-slot")).toMatchObject({ slot: { weekday: 1, hour: 20 } });
  });

  it("calls a slot the owner has never used before unusual, once the matrix has texture", () => {
    const sparse = evenings(ONIMUSHA, [-14, -12, -10, -8, -6, -4, -2], 3);
    const sparseMorning = session(ONIMUSHA, new Date("2026-09-08T07:30:00Z"), 1);
    expect(
      find(
        selectSessionBeats(
          context(sparseMorning, { gameSessions: [...sparse, sparseMorning] })
        ),
        "unusual-slot"
      )
    ).toBeUndefined();
    // Two weeks of three-hour sessions, evenings one week and afternoons the
    // next: each weekday fills six cells, 42 with the morning's own, which
    // clears the 40-cell gate.
    const habit = [
      ...evenings(ONIMUSHA, [-20, -19, -18, -17, -16, -15, -14], 3),
      ...[-13, -12, -11, -10, -9, -8, -7].map((d) =>
        session(ONIMUSHA, new Date(TUE_2000.getTime() + d * DAY - 6 * HOUR), 3)
      ),
    ];
    const morning = session(ONIMUSHA, new Date("2026-09-08T07:30:00Z"), 1);
    const all = [...habit, morning];
    const beats = selectSessionBeats(context(morning, { gameSessions: all }));
    expect(find(beats, "unusual-slot")).toMatchObject({ slot: { weekday: 1, hour: 9 } });
    // A long session starting in a cell the owner does use every week must
    // not read as unusual just because its own minutes dwarf the cell.
    const longInHabitSlot = session(ONIMUSHA, new Date("2026-09-08T18:40:00Z"), 5);
    const weekly = selectSessionBeats(
      context(longInHabitSlot, { gameSessions: [...habit, longInHabitSlot] })
    );
    expect(find(weekly, "unusual-slot")).toBeUndefined();
  });

  it("keeps only launch-time beats for a session still running, and no shape floor", () => {
    const june = session(ONIMUSHA, new Date(TUE_2000.getTime() - 80 * DAY), 2);
    const running = session(ONIMUSHA, TUE_2000, 6);
    const before = {
      appid: WALLPAPER,
      name: "Wallpaper Engine",
      startedAt: new Date(TUE_2000.getTime() - 10 * 60 * 1000),
      endedAt: new Date(TUE_2000.getTime() - 2 * 60 * 1000),
    };
    const beats = selectLiveSessionBeats(
      context(running, {
        gameSessions: [june, running],
        windowSessions: [june, running],
        before,
        playtimeForeverMinutes: 51 * 60,
      })
    );
    expect(kinds(beats)).toEqual(["return", "bounced-from"]);
    expect(kinds(beats)).not.toContain("shape");
    // The same context, closed, would also claim the rank and the milestone.
    const closed = kinds(
      selectSessionBeats(
        context(running, {
          gameSessions: [june, running],
          windowSessions: [june, running],
          before,
          playtimeForeverMinutes: 51 * 60,
        })
      )
    );
    expect(closed).toContain("milestone");
    expect(closed.at(-1)).toBe("shape");
  });

  it("orders beats strongest first with the shape last", () => {
    const { target, gameSessions } = marathonAmong([-6, -3], 6);
    const beats = selectSessionBeats(
      context(target, {
        gameSessions,
        unlocks: [{ unlockedAt: new Date(TUE_2000.getTime() + HOUR), globalPercent: 50 }],
      })
    );
    const strengths = beats.slice(0, -1).map((x) => x.strength);
    expect([...strengths].sort((x, y) => y - x)).toEqual(strengths);
    expect(beats.at(-1)?.kind).toBe("shape");
  });
});
