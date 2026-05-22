// PN3: backfill csAt10 from challenges.laneMinionsFirst10Minutes for Match
// rows that lack a projected timeline. Source: MatchDetailCache.detail JSON
// (already populated for every owner-played match).
//
// Distinct from backfill-timeline-metrics.ts:
//   - that script does a Riot fetch + frame walk to populate the full
//     timeline-derived set (csAt15, goldAt10/15, death/kill arrays, etc.).
//   - this script does NOT touch hasTimeline — only csAt10. The flag stays
//     false because we never read a timeline, only a challenge field.
//
// Build first (nest build), then:
//   node dist/src/scripts/backfill-cs-at-10-from-challenges.js

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";

type StoredDetailJson = {
  info: {
    participants: Array<{
      puuid: string;
      challenges?: { laneMinionsFirst10Minutes?: number };
    }>;
  };
};

async function main() {
  const logger = new Logger("BackfillCsAt10FromChallenges");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const identity = app.get(IdentityService);
    const accounts = identity.getLolAccounts();

    logger.log(`Backfilling csAt10 from challenges for ${accounts.length} accounts.`);

    let totalUpdated = 0;
    let totalNoChallenge = 0;
    let totalNoDetail = 0;

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
      if (!summoner) continue;

      // Target lane-position rows where the timeline never ran AND csAt10
      // is still at the default. Rows with hasTimeline=true already have a
      // frame-derived csAt10. Junglers and non-Rift rows (empty teamPosition)
      // are excluded because `laneMinionsFirst10Minutes` doesn't map to the
      // timeline-derived csAt10 for those — see match-mapper isLaneRole.
      const targets = await prisma.match.findMany({
        where: {
          puuid: summoner.puuid,
          hasTimeline: false,
          csAt10: 0,
          remake: false,
          teamPosition: { in: ["TOP", "MIDDLE", "BOTTOM", "UTILITY"] },
        },
        select: { matchId: true },
        orderBy: { playedAt: "desc" },
      });

      logger.log(`  ${account.gameName}: ${targets.length} matches to consider`);

      if (targets.length === 0) continue;

      const detailRows = await prisma.matchDetailCache.findMany({
        where: { matchId: { in: targets.map((t) => t.matchId) } },
        select: { matchId: true, detail: true },
      });
      const detailByMatchId = new Map<string, StoredDetailJson>();
      for (const dr of detailRows) {
        detailByMatchId.set(dr.matchId, dr.detail as StoredDetailJson);
      }

      for (const { matchId } of targets) {
        const detail = detailByMatchId.get(matchId);
        if (!detail) {
          totalNoDetail++;
          continue;
        }
        const owner = detail.info?.participants?.find((p) => p.puuid === summoner.puuid);
        const csAt10 = owner?.challenges?.laneMinionsFirst10Minutes;
        // `undefined` means the match has no challenges block at all (URF /
        // other special modes). Don't conflate that with a genuine 0 — a
        // laner with very bad early CS could legitimately register 0, and
        // we already gated this query to lane positions.
        if (csAt10 === undefined) {
          totalNoChallenge++;
          continue;
        }
        await prisma.match.update({
          where: { matchId_puuid: { matchId, puuid: summoner.puuid } },
          data: { csAt10 },
        });
        totalUpdated++;
      }
    }

    logger.log(
      `Done. Updated ${totalUpdated} rows. Skipped: ${totalNoChallenge} (no challenge), ${totalNoDetail} (no detail cache row).`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
