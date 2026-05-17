import { Injectable } from "@nestjs/common";
import type { SteamChronotype, SteamChronotypeHour } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const TIME_ZONE = "Europe/Brussels";

// Pure function — extracted so the spec can test bucketing without Prisma.
export function bucketUnlocks(dates: Date[], timeZone: string): SteamChronotypeHour[] {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
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

@Injectable()
export class SteamChronotypeService {
  constructor(private readonly prisma: PrismaService) {}

  async getChronotype(count = 500): Promise<SteamChronotype> {
    const rows = await this.prisma.steamPlayerUnlock.findMany({
      orderBy: { unlockedAt: "desc" },
      take: count,
      select: { unlockedAt: true },
    });

    const dates = rows.map((r) => r.unlockedAt);
    const hours = bucketUnlocks(dates, TIME_ZONE);
    return { hours, totalCount: dates.length, timeZone: TIME_ZONE };
  }
}
