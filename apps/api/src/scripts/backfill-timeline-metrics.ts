// One-shot: populate the Phase B timeline-derived fields on the most recent
// 200 Match rows per whitelisted account. Reuses MatchTimelineCache when a
// row already exists (lazy match-detail visit populated it earlier). Falls
// back to a Riot fetch otherwise — same rate-limited path as the cron sync.
//
// Build first (nest build), then: node dist/src/scripts/backfill-timeline-metrics.js.
// Lives under src/ so SWC emits decorator metadata for Nest DI.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IdentityService } from "../identity/identity.service";
import { LolService } from "../lol/lol.service";
import { riotTimelineToSummaryMetrics } from "../lol/timeline-summary-mapper";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import type { RiotMatchTimeline } from "../riot/types";

const PER_ACCOUNT_LIMIT = 200;

async function main() {
  const logger = new Logger("BackfillTimelineMetrics");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const riot = app.get(RiotService);
    const identity = app.get(IdentityService);
    void app.get(LolService);

    const accounts = identity.getLolAccounts();
    logger.log(
      `Backfilling Phase B timeline metrics for ${accounts.length} accounts (most-recent ${PER_ACCOUNT_LIMIT} matches each).`
    );

    let totalUpdated = 0;
    let totalReusedCache = 0;
    let totalFetched = 0;
    let totalFailed = 0;

    for (const account of accounts) {
      const summoner = await prisma.summoner.findUnique({
        where: {
          gameName_tagLine_region: {
            gameName: account.gameName,
            tagLine: account.tagLine,
            region: account.region,
          },
        },
      });
      if (!summoner) {
        logger.warn(`No Summoner row for ${account.gameName}#${account.tagLine}`);
        continue;
      }

      // Target rows still at default values for the new fields. Any row whose
      // sync-path timeline-fetch already ran (newer matches) will have non-
      // default values and gets skipped automatically.
      const targets = await prisma.match.findMany({
        where: {
          puuid: summoner.puuid,
          // Empty Int[] is a sentinel for "no timeline projected yet".
          deathTimings: { isEmpty: true },
        },
        orderBy: { playedAt: "desc" },
        take: PER_ACCOUNT_LIMIT,
        select: { matchId: true },
      });

      logger.log(
        `  ${account.gameName}: ${targets.length} matches need timeline metrics`
      );

      const regional = platformToRegional(account.region);

      for (const { matchId } of targets) {
        try {
          // Reuse cached timeline when present.
          const cached = await prisma.matchTimelineCache.findUnique({
            where: { matchId },
            select: { timeline: true },
          });

          let raw: RiotMatchTimeline;
          if (cached) {
            raw = cached.timeline as unknown as RiotMatchTimeline;
            totalReusedCache++;
          } else {
            raw = await riot.getMatchTimelineById(matchId, regional);
            await prisma.matchTimelineCache.upsert({
              where: { matchId },
              create: { matchId, timeline: raw as unknown as object },
              update: {},
            });
            totalFetched++;
          }

          const metrics = riotTimelineToSummaryMetrics(raw, summoner.puuid);
          await prisma.match.update({
            where: { matchId_puuid: { matchId, puuid: summoner.puuid } },
            data: metrics,
          });
          totalUpdated++;

          if (totalUpdated % 50 === 0) {
            logger.log(
              `    progress ${totalUpdated} (cached: ${totalReusedCache}, fetched: ${totalFetched}, failed: ${totalFailed})`
            );
          }
        } catch (err) {
          totalFailed++;
          logger.warn(`    ${matchId}: ${(err as Error).message}`);
        }
      }
    }

    logger.log(
      `Done. Updated ${totalUpdated} (reused cache: ${totalReusedCache}, fetched fresh: ${totalFetched}, failed: ${totalFailed}).`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
