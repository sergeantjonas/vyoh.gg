// One-shot manual trigger for the SteamGridDb hero backfill. Same code path
// the monthly Steam enrichment cron uses via SteamGridDbService, but skips
// the full IStoreBrowseService re-pull — useful when the SGDB integration
// itself changes (new ranking, new dimension cutoff) without needing to
// re-fetch the Steam side of enrichment.
//
// Build first (nest build) and run:
//   node dist/src/scripts/backfill-steam-sgdb-heroes.js
// Or via tsx during development:
//   pnpm exec tsx src/scripts/backfill-steam-sgdb-heroes.ts
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in backfill-steam-enrichment.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGridDbService } from "../steam/griddb.service";

async function main() {
  const logger = new Logger("BackfillSteamSgdbHeroes");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const sgdb = app.get(SteamGridDbService);

    const rows = await prisma.steamOwnedGame.findMany({
      where: { removedAt: null },
      select: { appid: true },
    });
    const appids = rows.map((r) => r.appid);

    logger.log(`Running SGDB backfill across ${appids.length} owned appids.`);
    const updated = await sgdb.backfillMissingHeroes(appids);
    logger.log(`Done. ${updated} appids got a SteamGridDb hero.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
