import type { RankHistoryPoint } from "@vyoh/shared";
import { normalizeLp } from "@vyoh/shared/lol/rank-history";
import {
  DAY_KEY_FMT,
  MAX_VISUAL_GAP_MS,
  type Resolution,
  SESSION_GAP_MS,
  STREAK_MIN_LENGTH,
  formatTierShort,
} from "./profile-lp-history-constants";

export interface BucketMeta {
  kind: "session" | "day";
  gameCount: number;
  openLp: number;
  closeLp: number;
  lowLp: number;
  highLp: number;
  netLp: number;
  winCount: number;
  lossCount: number;
  startRealT: number;
  endRealT: number;
}

export interface ChartPoint extends RankHistoryPoint {
  // Visual X position with oversized gaps collapsed. Use this for plotting
  // and for any overlay that needs to align with the data line.
  t: number;
  // Original wall-clock timestamp. Use this for tooltip labels and any
  // mapping from real time (e.g. patch boundaries) back onto the chart.
  realT: number;
  totalLp: number;
  // Set when the point represents more than one underlying snapshot
  // (session/day bucket). Undefined for per-game resolution.
  bucket?: BucketMeta;
}

interface RawPoint extends RankHistoryPoint {
  totalLp: number;
  realT: number;
}

function withDerivedFields(p: RankHistoryPoint): RawPoint {
  return {
    ...p,
    totalLp: normalizeLp(p.tier, p.rank, p.leaguePoints),
    realT: new Date(p.capturedAt).getTime(),
  };
}

function aggregateBuckets(
  raw: RawPoint[],
  resolution: Resolution
): Array<RawPoint & { bucket?: BucketMeta }> {
  if (resolution === "per-game" || raw.length === 0) {
    return raw.map((p) => ({ ...p }));
  }

  const sameBucket = (prev: RawPoint, curr: RawPoint): boolean =>
    resolution === "session"
      ? curr.realT - prev.realT <= SESSION_GAP_MS
      : DAY_KEY_FMT.format(curr.realT) === DAY_KEY_FMT.format(prev.realT);

  const out: Array<RawPoint & { bucket?: BucketMeta }> = [];
  // Carry the closing LP of the *previous bucket* so within-bucket W/L can
  // be tallied relative to "before this bucket started", not just within it.
  let prevBucketClose: number | null = null;

  let i = 0;
  while (i < raw.length) {
    const first = raw[i];
    if (!first) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < raw.length) {
      const prev = raw[j - 1];
      const curr = raw[j];
      if (!prev || !curr || !sameBucket(prev, curr)) break;
      j++;
    }
    const bucketSlice = raw.slice(i, j);
    const last = bucketSlice[bucketSlice.length - 1] ?? first;

    let low = first.totalLp;
    let high = first.totalLp;
    let wins = 0;
    let losses = 0;
    let runningPrev = prevBucketClose;
    for (const snap of bucketSlice) {
      if (snap.totalLp < low) low = snap.totalLp;
      if (snap.totalLp > high) high = snap.totalLp;
      if (runningPrev !== null) {
        const delta = snap.totalLp - runningPrev;
        if (delta > 0) wins++;
        else if (delta < 0) losses++;
      }
      runningPrev = snap.totalLp;
    }
    const openLp = prevBucketClose ?? first.totalLp;
    const netLp = last.totalLp - openLp;

    if (bucketSlice.length === 1) {
      // A single-game bucket is structurally per-game; skip the metadata so
      // the chart treats it identically to per-game mode (no compound tooltip).
      out.push({ ...last });
    } else {
      out.push({
        ...last,
        bucket: {
          kind: resolution,
          gameCount: bucketSlice.length,
          openLp,
          closeLp: last.totalLp,
          lowLp: low,
          highLp: high,
          netLp,
          winCount: wins,
          lossCount: losses,
          startRealT: first.realT,
          endRealT: last.realT,
        },
      });
    }
    prevBucketClose = last.totalLp;
    i = j;
  }
  return out;
}

export function toChartPoints(
  points: RankHistoryPoint[],
  resolution: Resolution = "per-game"
): ChartPoint[] {
  if (points.length === 0) return [];
  const aggregated = aggregateBuckets(points.map(withDerivedFields), resolution);
  const out: ChartPoint[] = [];
  let visualT = 0;
  let prevRealT = 0;
  for (let i = 0; i < aggregated.length; i++) {
    const p = aggregated[i];
    if (!p) continue;
    if (i === 0) {
      visualT = p.realT;
    } else {
      visualT += Math.min(p.realT - prevRealT, MAX_VISUAL_GAP_MS);
    }
    prevRealT = p.realT;
    out.push({
      ...p,
      t: visualT,
    });
  }
  return out;
}

// Map a real-time timestamp onto the collapsed visual axis by linearly
// interpolating between the two bracketing data points. Used for overlays
// (patch boundaries) whose source data lives in real wall-clock time but
// must render in chart coordinates.
export function mapRealToVisual(realT: number, points: ChartPoint[]): number {
  if (points.length === 0) return realT;
  const first = points[0];
  if (first && realT <= first.realT) return first.t;
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const prev = points[i - 1];
    if (!curr || !prev) continue;
    if (curr.realT >= realT) {
      const span = curr.realT - prev.realT;
      const frac = span > 0 ? (realT - prev.realT) / span : 0;
      return prev.t + frac * (curr.t - prev.t);
    }
  }
  const last = points[points.length - 1];
  return last ? last.t : realT;
}

export interface Streak {
  startIdx: number;
  endIdx: number;
  type: "win" | "loss";
  length: number;
}

export function findLongestStreak(points: ChartPoint[]): Streak | null {
  if (points.length < STREAK_MIN_LENGTH + 1) return null;

  let best: Streak | null = null;
  let runStart = 0;
  let runType: "win" | "loss" | null = null;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    const delta = curr.totalLp - prev.totalLp;
    if (delta === 0) continue;
    const t: "win" | "loss" = delta > 0 ? "win" : "loss";

    if (t !== runType) {
      runStart = i - 1;
      runType = t;
    }

    const length = i - runStart;
    if (length >= STREAK_MIN_LENGTH && (!best || length > best.length)) {
      best = { startIdx: runStart, endIdx: i, type: t, length };
    }
  }

  return best;
}

export interface TierChange {
  idx: number;
  direction: "up" | "down";
  label: string;
}

export function findTierChanges(points: ChartPoint[]): TierChange[] {
  const changes: TierChange[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    if (prev.tier !== curr.tier || prev.rank !== curr.rank) {
      changes.push({
        idx: i,
        direction: curr.totalLp >= prev.totalLp ? "up" : "down",
        label: formatTierShort(curr.tier, curr.rank),
      });
    }
  }
  return changes;
}

// One tick per calendar day, placed at the visual `t` of the first data point
// of that day. Recharts auto-generated ticks at "nice" clock boundaries in the
// compressed visual domain don't align with real calendar days, so we drive
// placement explicitly.
export function makeDayTicks(points: ChartPoint[]): number[] {
  const seen = new Set<string>();
  const ticks: number[] = [];
  for (const p of points) {
    const key = new Date(p.realT).toLocaleDateString();
    if (!seen.has(key)) {
      seen.add(key);
      ticks.push(p.t);
    }
  }
  return ticks;
}

export function makeTickFormatter(points: ChartPoint[]): (visualT: number) => string {
  const map = new Map(
    points.map((p) => [
      p.t,
      new Date(p.realT).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    ])
  );
  return (t) => map.get(t) ?? "";
}

export function formatBucketHeader(bucket: BucketMeta): string {
  const start = new Date(bucket.startRealT);
  const end = new Date(bucket.endRealT);
  if (bucket.kind === "day") {
    return start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${dateStr} · ${start.toLocaleTimeString(undefined, timeFmt)} – ${end.toLocaleTimeString(undefined, timeFmt)}`;
}
