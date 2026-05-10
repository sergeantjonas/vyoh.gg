import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const totals = await prisma.$queryRaw<
    Array<{ total: bigint; with_version: bigint; without_version: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "gameVersion" <> '')::bigint AS with_version,
      COUNT(*) FILTER (WHERE "gameVersion" = '')::bigint AS without_version
    FROM "Match"
  `;

  const patches = await prisma.$queryRaw<
    Array<{ patch: string; rows: bigint; oldest: Date; newest: Date }>
  >`
    SELECT
      split_part("gameVersion", '.', 1) || '.' || split_part("gameVersion", '.', 2) AS patch,
      COUNT(*)::bigint AS rows,
      MIN("playedAt") AS oldest,
      MAX("playedAt") AS newest
    FROM "Match"
    WHERE "gameVersion" <> ''
    GROUP BY 1
    ORDER BY MAX("playedAt") DESC
    LIMIT 10
  `;

  console.log("Totals:", totals[0]);
  console.log("\nDistinct truncated patches (most recent first):");
  for (const p of patches) {
    console.log(
      `  ${p.patch}: ${p.rows} matches  (${p.oldest.toISOString().slice(0, 10)} → ${p.newest.toISOString().slice(0, 10)})`
    );
  }

  const emptyByWindow = await prisma.$queryRaw<Array<{ window: string; rows: bigint }>>`
    SELECT '30d' AS window, COUNT(*)::bigint AS rows FROM "Match"
      WHERE "gameVersion" = '' AND "playedAt" > NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT '60d', COUNT(*)::bigint FROM "Match"
      WHERE "gameVersion" = '' AND "playedAt" > NOW() - INTERVAL '60 days'
    UNION ALL
    SELECT '90d', COUNT(*)::bigint FROM "Match"
      WHERE "gameVersion" = '' AND "playedAt" > NOW() - INTERVAL '90 days'
    UNION ALL
    SELECT '180d', COUNT(*)::bigint FROM "Match"
      WHERE "gameVersion" = '' AND "playedAt" > NOW() - INTERVAL '180 days'
    UNION ALL
    SELECT 'all', COUNT(*)::bigint FROM "Match" WHERE "gameVersion" = ''
  `;
  console.log("\nEmpty-gameVersion rows by recency window:");
  for (const e of emptyByWindow) {
    console.log(`  ${e.window}: ${e.rows} matches`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
