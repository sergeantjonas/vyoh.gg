// One-shot: populate Match.teamPosition for rows that synced before the
// teamPosition column was added (Phase 6, 2026-05-10 morning). Pulls the
// user's participant from the cached raw payload and writes their
// teamPosition. Rows where the cache is in the old projected shape (no
// info block) skip silently, same posture as backfill-game-version.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Single-pass UPDATE that joins each Match to its raw cache, walks the
  // cached participants for the matching puuid, and writes that participant's
  // teamPosition back. ARAM / Arena / custom matches leave the field as ''
  // because Riot doesn't populate teamPosition for those queues.
  const updated = await prisma.$executeRaw`
    UPDATE "Match" m
    SET "teamPosition" = COALESCE(
      (
        SELECT p->>'teamPosition'
        FROM jsonb_array_elements(mdc.detail->'info'->'participants') AS p
        WHERE p->>'puuid' = m."puuid"
      ),
      ''
    )
    FROM "MatchDetailCache" mdc
    WHERE m."matchId" = mdc."matchId"
      AND m."teamPosition" = ''
      AND mdc.detail->'info'->'participants' IS NOT NULL
  `;

  console.log(`Backfilled teamPosition on ${updated} Match rows.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
