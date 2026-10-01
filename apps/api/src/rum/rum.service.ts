import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RUM_RETENTION_DAYS, type RumBeacon } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 86_400_000;

// A hard ceiling under the retention window. The nginx zones bound the rate,
// but not a caller who keeps it up for weeks, and this table shares the
// Postgres volume with data that cannot be re-fetched. Pruned hourly, so the
// table never runs more than an hour of capped inflow past it.
export const RUM_MAX_ROWS = 500_000;

@Injectable()
export class RumService {
  private readonly logger = new Logger(RumService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(beacon: RumBeacon): Promise<void> {
    const { route, formFactor, navigationType } = beacon;
    await this.prisma.$transaction(
      beacon.samples.map(({ id, name, value, rating }) =>
        this.prisma.webVitalSample.upsert({
          where: { id },
          create: { id, name, value, rating, route, formFactor, navigationType },
          // Only the reading moves on a re-report; the page it was taken on
          // cannot change.
          update: { value, rating, recordedAt: new Date() },
        })
      )
    );
  }

  @Cron(CronExpression.EVERY_HOUR, { name: "rum-prune" })
  async prune(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RUM_RETENTION_DAYS * DAY_MS);
    const aged = await this.prisma.webVitalSample.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    // The newest row past the ceiling; it and everything older go.
    const boundary = await this.prisma.webVitalSample.findFirst({
      orderBy: { recordedAt: "desc" },
      skip: RUM_MAX_ROWS,
      select: { recordedAt: true },
    });
    const capped = boundary
      ? await this.prisma.webVitalSample.deleteMany({
          where: { recordedAt: { lte: boundary.recordedAt } },
        })
      : { count: 0 };
    const count = aged.count + capped.count;
    if (count > 0) {
      this.logger.log(
        `pruned ${aged.count} web-vital samples past ${RUM_RETENTION_DAYS} days and ${capped.count} past the ${RUM_MAX_ROWS}-row ceiling`
      );
    }
    return count;
  }
}
