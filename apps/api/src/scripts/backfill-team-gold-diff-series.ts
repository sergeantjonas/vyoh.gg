// One-shot: populate `teamGoldDiffSeries` on existing Match rows. Targets
// rows that already carry a projected timeline (hasTimeline=true) but lack
// the per-minute team-gold-diff array. Reuses MatchTimelineCache only —
// never refetches from Riot, since the cache is already a faithful mirror.
//
// Build first (nest build), then:
//   node dist/src/scripts/backfill-team-gold-diff-series.js
// Lives under src/ so SWC emits decorator metadata for Nest DI.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { riotTimelineToSummaryMetrics } from "../lol/timeline-summary-mapper";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatchTimeline } from "../riot/types";

async function main() {
  const logger = new Logger("BackfillTeamGoldDiffSeries");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);

    // Target rows whose timeline was projected before the gold-diff-series
    // field existed: hasTimeline=true rules out remakes / never-fetched rows,
    // and `teamGoldDiffSeries: { isEmpty: true }` skips anything already
    // backfilled. Joining MatchTimelineCache by matchId is the only way to
    // get to the per-frame totals.
    const targets = await prisma.match.findMany({
      where: { hasTimeline: true, teamGoldDiffSeries: { isEmpty: true } },
      select: { matchId: true, puuid: true },
    });
    logger.log(`Found ${targets.length} matches to backfill.`);

    let updated = 0;
    let cacheMissed = 0;
    let failed = 0;

    for (const { matchId, puuid } of targets) {
      try {
        const cached = await prisma.matchTimelineCache.findUnique({
          where: { matchId },
          select: { timeline: true },
        });
        if (!cached) {
          cacheMissed++;
          continue;
        }
        const raw = cached.timeline as unknown as RiotMatchTimeline;
        const { teamGoldDiffSeries } = riotTimelineToSummaryMetrics(raw, puuid);
        await prisma.match.update({
          where: { matchId_puuid: { matchId, puuid } },
          data: { teamGoldDiffSeries },
        });
        updated++;

        if (updated % 100 === 0) {
          logger.log(
            `  progress ${updated} / ${targets.length} (cache missed: ${cacheMissed}, failed: ${failed})`
          );
        }
      } catch (err) {
        failed++;
        logger.warn(`  ${matchId}: ${(err as Error).message}`);
      }
    }

    logger.log(
      `Done. Updated ${updated} (cache missed: ${cacheMissed}, failed: ${failed}).`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
