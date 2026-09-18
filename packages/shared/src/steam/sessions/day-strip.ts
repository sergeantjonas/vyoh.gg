// Minutes played per owner-local calendar day, over a fixed trailing window.
// The day-resolution sibling of `buildHourMatrix`: where the matrix answers
// "which slot is the usual one", this answers "which days did anything happen
// on", which is the shape a compact strip can draw.
//
// A session that runs 22:20 → 01:22 is split across the two days it touched,
// for the same reason the matrix splits it across hours — a strip that put the
// whole three hours on the start day would draw a late night as an early one.
// The hour walk is sound because `Europe/Brussels` keeps whole-hour offsets,
// so local day boundaries coincide with UTC hour boundaries.
//
// Every day in the window gets a cell, including empty ones. The gaps are the
// point: a strip that omitted them would compress a fortnight of silence into
// nothing and read as continuous play.

import { type BeatSession, excludeBlipSessions } from "./beats.ts";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Dates rather than ISO strings, matching `buildHourMatrix` — both walk the
// same intervals, and a caller that has to parse for one should not re-parse
// for the other.
export interface DayStripSession extends BeatSession {
  name: string;
  /** Unlocks that landed inside this session, if the caller tracks them. */
  unlocks?: readonly unknown[];
}

export interface DayStripGameShare {
  appid: number;
  name: string;
  minutes: number;
}

export interface DayStripCell {
  /** Owner-local calendar day, `YYYY-MM-DD`. */
  day: string;
  minutes: number;
  /** Sessions that started on this day; a session spanning midnight counts once, on its start day. */
  sessionCount: number;
  /** Unlocks landing inside a session on this day. */
  unlockCount: number;
  // What was actually played, most minutes first. A day's bar drawn as one
  // block under a headline that names one game claims the whole day for it;
  // the split is what lets the bar say which part was that game and which was
  // something else.
  byGame: DayStripGameShare[];
}

const DAY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = DAY_FORMATTERS.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DAY_FORMATTERS.set(timeZone, fmt);
  }
  return fmt;
}

/** The owner-local calendar day an instant falls in, as `YYYY-MM-DD`. */
export function localDay(at: Date, timeZone: string): string {
  return dayFormatter(timeZone).format(at);
}

/**
 * One cell per owner-local day in the `days`-long window ending on `through`,
 * oldest first. Sessions outside the window are ignored; a session straddling
 * the window's opening edge contributes only the part inside it.
 */
export function buildDayStrip(
  sessions: readonly DayStripSession[],
  timeZone: string,
  days: number,
  through: Date
): DayStripCell[] {
  const cells = new Map<string, DayStripCell>();
  const order: string[] = [];
  // Resolve the local calendar day once, then count back on UTC dates. Walking
  // the *instant* back in 24 h steps and re-formatting each one loses a day at
  // a spring-forward and repeats one at a fall-back, because a local day either
  // side of a transition is 23 or 25 hours long. Anchoring at midday keeps the
  // arithmetic clear of both boundaries.
  const anchor = Date.parse(`${localDay(through, timeZone)}T12:00:00Z`);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(anchor - i * DAY_MS).toISOString().slice(0, 10);
    if (cells.has(day)) continue;
    cells.set(day, { day, minutes: 0, sessionCount: 0, unlockCount: 0, byGame: [] });
    order.push(day);
  }

  for (const s of excludeBlipSessions(sessions)) {
    const end = s.endedAt.getTime();
    let t = s.startedAt.getTime();
    if (!Number.isFinite(t) || !Number.isFinite(end)) continue;

    const startCell = cells.get(localDay(s.startedAt, timeZone));
    if (startCell) {
      startCell.sessionCount += 1;
      startCell.unlockCount += s.unlocks?.length ?? 0;
    }

    // Accumulate milliseconds and round once per cell. Rounding each hour
    // slice and summing lets a session with seconds on it land a minute away
    // from the `durationMinutes` the same session shows in a list beside it.
    while (t < end) {
      const nextBoundary = Math.floor(t / HOUR_MS) * HOUR_MS + HOUR_MS;
      const sliceEnd = Math.min(end, nextBoundary);
      const cell = cells.get(localDay(new Date(t), timeZone));
      if (cell) {
        const ms = sliceEnd - t;
        cell.minutes += ms;
        const share = cell.byGame.find((g) => g.appid === s.appid);
        if (share) share.minutes += ms;
        else cell.byGame.push({ appid: s.appid, name: s.name, minutes: ms });
      }
      t = sliceEnd;
    }
  }

  for (const cell of cells.values()) {
    cell.minutes = Math.round(cell.minutes / MINUTE_MS);
    for (const g of cell.byGame) g.minutes = Math.round(g.minutes / MINUTE_MS);
    cell.byGame.sort((a, b) => b.minutes - a.minutes);
  }
  return order.map((day) => cells.get(day) as DayStripCell);
}

/** The fullest cell's minutes, for scaling bar heights. Zero when nothing was played. */
export function dayStripPeakMinutes(cells: readonly DayStripCell[]): number {
  let peak = 0;
  for (const c of cells) if (c.minutes > peak) peak = c.minutes;
  return peak;
}

/** How many days in the window carry any play at all. */
export function dayStripActiveDays(cells: readonly DayStripCell[]): number {
  let active = 0;
  for (const c of cells) if (c.minutes > 0) active += 1;
  return active;
}
