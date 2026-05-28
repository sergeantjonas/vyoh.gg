// One-shot backfill for the dominantHex column added to SteamGameEnrichment
// on 2026-05-28. Targets games that already have a subject anchor (hero bytes
// were reachable) but were enriched before the column existed.
//
// Build first (nest build), then:
//   node dist/src/scripts/backfill-steam-dominant-hex.js

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { SteamSubjectAnchorService } from "../steam/subject-anchor.service";

async function main() {
  const logger = new Logger("BackfillSteamDominantHex");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const anchorService = app.get(SteamSubjectAnchorService);

    const rows = await prisma.steamGameEnrichment.findMany({
      where: { dominantHex: null, subjectXPercent: { not: null } },
      select: { appid: true },
    });
    const appids = rows.map((r) => r.appid);
    logger.log(`Found ${appids.length} apps needing dominantHex backfill.`);

    const updated = await anchorService.backfillMissingDominantHex(appids);
    logger.log(`Done. Wrote dominantHex for ${updated}/${appids.length} apps.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
