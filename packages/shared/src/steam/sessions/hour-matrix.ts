// Minutes played per owner-local weekday × hour, over a set of sessions. The
// Steam sibling of the LoL chronotype, but counting time rather than events:
// a session that runs 22:40 → 02:52 puts 20 minutes in the Tuesday 22 cell,
// 60 in Tuesday 23, then rolls into Wednesday 00, 01 and 02.
//
// Rows are weekdays Monday-first (0 = Monday … 6 = Sunday), columns are hours
// 0..23, values are whole minutes. Owner-local because "usual slot" is a
// claim about the owner's evening, and `Europe/Brussels` keeps whole-hour
// offsets so the local hour boundaries coincide with UTC ones — which is what
// lets the walk below step by hour instead of by minute.

export const HOUR_MATRIX_DAYS = 7;
export const HOUR_MATRIX_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface LocalSlot {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  /** 0..23. */
  hour: number;
}

/** The owner-local weekday and hour an instant falls in. */
export function localSlot(at: Date, timeZone: string): LocalSlot {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  let weekday = 0;
  let hour = 0;
  for (const p of parts) {
    if (p.type === "weekday") weekday = WEEKDAY_INDEX[p.value] ?? 0;
    else if (p.type === "hour") hour = Number.parseInt(p.value, 10) || 0;
  }
  return { weekday, hour };
}

export function emptyHourMatrix(): number[][] {
  return Array.from({ length: HOUR_MATRIX_DAYS }, () =>
    Array.from({ length: HOUR_MATRIX_HOURS }, () => 0)
  );
}

export interface MatrixInterval {
  startedAt: Date;
  endedAt: Date;
}

export function buildHourMatrix(
  sessions: readonly MatrixInterval[],
  timeZone: string
): number[][] {
  const matrix = emptyHourMatrix();
  for (const s of sessions) {
    const end = s.endedAt.getTime();
    let t = s.startedAt.getTime();
    while (t < end) {
      const nextBoundary = Math.floor(t / HOUR_MS) * HOUR_MS + HOUR_MS;
      const sliceEnd = Math.min(end, nextBoundary);
      const { weekday, hour } = localSlot(new Date(t), timeZone);
      const row = matrix[weekday];
      if (row) row[hour] = (row[hour] ?? 0) + Math.round((sliceEnd - t) / MINUTE_MS);
      t = sliceEnd;
    }
  }
  return matrix;
}

export function hourMatrixTotalMinutes(matrix: readonly (readonly number[])[]): number {
  let total = 0;
  for (const row of matrix) for (const v of row) total += v;
  return total;
}

/**
 * Rank of a cell by minutes, 1 = the fullest cell. Ties share the better
 * rank, so "top three" stays a claim about minutes rather than about which
 * of two equal cells the sort happened to visit first.
 */
export function hourMatrixCellRank(
  matrix: readonly (readonly number[])[],
  slot: LocalSlot
): number {
  const value = matrix[slot.weekday]?.[slot.hour] ?? 0;
  let better = 0;
  for (const row of matrix) for (const v of row) if (v > value) better += 1;
  return better + 1;
}
