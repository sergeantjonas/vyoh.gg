import { Injectable } from "@nestjs/common";
import type { HomeDaySplit, HomeDaySplitHour } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const TIME_ZONE = "Europe/Brussels";
const MINUTE_MS = 60_000;

export interface DaySplitInterval {
  startedAt: Date;
  endedAt: Date;
}

/**
 * Bucket the minutes inside each interval by hour-of-day in `timeZone`.
 * Returns 24 numbers (index = hour 0..23) of total minutes. Intervals
 * crossing hour boundaries are split proportionally; midnight-crossing and
 * DST transitions are handled by formatting each minute's wall-clock hour
 * via `Intl.DateTimeFormat`, so a session that runs *through* a DST cut-over
 * still attributes minutes to the correct local hour on either side.
 *
 * Per-minute walk is bounded (sessions are at most a few hours) and keeps
 * the algorithm honest about DST without a hand-rolled offset table. Sub-
 * minute fractions are rounded to the nearest whole minute on the *interval*
 * before walking, so a 90.4-second interval contributes 2 min, not zero.
 */
export function splitIntervalsByHour(
  intervals: DaySplitInterval[],
  timeZone: string
): number[] {
  const buckets = new Array<number>(24).fill(0);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  for (const iv of intervals) {
    const startMs = iv.startedAt.getTime();
    const endMs = iv.endedAt.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (endMs <= startMs) continue;
    const totalMinutes = Math.max(1, Math.round((endMs - startMs) / MINUTE_MS));
    for (let i = 0; i < totalMinutes; i++) {
      const sampleMs = startMs + i * MINUTE_MS;
      const hour = Number.parseInt(fmt.format(new Date(sampleMs)), 10);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      buckets[hour] = (buckets[hour] ?? 0) + 1;
    }
  }
  return buckets;
}

function emptyHours(): HomeDaySplitHour[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    lolMinutes: 0,
    steamMinutes: 0,
  }));
}

@Injectable()
export class HomeDaySplitService {
  constructor(private readonly prisma: PrismaService) {}

  async getDaySplit(): Promise<HomeDaySplit> {
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

    const lolIntervals: DaySplitInterval[] = matchRows.map((r) => ({
      startedAt: r.playedAt,
      endedAt: new Date(r.playedAt.getTime() + r.durationSec * 1000),
    }));
    const steamIntervals: DaySplitInterval[] = sessionRows
      .filter((r): r is { startedAt: Date; endedAt: Date } => r.endedAt !== null)
      .map((r) => ({ startedAt: r.startedAt, endedAt: r.endedAt }));

    const lolBuckets = splitIntervalsByHour(lolIntervals, TIME_ZONE);
    const steamBuckets = splitIntervalsByHour(steamIntervals, TIME_ZONE);

    const hours = emptyHours().map((slot) => ({
      hour: slot.hour,
      lolMinutes: lolBuckets[slot.hour] ?? 0,
      steamMinutes: steamBuckets[slot.hour] ?? 0,
    }));

    return {
      hours,
      totalLolMinutes: lolBuckets.reduce((a, b) => a + b, 0),
      totalSteamMinutes: steamBuckets.reduce((a, b) => a + b, 0),
      timeZone: TIME_ZONE,
    };
  }
}
