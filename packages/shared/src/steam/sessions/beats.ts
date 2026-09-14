// The beat model — what a session's headline is about. Each signal below
// yields at most one beat with a strength in (0, 1]; the strongest becomes
// the hero prose, the next one or two become supporting chips. The web owns
// the copy; this file owns the choice and the numbers the copy needs.
//
// Absence is never a beat. A session with no unlocks scores nothing on the
// unlock axis and wins on whichever axis it does stand out on, and the
// session's own shape is always emitted as a floor — so the page never has
// a "nothing happened" branch (docs/working-notes/steam/play-sittings.md
// § The beat model).
//
// Strengths are relative to the owner's own history where they can be: a
// rank counts more the further it sits from the median, a return counts
// more the longer the gap, a milestone counts more the rounder the number.
// The weights are pinned here rather than spread through the emitters so a
// change to one axis is a one-line diff next to the others.

import {
  type LocalSlot,
  hourMatrixCellRank,
  hourMatrixFilledCells,
  hourMatrixTotalMinutes,
  localSlot,
} from "./hour-matrix.ts";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Fewer sessions of a game than this and a rank inside it is not a claim. */
export const BEAT_RANK_MIN_SESSIONS = 3;
/** Same floor for the cross-game window rank. */
export const BEAT_WINDOW_MIN_SESSIONS = 5;
/** A gap since the last session of the same game that reads as a return. */
export const BEAT_RETURN_MIN_DAYS = 14;
/** Consecutive owner-local days with a session in the game before it is a streak. */
export const BEAT_STREAK_MIN_DAYS = 3;
/** Lifetime hour marks a session can carry a game across. */
export const BEAT_MILESTONE_HOURS = [10, 25, 50, 100, 250, 500, 1000] as const;
/** A neighbouring session shorter than this reads as a bounce. */
export const BEAT_BOUNCE_MAX_MINUTES = 15;
/** Owner-local end hour strictly below this is a past-midnight finish… */
export const BEAT_LATE_FINISH_BEFORE_HOUR = 5;
/** …provided the session ran at least this long. */
export const BEAT_LATE_FINISH_MIN_MINUTES = 60;
/** Owner-local start hour strictly below this is an early start. */
export const BEAT_EARLY_START_BEFORE_HOUR = 8;
/** A cell within this rank of the heatmap is the owner's usual slot… */
export const BEAT_USUAL_SLOT_MAX_RANK = 3;
/** …once the heatmap holds this many minutes; before that there is no usual. */
export const BEAT_SLOT_MIN_TOTAL_MINUTES = 20 * 60;
/**
 * An empty cell only reads as unusual once the matrix has texture — this many
 * cells already filled. Under that, most hours are empty and "unusual" would
 * headline every other session. Measured 2026-09-14 on the live table: eight
 * games and twenty hours filled ~25 cells and put `unusual-slot` on three of
 * the eight newest sessions.
 */
export const BEAT_UNUSUAL_SLOT_MIN_CELLS = 40;
/** A first session covering this share of lifetime playtime is "all of it". */
export const BEAT_FIRST_SESSION_MIN_SHARE = 0.9;
/** Rarity below this percent turns an unlock beat into a rarity beat. */
export const BEAT_RARE_UNLOCK_PERCENT = 5;

export type SteamSessionBeat =
  | {
      kind: "longest-in-game";
      strength: number;
      /** 1 = the longest session of this game on record. */
      rank: number;
      /** Sessions of the game the rank is out of, this one included. */
      of: number;
    }
  | { kind: "longest-in-window"; strength: number; of: number }
  | { kind: "late-finish"; strength: number; endHour: number }
  | { kind: "early-start"; strength: number; startHour: number }
  | { kind: "return"; strength: number; daysSince: number }
  | { kind: "streak"; strength: number; days: number }
  | { kind: "milestone"; strength: number; hours: number }
  | { kind: "first-session"; strength: number; shareOfLifetime: number }
  | {
      kind: "bounced-from";
      strength: number;
      appid: number;
      name: string;
      minutes: number;
    }
  | { kind: "moved-on-to"; strength: number; appid: number; name: string }
  | { kind: "completed-and-back"; strength: number; total: number }
  | { kind: "nearly-complete"; strength: number; remaining: number; total: number }
  | {
      kind: "unlocks";
      strength: number;
      count: number;
      /** Lowest global percent among them, or null when none is polled. */
      rarestPercent: number | null;
    }
  | { kind: "usual-slot"; strength: number; slot: LocalSlot; rank: number }
  | { kind: "unusual-slot"; strength: number; slot: LocalSlot }
  | { kind: "shape"; strength: number; slot: LocalSlot; durationMinutes: number };

export type SteamSessionBeatKind = SteamSessionBeat["kind"];

export interface BeatSession {
  appid: number;
  startedAt: Date;
  endedAt: Date;
}

export interface BeatNeighbour {
  appid: number;
  name: string;
  startedAt: Date;
  endedAt: Date;
}

export interface BeatUnlock {
  unlockedAt: Date;
  globalPercent: number | null;
}

export interface SessionBeatContext {
  session: BeatSession;
  /** Every closed session of the same game, this one included, any order. */
  gameSessions: readonly BeatSession[];
  /** Every closed session of any game in the page's window, this one included. */
  windowSessions: readonly BeatSession[];
  /** The session that ended right before this one started, any game. */
  before: BeatNeighbour | null;
  /** The session that started right after this one ended, any game. */
  after: BeatNeighbour | null;
  /**
   * Steam's lifetime counter for the game as of the first snapshot taken
   * after this session ended — the milestone check subtracts the session
   * from it, so a later snapshot would attribute other sessions' hours here.
   */
  playtimeForeverMinutes: number | null;
  /** Achievement totals for the game after this session; null when it has none. */
  completion: { total: number; unlocked: number } | null;
  /** Unlocks already joined to this session by `unlocksWithin`. */
  unlocks: readonly BeatUnlock[];
  /** `buildHourMatrix` over the window, this session included. */
  hourMatrix: readonly (readonly number[])[];
  timeZone: string;
}

export function sessionDurationMinutes(s: BeatSession): number {
  return Math.max(
    0,
    Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / MINUTE_MS)
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lo = sorted[mid - 1] ?? sorted[mid] ?? 0;
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 0 ? (lo + hi) / 2 : hi;
}

function isSame(a: BeatSession, b: BeatSession): boolean {
  return (
    a.appid === b.appid &&
    a.startedAt.getTime() === b.startedAt.getTime() &&
    a.endedAt.getTime() === b.endedAt.getTime()
  );
}

/** Owner-local calendar day as a UTC day index, for counting distinct days. */
function localDayIndex(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  let y = 0;
  let m = 1;
  let d = 1;
  for (const p of parts) {
    if (p.type === "year") y = Number(p.value);
    else if (p.type === "month") m = Number(p.value);
    else if (p.type === "day") d = Number(p.value);
  }
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function longestInGame(ctx: SessionBeatContext): SteamSessionBeat | null {
  const durations = ctx.gameSessions.map(sessionDurationMinutes);
  if (durations.length < BEAT_RANK_MIN_SESSIONS) return null;
  const mine = sessionDurationMinutes(ctx.session);
  const rank = durations.filter((d) => d > mine).length + 1;
  const mid = median(durations);
  if (rank === 1) {
    // Longest ever, scaled by how far above the game's median it sits.
    const ratio = mid > 0 ? mine / mid : 2;
    return {
      kind: "longest-in-game",
      strength: clamp01(0.7 + 0.1 * Math.min(3, Math.log2(Math.max(1, ratio)))),
      rank,
      of: durations.length,
    };
  }
  if (rank <= BEAT_USUAL_SLOT_MAX_RANK && durations.length >= BEAT_WINDOW_MIN_SESSIONS) {
    return { kind: "longest-in-game", strength: 0.5, rank, of: durations.length };
  }
  return null;
}

function longestInWindow(ctx: SessionBeatContext): SteamSessionBeat | null {
  if (ctx.windowSessions.length < BEAT_WINDOW_MIN_SESSIONS) return null;
  const mine = sessionDurationMinutes(ctx.session);
  const myStart = ctx.session.startedAt.getTime();
  // Durations are rounded off ~2-minute ticks, so ties are ordinary; the
  // newer session keeps the title so two sessions never both claim it.
  const longer = ctx.windowSessions.some((s) => {
    if (isSame(s, ctx.session)) return false;
    const d = sessionDurationMinutes(s);
    return d > mine || (d === mine && s.startedAt.getTime() > myStart);
  });
  if (longer) return null;
  return { kind: "longest-in-window", strength: 0.85, of: ctx.windowSessions.length };
}

function clockBeats(ctx: SessionBeatContext): SteamSessionBeat[] {
  const out: SteamSessionBeat[] = [];
  const start = localSlot(ctx.session.startedAt, ctx.timeZone);
  const end = localSlot(ctx.session.endedAt, ctx.timeZone);
  const startDay = localDayIndex(ctx.session.startedAt, ctx.timeZone);
  const endDay = localDayIndex(ctx.session.endedAt, ctx.timeZone);
  // A finish before five in the morning on the day after it started. A
  // session that both starts and ends at 03:00 is an odd hour, not a run
  // past midnight, and twelve minutes straddling 00:00 is not a run at all.
  if (
    endDay > startDay &&
    end.hour < BEAT_LATE_FINISH_BEFORE_HOUR &&
    sessionDurationMinutes(ctx.session) >= BEAT_LATE_FINISH_MIN_MINUTES
  ) {
    out.push({
      kind: "late-finish",
      strength: 0.55 + 0.05 * end.hour,
      endHour: end.hour,
    });
  }
  if (
    start.hour < BEAT_EARLY_START_BEFORE_HOUR &&
    start.hour >= BEAT_LATE_FINISH_BEFORE_HOUR
  ) {
    out.push({ kind: "early-start", strength: 0.4, startHour: start.hour });
  }
  return out;
}

function returnBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  const startMs = ctx.session.startedAt.getTime();
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const s of ctx.gameSessions) {
    const end = s.endedAt.getTime();
    if (end <= startMs && !isSame(s, ctx.session) && end > previousEnd) previousEnd = end;
  }
  if (!Number.isFinite(previousEnd)) return null;
  const daysSince = Math.floor((startMs - previousEnd) / DAY_MS);
  if (daysSince < BEAT_RETURN_MIN_DAYS) return null;
  // log10(14) ≈ 1.15 → 0.55; a year → 0.83.
  return {
    kind: "return",
    strength: clamp01(0.4 + 0.2 * (Math.log10(daysSince) - 0.4)),
    daysSince,
  };
}

function streakBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  const today = localDayIndex(ctx.session.startedAt, ctx.timeZone);
  const days = new Set<number>();
  for (const s of ctx.gameSessions) {
    const d = localDayIndex(s.startedAt, ctx.timeZone);
    if (d <= today) days.add(d);
  }
  let run = 0;
  for (let d = today; days.has(d); d -= 1) run += 1;
  if (run < BEAT_STREAK_MIN_DAYS) return null;
  return {
    kind: "streak",
    strength: clamp01(0.5 + 0.08 * (run - BEAT_STREAK_MIN_DAYS)),
    days: run,
  };
}

function milestoneBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  if (ctx.playtimeForeverMinutes === null) return null;
  const after = ctx.playtimeForeverMinutes / 60;
  const before = after - sessionDurationMinutes(ctx.session) / 60;
  let crossed: number | null = null;
  for (const mark of BEAT_MILESTONE_HOURS) {
    if (before < mark && after >= mark) crossed = mark;
  }
  if (crossed === null) return null;
  // Rounder marks weigh more: 10 h → 0.55, 100 h → 0.75, 1000 h → 0.95.
  return {
    kind: "milestone",
    strength: clamp01(0.35 + 0.2 * Math.log10(crossed)),
    hours: crossed,
  };
}

function firstSessionBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  if (ctx.gameSessions.length !== 1 || ctx.playtimeForeverMinutes === null) return null;
  if (ctx.playtimeForeverMinutes <= 0) return null;
  const share = sessionDurationMinutes(ctx.session) / ctx.playtimeForeverMinutes;
  if (share < BEAT_FIRST_SESSION_MIN_SHARE) return null;
  return { kind: "first-session", strength: 0.8, shareOfLifetime: Math.min(1, share) };
}

function neighbourBeats(ctx: SessionBeatContext): SteamSessionBeat[] {
  const out: SteamSessionBeat[] = [];
  if (ctx.before && ctx.before.appid !== ctx.session.appid) {
    const minutes = sessionDurationMinutes(ctx.before);
    if (minutes <= BEAT_BOUNCE_MAX_MINUTES) {
      out.push({
        kind: "bounced-from",
        strength: 0.35,
        appid: ctx.before.appid,
        name: ctx.before.name,
        minutes,
      });
    }
  }
  if (ctx.after && ctx.after.appid !== ctx.session.appid) {
    out.push({
      kind: "moved-on-to",
      strength: 0.3,
      appid: ctx.after.appid,
      name: ctx.after.name,
    });
  }
  return out;
}

function completionBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  const c = ctx.completion;
  if (!c || c.total <= 0) return null;
  if (c.unlocked >= c.total) {
    // Every achievement earned and the owner is still here — the game has
    // outlived its checklist. Chip strength, not hero: it is true of every
    // session of the game from then on, so it cannot be the headline each time.
    return { kind: "completed-and-back", strength: 0.45, total: c.total };
  }
  const remaining = c.total - c.unlocked;
  if (remaining <= 3) {
    return { kind: "nearly-complete", strength: 0.45, remaining, total: c.total };
  }
  return null;
}

function unlockBeat(ctx: SessionBeatContext): SteamSessionBeat | null {
  const count = ctx.unlocks.length;
  if (count === 0) return null;
  let rarest: number | null = null;
  for (const u of ctx.unlocks) {
    if (u.globalPercent !== null && (rarest === null || u.globalPercent < rarest)) {
      rarest = u.globalPercent;
    }
  }
  let strength = 0.4 + 0.08 * Math.min(5, count);
  if (rarest !== null && rarest < BEAT_RARE_UNLOCK_PERCENT) {
    strength += rarest < 1 ? 0.3 : 0.2;
  }
  return { kind: "unlocks", strength: clamp01(strength), count, rarestPercent: rarest };
}

function slotBeats(ctx: SessionBeatContext): SteamSessionBeat[] {
  const total = hourMatrixTotalMinutes(ctx.hourMatrix);
  if (total < BEAT_SLOT_MIN_TOTAL_MINUTES) return [];
  const slot = localSlot(ctx.session.startedAt, ctx.timeZone);
  const rank = hourMatrixCellRank(ctx.hourMatrix, slot);
  if (rank <= BEAT_USUAL_SLOT_MAX_RANK) {
    return [{ kind: "usual-slot", strength: 0.25, slot, rank }];
  }
  if (hourMatrixFilledCells(ctx.hourMatrix) < BEAT_UNUSUAL_SLOT_MIN_CELLS) return [];
  // The matrix includes this session, so the start cell was empty before it
  // exactly when it holds nothing beyond this session's own share of that
  // hour — the minutes from the start up to the next hour boundary, or the
  // whole session if it ends sooner.
  const startMs = ctx.session.startedAt.getTime();
  const toBoundary =
    (Math.floor(startMs / HOUR_MS) * HOUR_MS + HOUR_MS - startMs) / MINUTE_MS;
  const own = Math.round(Math.min(sessionDurationMinutes(ctx.session), toBoundary));
  const cell = ctx.hourMatrix[slot.weekday]?.[slot.hour] ?? 0;
  if (cell - own <= 0) return [{ kind: "unusual-slot", strength: 0.35, slot }];
  return [];
}

/**
 * Every beat the session earns, strongest first, ending with its shape.
 * Ties keep emitter order, which puts the more specific claim ahead of the
 * more generic one at equal strength.
 */
export function selectSessionBeats(ctx: SessionBeatContext): SteamSessionBeat[] {
  const beats: SteamSessionBeat[] = [];
  const push = (b: SteamSessionBeat | null) => {
    if (b) beats.push(b);
  };
  push(longestInWindow(ctx));
  push(longestInGame(ctx));
  push(firstSessionBeat(ctx));
  push(milestoneBeat(ctx));
  push(returnBeat(ctx));
  push(streakBeat(ctx));
  push(unlockBeat(ctx));
  push(completionBeat(ctx));
  for (const b of clockBeats(ctx)) push(b);
  for (const b of neighbourBeats(ctx)) push(b);
  for (const b of slotBeats(ctx)) push(b);
  beats.sort((a, b) => b.strength - a.strength);
  beats.push({
    kind: "shape",
    strength: 0.1,
    slot: localSlot(ctx.session.startedAt, ctx.timeZone),
    durationMinutes: sessionDurationMinutes(ctx.session),
  });
  return beats;
}
