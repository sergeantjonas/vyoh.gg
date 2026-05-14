// One-shot manual trigger for the Steam owned-games sync. Same code path the
// 04:00 Europe/Brussels cron uses — handy for the initial backfill on a fresh
// DB, for manual retries after a Steam maintenance window, and for verifying
// schema changes in chunk 2b before they land on the scheduler.
//
// Build first (nest build), then: node dist/src/scripts/sync-steam-owned-games.js.
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in backfill-*.ts).

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SteamOwnedGamesService } from "../steam/owned-games.service";

async function main() {
  const logger = new Logger("SyncSteamOwnedGames");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const service = app.get(SteamOwnedGamesService);
    const diff = await service.syncOwnedGames();
    logger.log(
      `Sync complete. added=${diff.added.length} persisted=${diff.persisted.length} reappeared=${diff.reappeared.length} removed=${diff.removed.length}`
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
