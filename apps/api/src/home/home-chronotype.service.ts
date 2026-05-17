import { Injectable } from "@nestjs/common";
import type { HomeChronotype, HomeChronotypeHour } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const TIME_ZONE = "Europe/Brussels";

export interface HourCount {
  hour: number;
  count: number;
}

export function bucketDates(dates: Date[], timeZone: string): HourCount[] {
  const hours: HourCount[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  for (const d of dates) {
    const hour = Number.parseInt(fmt.format(d), 10);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    const bucket = hours[hour];
    if (!bucket) continue;
    bucket.count += 1;
  }
  return hours;
}

export function mergePerStream(
  lol: HourCount[],
  steam: HourCount[]
): HomeChronotypeHour[] {
  return lol.map((lolBucket, i) => {
    const steamCount = steam[i]?.count ?? 0;
    return {
      hour: lolBucket.hour,
      total: lolBucket.count + steamCount,
      lol: lolBucket.count,
      steam: steamCount,
    };
  });
}

@Injectable()
export class HomeChronotypeService {
  constructor(private readonly prisma: PrismaService) {}

  async getChronotype(count = 500): Promise<HomeChronotype> {
    const [matchRows, unlockRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false },
        orderBy: { playedAt: "desc" },
        take: count,
        select: { playedAt: true },
      }),
      this.prisma.steamPlayerUnlock.findMany({
        orderBy: { unlockedAt: "desc" },
        take: count,
        select: { unlockedAt: true },
      }),
    ]);

    const lolDates = matchRows.map((r) => r.playedAt);
    const steamDates = unlockRows.map((r) => r.unlockedAt);

    const lolBuckets = bucketDates(lolDates, TIME_ZONE);
    const steamBuckets = bucketDates(steamDates, TIME_ZONE);

    return {
      hours: mergePerStream(lolBuckets, steamBuckets),
      totalLolCount: lolDates.length,
      totalSteamCount: steamDates.length,
      timeZone: TIME_ZONE,
    };
  }
}
