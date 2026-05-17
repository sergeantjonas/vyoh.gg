// One-shot: re-project raw RiotMatch rows in MatchDetailCache to the lean
// StoredMatch format that strips heavy non-owner participant fields (Tier 1A
// Chunk B, landed 2026-05-17). Rows stored before that chunk have no isOwner
// discriminant on participants.
//
// Detection: if participants[0].isOwner is present the row is already current
// — skip it. Safe to re-run if interrupted.
//
// After a successful run, reclaim disk space:
//   VACUUM FULL "MatchDetailCache";
//
// Build first (nest build), then:
//   node dist/src/scripts/reproject-match-cache.js
// Lives under src/ so SWC emits decorator metadata for Nest DI.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IdentityService } from "../identity/identity.service";
import { projectMatchForStorage } from "../lol/match-projection";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatch } from "../riot/types";

const BATCH_SIZE = 100;

async function main() {
  const logger = new Logger("ReprojectMatchCache");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const identity = app.get(IdentityService);

    // Resolve owner puuids once — accounts are static for the life of a script run.
    const accounts = identity.getLolAccounts();
    let ownerPuuids = new Set<string>();
    if (accounts.length > 0) {
      const summoners = await prisma.summoner.findMany({
        where: {
          OR: accounts.map((a) => ({
            gameName: a.gameName,
            tagLine: a.tagLine,
            region: a.region,
          })),
        },
        select: { puuid: true },
      });
      ownerPuuids = new Set(summoners.map((s) => s.puuid));
    }

    logger.log(
      `Owner puuids resolved: ${ownerPuuids.size}. Scanning MatchDetailCache in batches of ${BATCH_SIZE}.`
    );

    let cursor: string | undefined;
    let totalScanned = 0;
    let totalSkipped = 0;
    let totalProjected = 0;
    let totalFailed = 0;

    for (;;) {
      const rows = await prisma.matchDetailCache.findMany({
        take: BATCH_SIZE,
        ...(cursor !== undefined ? { skip: 1, cursor: { matchId: cursor } } : {}),
        orderBy: { matchId: "asc" },
        select: { matchId: true, detail: true },
      });

      if (rows.length === 0) break;

      // Advance cursor before processing so an error mid-batch doesn't loop forever.
      cursor = rows[rows.length - 1]?.matchId;

      for (const row of rows) {
        totalScanned++;
        try {
          const detail = row.detail as Record<string, unknown>;
          const info = detail.info as Record<string, unknown> | undefined;
          const participants = info?.participants as unknown[] | undefined;
          const first = participants?.[0] as Record<string, unknown> | undefined;

          if (first !== undefined && "isOwner" in first) {
            totalSkipped++;
            continue;
          }

          const projected = projectMatchForStorage(
            row.detail as unknown as RiotMatch,
            ownerPuuids
          );

          await prisma.matchDetailCache.update({
            where: { matchId: row.matchId },
            data: { detail: projected as unknown as object },
          });
          totalProjected++;
        } catch (err) {
          totalFailed++;
          logger.warn(`  ${row.matchId}: ${(err as Error).message}`);
        }
      }

      logger.log(
        `  Batch — scanned: ${totalScanned}, projected: ${totalProjected}, skipped: ${totalSkipped}, failed: ${totalFailed}`
      );
    }

    logger.log(
      `Done. scanned: ${totalScanned}, projected: ${totalProjected}, already-current: ${totalSkipped}, failed: ${totalFailed}.`
    );
    if (totalProjected > 0) {
      logger.log('Next step: VACUUM FULL "MatchDetailCache";');
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
