// One-shot: refetch raw Match-V5 payloads for recent matches whose
// MatchDetailCache.detail is in the old projected shape (no `info`
// block, so info.gameVersion is unreachable). Re-stores the raw
// payload and patches Match.gameVersion in lockstep.
//
// Build first (nest build), then: node dist/src/scripts/refetch-recent-cache.js.
// Stop the dev API server before running so they don't share rate-limit
// budget. Lives under src/ so SWC emits decorator metadata for Nest DI;
// running via tsx silently strips that metadata and breaks injection.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { LolService } from "../lol/lol.service";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";

const CUTOFF_DAYS = Number(process.env.CUTOFF_DAYS ?? "90");

interface Row {
  matchId: string;
  region: string;
}

async function main() {
  const logger = new Logger("RefetchRecentCache");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const riot = app.get(RiotService);
    void app.get(LolService);

    const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT m."matchId", s."region"
      FROM "Match" m
      JOIN "Summoner" s ON s."puuid" = m."puuid"
      WHERE m."gameVersion" = ''
        AND m."playedAt" > ${cutoff}
      ORDER BY m."playedAt" DESC
    `;

    const unique = new Map<string, string>();
    for (const r of rows) {
      if (!unique.has(r.matchId)) unique.set(r.matchId, r.region);
    }

    logger.log(
      `Refetching ${unique.size} unique matches (${rows.length} Match rows) within last ${CUTOFF_DAYS} days.`
    );

    let done = 0;
    let failed = 0;
    for (const [matchId, region] of unique) {
      try {
        const regional = platformToRegional(region);
        const raw = await riot.getMatchById(matchId, regional);

        await prisma.matchDetailCache.upsert({
          where: { matchId },
          create: { matchId, detail: raw as unknown as object },
          update: { detail: raw as unknown as object, cachedAt: new Date() },
        });

        const gameVersion =
          typeof raw?.info?.gameVersion === "string" ? raw.info.gameVersion : "";
        if (gameVersion) {
          await prisma.match.updateMany({
            where: { matchId },
            data: { gameVersion },
          });
        }

        done++;
        if (done % 25 === 0) {
          logger.log(`  progress ${done}/${unique.size}`);
        }
      } catch (err) {
        failed++;
        logger.warn(`  ${matchId}: ${(err as Error).message}`);
      }
    }

    logger.log(`Complete. Refetched ${done}, failed ${failed}.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
