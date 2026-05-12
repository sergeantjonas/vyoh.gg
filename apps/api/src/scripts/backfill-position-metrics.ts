// One-shot: populate the D.1 position arrays (deathXs/Ys, killTimings/Xs/Ys)
// on Match rows that already have a cached timeline but were inserted before
// the position projection landed. Reuses MatchTimelineCache exclusively —
// never calls Riot — so the script is safe to re-run.
//
// Build first (nest build), then: node dist/src/scripts/backfill-position-metrics.js.
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in backfill-timeline-metrics.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { LolService } from "../lol/lol.service";
import { riotTimelineToSummaryMetrics } from "../lol/timeline-summary-mapper";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatchTimeline } from "../riot/types";

async function main() {
  const logger = new Logger("BackfillPositionMetrics");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    void app.get(LolService);

    // Target: every Match row whose deathXs array is still the default empty
    // sentinel. That covers two populations: (a) rows whose timeline was
    // never projected (no cache row either — those silently skip below) and
    // (b) rows whose timeline IS cached but pre-D.1 projection ran before
    // the position fields existed.
    const targets = await prisma.match.findMany({
      where: { deathXs: { isEmpty: true } },
      select: { matchId: true, puuid: true },
    });

    logger.log(
      `Found ${targets.length} matches with empty deathXs — attempting to project positions from cached timelines.`
    );

    let updated = 0;
    let noCache = 0;
    let failed = 0;

    for (const { matchId, puuid } of targets) {
      try {
        const cached = await prisma.matchTimelineCache.findUnique({
          where: { matchId },
          select: { timeline: true },
        });
        if (!cached) {
          noCache++;
          continue;
        }

        const raw = cached.timeline as unknown as RiotMatchTimeline;
        const metrics = riotTimelineToSummaryMetrics(raw, puuid);

        // Only write the D.1 position arrays so we don't stomp CS/gold
        // fields that earlier Phase B backfills already populated.
        await prisma.match.update({
          where: { matchId_puuid: { matchId, puuid } },
          data: {
            deathXs: metrics.deathXs,
            deathYs: metrics.deathYs,
            killTimings: metrics.killTimings,
            killXs: metrics.killXs,
            killYs: metrics.killYs,
          },
        });
        updated++;

        if (updated % 100 === 0) {
          logger.log(`  progress ${updated} (no cache: ${noCache}, failed: ${failed})`);
        }
      } catch (err) {
        failed++;
        logger.warn(`  ${matchId}/${puuid}: ${(err as Error).message}`);
      }
    }

    logger.log(`Done. Updated ${updated}, no cache: ${noCache}, failed: ${failed}.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
