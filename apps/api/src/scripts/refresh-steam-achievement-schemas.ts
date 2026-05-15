// One-shot manual trigger for the Steam achievement schema refresh. Same code
// path the monthly Europe/Brussels cron uses — handy for the initial backfill
// on a fresh DB, for picking up new game additions without waiting for the
// next monthly tick, and for re-pulling descriptions after a Steam-side change
// (e.g. publisher edits an achievement's localized strings).
//
// Build first (nest build), then:
//   node dist/src/scripts/refresh-steam-achievement-schemas.js
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in sync-steam-owned-games.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementSchemaService } from "../steam/achievement-schema.service";

async function main() {
  const logger = new Logger("RefreshSteamAchievementSchemas");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);
    const schema = app.get(SteamAchievementSchemaService);

    const games = await prisma.steamOwnedGame.findMany({
      where: { removedAt: null },
      select: { appid: true },
    });
    const appids = games.map((g) => g.appid);

    const blanksBefore = await prisma.steamGameAchievement.count({
      where: { description: "" },
    });
    logger.log(
      `Refreshing schemas for ${appids.length} owned games. Empty-description rows before: ${blanksBefore}.`
    );

    const result = await schema.refreshSchemas(appids);

    const blanksAfter = await prisma.steamGameAchievement.count({
      where: { description: "" },
    });
    logger.log(
      `Done. ${JSON.stringify(result)}. Empty-description rows after: ${blanksAfter} (filled ${blanksBefore - blanksAfter}).`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
