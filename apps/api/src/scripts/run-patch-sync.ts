// One-shot manual trigger for the LoL patch-notes sync. Same code path the
// 6-hourly cron uses (PatchService.syncIfNewPatch) — handy for the initial
// seed on a fresh DB, for picking up a new patch without waiting for the
// next cron tick, and for re-running after a parser bugfix (the service
// pre-deletes existing change rows for the version, so re-runs are
// idempotent).
//
// Build first (nest build), then:
//   node dist/src/scripts/run-patch-sync.js
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in refresh-steam-achievement-schemas.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PatchService } from "../lol/patch.service";
import { PrismaService } from "../prisma/prisma.service";

async function main() {
  const logger = new Logger("RunPatchSync");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const patch = app.get(PatchService);
    const prisma = app.get(PrismaService);

    const synced = await patch.syncIfNewPatch();
    if (synced) {
      const count = await prisma.championPatchChange.count({
        where: { patchVersion: synced },
      });
      const sample = await prisma.championPatchChange.findMany({
        where: { patchVersion: synced },
        take: 5,
        orderBy: { id: "asc" },
      });
      logger.log(`Synced patch ${synced} — ${count} change rows total.`);
      for (const row of sample) {
        logger.log(`  ${row.championKey} (${row.ability ?? "-"}): ${row.changeText}`);
      }
    } else {
      const versions = await prisma.patchVersion.findMany({
        orderBy: { version: "desc" },
        take: 5,
      });
      logger.log("No new patch — current head already recorded. Recent versions:");
      for (const v of versions) {
        const count = await prisma.championPatchChange.count({
          where: { patchVersion: v.version },
        });
        logger.log(`  ${v.version} — ${count} change rows`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
