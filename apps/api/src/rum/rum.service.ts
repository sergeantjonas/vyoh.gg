import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  RUM_RETENTION_DAYS,
  RUM_SUMMARY_MIN_SAMPLES,
  RUM_SUMMARY_WINDOW_DAYS,
  type RumBeacon,
  type RumFormFactor,
  type WebVitalName,
  type WebVitalsRouteSummary,
  type WebVitalsSummary,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 86_400_000;

// A hard ceiling under the retention window. The nginx zones bound the rate,
// but not a caller who keeps it up for weeks, and this table shares the
// Postgres volume with data that cannot be re-fetched. Pruned hourly, so the
// table never runs more than an hour of capped inflow past it.
export const RUM_MAX_ROWS = 500_000;

// The summary is public and its query aggregates the whole window, so one
// computation serves every visitor for this long.
const SUMMARY_TTL_MS = 5 * 60_000;

type SummaryRow = {
  route: string;
  formFactor: RumFormFactor;
  name: WebVitalName;
  p75: number;
  samples: number;
  good: number;
};

@Injectable()
export class RumService {
  private readonly logger = new Logger(RumService.name);

  private summaryCache: { at: number; value: WebVitalsSummary } | null = null;

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

  async summary(now = Date.now()): Promise<WebVitalsSummary> {
    if (this.summaryCache && now - this.summaryCache.at < SUMMARY_TTL_MS) {
      return this.summaryCache.value;
    }
    // The cutoff is computed in SQL against the UTC wall clock Prisma writes,
    // rather than passed in as a Date that node-pg would serialise with the
    // process's offset.
    const rows = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT "route", "formFactor", "name",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "value") AS p75,
        count(*)::int AS samples,
        (count(*) FILTER (WHERE "rating" = 'good'))::int AS good
      FROM "WebVitalSample"
      WHERE "recordedAt" > (now() AT TIME ZONE 'UTC') - make_interval(days => ${RUM_SUMMARY_WINDOW_DAYS})
      GROUP BY "route", "formFactor", "name"
      HAVING count(*) >= ${RUM_SUMMARY_MIN_SAMPLES}
      ORDER BY "route", "formFactor"
    `;
    const byPage = new Map<string, WebVitalsRouteSummary>();
    for (const row of rows) {
      const key = `${row.route} ${row.formFactor}`;
      const page = byPage.get(key) ?? {
        route: row.route,
        formFactor: row.formFactor,
        metrics: {},
      };
      page.metrics[row.name] = {
        p75: row.p75,
        samples: row.samples,
        goodShare: row.good / row.samples,
      };
      byPage.set(key, page);
    }
    const value: WebVitalsSummary = {
      windowDays: RUM_SUMMARY_WINDOW_DAYS,
      minSamples: RUM_SUMMARY_MIN_SAMPLES,
      routes: [...byPage.values()],
    };
    this.summaryCache = { at: now, value };
    return value;
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
