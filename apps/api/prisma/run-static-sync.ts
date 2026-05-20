// One-shot: trigger LolStaticSyncService.syncAll() to populate the static
// catalog tables (LolItem, LolChampion, LolChampionAbility, LolSummonerSpell,
// LolPerk). Run after `pnpm run db:deploy` lands the 20260521000000 migration
// against a fresh dev DB, so the bundle endpoint serves something instead of
// erroring with TableDoesNotExist or returning an empty payload.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { LolStaticSyncService } from "../src/lol/lol-static-sync.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  Logger.overrideLogger(["log", "warn", "error"]);
  const service = new LolStaticSyncService(prisma);
  const summary = await service.syncAll();
  console.log("syncAll done:", summary);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
