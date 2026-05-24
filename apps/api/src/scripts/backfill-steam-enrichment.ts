// One-shot manual trigger for the Steam enrichment re-pull. Same code path
// the monthly Europe/Brussels cron uses — handy when a new enrichment column
// lands (short description, deck compat, platforms, review summary, game
// rating, …) and existing rows need to be repopulated without waiting for
// the next monthly tick.
//
// Build first (nest build), then:
//   node dist/src/scripts/backfill-steam-enrichment.js
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in refresh-steam-achievement-schemas.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { SteamEnrichmentService } from "../steam/enrichment.service";
import { SteamService } from "../steam/steam.service";

async function main() {
  const logger = new Logger("BackfillSteamEnrichment");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const enrichment = app.get(SteamEnrichmentService);
    const steam = app.get(SteamService);

    const owned = await prisma.steamOwnedGame.findMany({
      where: { removedAt: null },
      select: { appid: true },
    });
    let wishlist: number[] = [];
    try {
      const w = await steam.getOwnerWishlist();
      wishlist = w.items.map((i) => i.appid);
    } catch (err) {
      logger.warn(`wishlist fetch failed (${String(err)}); proceeding with owned only`);
    }
    const appids = Array.from(new Set([...owned.map((g) => g.appid), ...wishlist]));

    logger.log(`Re-enriching ${appids.length} appids (owned + wishlist).`);
    const written = await enrichment.enrichApps(appids);
    logger.log(`Done. Persisted ${written}/${appids.length} rows.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
