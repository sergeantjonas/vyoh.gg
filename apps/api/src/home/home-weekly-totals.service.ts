import { Injectable } from "@nestjs/common";
import type { HomeWeeklyTotals } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const TIME_ZONE = "Europe/Brussels";
const WINDOW_DAYS = 7;

export interface PlaytimeSnapshotRow {
  appid: number;
  snapshotDate: Date;
  playtimeForeverMinutes: number;
}

/**
 * Sum the per-appid playtime delta between the latest snapshot for each appid
 * and the latest snapshot whose `snapshotDate` is at or before `windowStart`.
 * Appids without a baseline snapshot at-or-before `windowStart` are excluded:
 * the row is newer than the window, so the within-window playtime is unknown.
 */
export function diffPlaytimeMinutes(
  rows: PlaytimeSnapshotRow[],
  windowStart: Date
): number {
  const latestByAppid = new Map<number, PlaytimeSnapshotRow>();
  const baselineByAppid = new Map<number, PlaytimeSnapshotRow>();

  for (const row of rows) {
    const latest = latestByAppid.get(row.appid);
    if (!latest || row.snapshotDate > latest.snapshotDate) {
      latestByAppid.set(row.appid, row);
    }
    if (row.snapshotDate <= windowStart) {
      const baseline = baselineByAppid.get(row.appid);
      if (!baseline || row.snapshotDate > baseline.snapshotDate) {
        baselineByAppid.set(row.appid, row);
      }
    }
  }

  let total = 0;
  for (const [appid, latest] of latestByAppid) {
    const baseline = baselineByAppid.get(appid);
    if (!baseline) continue;
    const delta = latest.playtimeForeverMinutes - baseline.playtimeForeverMinutes;
    if (delta > 0) total += delta;
  }
  return total;
}

@Injectable()
export class HomeWeeklyTotalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeeklyTotals(): Promise<HomeWeeklyTotals> {
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [matchRows, snapshotRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false, playedAt: { gte: weekStart } },
        select: { durationSec: true },
      }),
      this.prisma.steamPlaytimeSnapshot.findMany({
        select: { appid: true, snapshotDate: true, playtimeForeverMinutes: true },
      }),
    ]);

    const lolMatchCount = matchRows.length;
    const lolSeconds = matchRows.reduce((sum, r) => sum + r.durationSec, 0);
    const lolMinutes = Math.round(lolSeconds / 60);

    const steamMinutes = diffPlaytimeMinutes(snapshotRows, weekStart);

    return {
      lolMatchCount,
      lolMinutes,
      steamMinutes,
      totalMinutes: lolMinutes + steamMinutes,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      timeZone: TIME_ZONE,
    };
  }
}
