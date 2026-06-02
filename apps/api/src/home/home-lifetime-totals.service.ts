import { Injectable } from "@nestjs/common";
import type { HomeLifetimeTotals } from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";

export interface PlaytimeSnapshotRow {
  appid: number;
  snapshotDate: Date;
  playtimeForeverMinutes: number;
}

/**
 * Sum the latest `playtimeForeverMinutes` per appid across the provided
 * snapshot rows. Steam's `playtimeForever` is a monotonic counter, so the
 * latest snapshot per appid IS the alltime playtime for that game. The
 * sum across all owned games is the alltime Steam playtime for the
 * owner.
 *
 * Input does not need to be sorted; the reducer tracks the max snapshot
 * date per appid on its own pass. Empty input returns 0.
 */
export function sumLatestPlaytimeMinutes(rows: PlaytimeSnapshotRow[]): number {
  const latestByAppid = new Map<number, PlaytimeSnapshotRow>();
  for (const row of rows) {
    const latest = latestByAppid.get(row.appid);
    if (!latest || row.snapshotDate > latest.snapshotDate) {
      latestByAppid.set(row.appid, row);
    }
  }
  let total = 0;
  for (const row of latestByAppid.values()) {
    total += row.playtimeForeverMinutes;
  }
  return total;
}

@Injectable()
export class HomeLifetimeTotalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService
  ) {}

  async getLifetimeTotals(): Promise<HomeLifetimeTotals> {
    // Owner-filtered LoL — see HomeChronotypeService for rationale.
    // Steam is already single-owner via STEAM_OWNER_ID, so unlock /
    // snapshot tables don't need a filter.
    const ownerPuuids = await this.identity.getOwnerPuuids();

    const [matchAggregate, snapshotRows, unlockAggregate] = await Promise.all([
      this.prisma.match.aggregate({
        where: { remake: false, puuid: { in: ownerPuuids } },
        _count: true,
        _sum: { durationSec: true },
        _min: { playedAt: true },
      }),
      this.prisma.steamPlaytimeSnapshot.findMany({
        select: { appid: true, snapshotDate: true, playtimeForeverMinutes: true },
      }),
      this.prisma.steamPlayerUnlock.aggregate({
        _min: { unlockedAt: true },
      }),
    ]);

    const lolMatchCount = matchAggregate._count;
    const lolSeconds = matchAggregate._sum.durationSec ?? 0;
    const lolMinutes = Math.round(lolSeconds / 60);
    const steamMinutes = sumLatestPlaytimeMinutes(snapshotRows);
    const oldestMatchAt = matchAggregate._min.playedAt?.toISOString() ?? null;
    const oldestUnlockAt = unlockAggregate._min.unlockedAt?.toISOString() ?? null;

    return {
      lolMatchCount,
      lolMinutes,
      steamMinutes,
      oldestMatchAt,
      oldestUnlockAt,
    };
  }
}
