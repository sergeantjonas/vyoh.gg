// One-shot: re-derive the `remake` flag for already-stored matches that the
// old mapper missed. The previous mapper read info.gameEndedInEarlySurrender,
// which Riot does not reliably populate at info-level — the flag actually
// lives on each participant. Anything with durationSec < 210 and the
// participant flag set is a remake.
//
// Strategy: candidate rows are durationSec < 210 AND remake = false. Reuse
// MatchDetailCache when present (no Riot call), else fetch the raw payload
// and store it. Re-run riotMatchToSummary and patch Match.remake only when
// the new flag differs.
//
// Build first (nest build), then: node dist/src/scripts/backfill-remake-flag.js.
// Lives under src/ so SWC emits decorator metadata for Nest DI.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IdentityService } from "../identity/identity.service";
import { riotMatchToSummary } from "../lol/match-mapper";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import type { RiotMatch } from "../riot/types";

const REMAKE_THRESHOLD_SEC = 210;

async function main() {
  const logger = new Logger("BackfillRemakeFlag");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const riot = app.get(RiotService);
    const identity = app.get(IdentityService);

    const accounts = identity.getLolAccounts();
    logger.log(
      `Re-deriving remake flag for ${accounts.length} accounts (rows with durationSec < ${REMAKE_THRESHOLD_SEC} and remake=false).`
    );

    let totalCandidates = 0;
    let totalFlipped = 0;
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

      const targets = await prisma.match.findMany({
        where: {
          puuid: summoner.puuid,
          remake: false,
          durationSec: { lt: REMAKE_THRESHOLD_SEC },
        },
        orderBy: { playedAt: "desc" },
        select: { matchId: true },
      });

      totalCandidates += targets.length;
      logger.log(`  ${account.gameName}: ${targets.length} candidates`);

      const regional = platformToRegional(account.region);

      for (const { matchId } of targets) {
        try {
          const cached = await prisma.matchDetailCache.findUnique({
            where: { matchId },
            select: { detail: true },
          });

          let raw: RiotMatch;
          if (cached) {
            raw = cached.detail as unknown as RiotMatch;
            totalReusedCache++;
          } else {
            raw = await riot.getMatchById(matchId, regional);
            await prisma.matchDetailCache.upsert({
              where: { matchId },
              create: { matchId, detail: raw as unknown as object },
              update: { detail: raw as unknown as object },
            });
            totalFetched++;
          }

          const summary = riotMatchToSummary(raw, summoner.puuid);
          if (summary.remake) {
            await prisma.match.update({
              where: { matchId_puuid: { matchId, puuid: summoner.puuid } },
              data: { remake: true },
            });
            totalFlipped++;
          }
        } catch (err) {
          totalFailed++;
          logger.warn(`    ${matchId}: ${(err as Error).message}`);
        }
      }
    }

    logger.log(
      `Done. Candidates: ${totalCandidates}, flipped to remake=true: ${totalFlipped} (reused cache: ${totalReusedCache}, fetched fresh: ${totalFetched}, failed: ${totalFailed}).`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
