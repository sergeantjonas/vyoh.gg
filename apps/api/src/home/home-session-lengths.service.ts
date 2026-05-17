import { Injectable } from "@nestjs/common";
import type {
  HomeSessionLengths,
  HomeSessionLengthsBucket,
  SessionLengthBucketLabel,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const STITCH_GAP_MINUTES = 30;
const MS_PER_MINUTE = 60_000;

export interface LolSessionMatch {
  playedAt: Date;
  durationSec: number;
}

export interface StitchedSession {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
}

interface BucketSpec {
  label: SessionLengthBucketLabel;
  /** Inclusive lower bound, in minutes. */
  minMinutes: number;
  /** Exclusive upper bound, in minutes. `Infinity` means open-ended. */
  maxMinutes: number;
}

const BUCKET_SPECS: BucketSpec[] = [
  { label: "<30m", minMinutes: 0, maxMinutes: 30 },
  { label: "30m–1h", minMinutes: 30, maxMinutes: 60 },
  { label: "1h–2h", minMinutes: 60, maxMinutes: 120 },
  { label: "2h–4h", minMinutes: 120, maxMinutes: 240 },
  { label: "4h+", minMinutes: 240, maxMinutes: Number.POSITIVE_INFINITY },
];

/**
 * Stitch a sequence of LoL matches into sessions. A session is a block of
 * matches whose consecutive `playedAt` gaps are ≤ `gapMinutes`. Length is the
 * sum of `durationSec` for matches in the block — queue time / champ select /
 * client transitions between matches are not counted because they aren't
 * "playing". A single match is a valid session.
 *
 * Input does not need to be sorted; the stitcher sorts ascending by
 * `playedAt`. Matches with non-positive `durationSec` are skipped (remakes are
 * filtered upstream, but defend in depth).
 */
export function stitchLolSessions(
  matches: LolSessionMatch[],
  gapMinutes: number
): StitchedSession[] {
  const sorted = matches
    .filter((m) => m.durationSec > 0)
    .slice()
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const [first, ...rest] = sorted;
  if (!first) return [];

  const sessions: StitchedSession[] = [];
  const gapMs = gapMinutes * MS_PER_MINUTE;

  let currentStart = first.playedAt;
  let currentEnd = new Date(first.playedAt.getTime() + first.durationSec * 1000);
  let currentDurationSec = first.durationSec;

  for (const m of rest) {
    const gap = m.playedAt.getTime() - currentEnd.getTime();
    if (gap <= gapMs) {
      currentEnd = new Date(m.playedAt.getTime() + m.durationSec * 1000);
      currentDurationSec += m.durationSec;
    } else {
      sessions.push({
        startedAt: currentStart,
        endedAt: currentEnd,
        durationMinutes: Math.round(currentDurationSec / 60),
      });
      currentStart = m.playedAt;
      currentEnd = new Date(m.playedAt.getTime() + m.durationSec * 1000);
      currentDurationSec = m.durationSec;
    }
  }
  sessions.push({
    startedAt: currentStart,
    endedAt: currentEnd,
    durationMinutes: Math.round(currentDurationSec / 60),
  });
  return sessions;
}

function bucketIndexFor(minutes: number): number {
  const found = BUCKET_SPECS.findIndex(
    (spec) => minutes >= spec.minMinutes && minutes < spec.maxMinutes
  );
  return found === -1 ? BUCKET_SPECS.length - 1 : found;
}

export function histogramSessionLengths(
  lolMinutes: number[],
  steamMinutes: number[]
): HomeSessionLengthsBucket[] {
  const buckets: HomeSessionLengthsBucket[] = BUCKET_SPECS.map((spec) => ({
    label: spec.label,
    lolCount: 0,
    steamCount: 0,
  }));
  for (const m of lolMinutes) {
    if (!Number.isFinite(m) || m <= 0) continue;
    const slot = buckets[bucketIndexFor(m)];
    if (slot) slot.lolCount += 1;
  }
  for (const m of steamMinutes) {
    if (!Number.isFinite(m) || m <= 0) continue;
    const slot = buckets[bucketIndexFor(m)];
    if (slot) slot.steamCount += 1;
  }
  return buckets;
}

@Injectable()
export class HomeSessionLengthsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionLengths(): Promise<HomeSessionLengths> {
    const [matchRows, sessionRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false },
        select: { playedAt: true, durationSec: true },
      }),
      this.prisma.steamPlaySession.findMany({
        where: { endedAt: { not: null } },
        select: { startedAt: true, endedAt: true },
      }),
    ]);

    const lolSessions = stitchLolSessions(matchRows, STITCH_GAP_MINUTES);
    const lolMinutes = lolSessions.map((s) => s.durationMinutes);
    const steamMinutes = sessionRows
      .filter((r): r is { startedAt: Date; endedAt: Date } => r.endedAt !== null)
      .map((r) =>
        Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / MS_PER_MINUTE)
      )
      .filter((m) => m > 0);

    const buckets = histogramSessionLengths(lolMinutes, steamMinutes);

    return {
      buckets,
      lolSessionCount: lolMinutes.length,
      steamSessionCount: steamMinutes.length,
    };
  }
}
