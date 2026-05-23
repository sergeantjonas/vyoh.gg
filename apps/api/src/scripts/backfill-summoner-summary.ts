// One-shot: hydrate the Summoner denorm columns (currentRank* +
// lastPlayedChampionAlias + summaryUpdatedAt) for every Summoner row.
// New columns ship as nullable; without a refresh the nav menu falls
// back to the simple row even though canonical data (RankSnapshot,
// Match) already exists for these accounts. refreshAccountSummary
// reads only canonical tables, so this is a zero-Riot-call op.
//
// Build first (nest build), then: node dist/src/scripts/backfill-summoner-summary.js.
// Lives under src/ so SWC emits decorator metadata for Nest DI.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { LolService } from "../lol/lol.service";
import { PrismaService } from "../prisma/prisma.service";

async function main() {
  const logger = new Logger("BackfillSummonerSummary");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const lol = app.get(LolService);

    const summoners = await prisma.summoner.findMany({
      select: { puuid: true, gameName: true, tagLine: true, region: true },
    });
    logger.log(`Refreshing denorm summary for ${summoners.length} summoner row(s).`);

    let ok = 0;
    let failed = 0;
    for (const s of summoners) {
      try {
        await lol.refreshAccountSummary(s.puuid);
        ok++;
      } catch (err) {
        failed++;
        logger.warn(
          `  ${s.gameName}#${s.tagLine} (${s.region}): ${(err as Error).message}`
        );
      }
    }

    logger.log(`Done. Refreshed: ${ok}, failed: ${failed}.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
