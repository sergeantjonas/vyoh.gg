import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const recent = await prisma.$queryRaw<
    Array<{ matchId: string; playedAt: Date; gameVersion: string }>
  >`
    SELECT "matchId", "playedAt", "gameVersion"
    FROM "Match"
    WHERE "gameVersion" <> ''
    ORDER BY "playedAt" DESC
    LIMIT 10
  `;

  console.log("Last 10 matches' Match.gameVersion (from our DB):");
  for (const r of recent) {
    console.log(`  ${r.playedAt.toISOString()}  ${r.matchId}  → ${r.gameVersion}`);
  }

  // Also pull the raw cache value for the same matches to confirm what Riot
  // actually returned vs what we stored.
  const matchIds = recent.map((r) => r.matchId);
  const raw = await prisma.$queryRaw<
    Array<{ matchId: string; raw_version: string | null }>
  >`
    SELECT "matchId", detail->'info'->>'gameVersion' AS raw_version
    FROM "MatchDetailCache"
    WHERE "matchId" = ANY(${matchIds})
  `;

  console.log(
    "\nSame matches' MatchDetailCache.detail->info->gameVersion (raw Riot payload):"
  );
  for (const r of raw) {
    console.log(`  ${r.matchId}  → ${r.raw_version}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
