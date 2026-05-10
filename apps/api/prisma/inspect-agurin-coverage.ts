import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const summoner = await prisma.summoner.findFirst({
    where: { gameName: "Agurin" },
    select: {
      puuid: true,
      gameName: true,
      tagLine: true,
      historicalDoneAt: true,
      fetchedAt: true,
    },
  });
  if (!summoner) return;

  const totals = await prisma.match.aggregate({
    where: { puuid: summoner.puuid },
    _count: { matchId: true },
    _min: { playedAt: true },
    _max: { playedAt: true },
  });

  console.log(`Agurin (${summoner.puuid})`);
  console.log(`  Summoner row fetchedAt:     ${summoner.fetchedAt.toISOString()}`);
  console.log(
    `  Summoner row historicalDoneAt: ${summoner.historicalDoneAt?.toISOString() ?? "(null)"}`
  );
  console.log(`  Total Match rows:           ${totals._count.matchId}`);
  console.log(`  Oldest playedAt:            ${totals._min.playedAt?.toISOString()}`);
  console.log(`  Newest playedAt:            ${totals._max.playedAt?.toISOString()}`);

  // Bucket the oldest 50 matches by month so we can see if there's a hard
  // cutoff or if it just trails off.
  const monthly = await prisma.$queryRaw<Array<{ month: string; rows: bigint }>>`
    SELECT to_char("playedAt", 'YYYY-MM') AS month, COUNT(*)::bigint AS rows
    FROM "Match"
    WHERE "puuid" = ${summoner.puuid}
    GROUP BY 1
    ORDER BY 1 ASC
    LIMIT 24
  `;
  console.log("\nMatches per month (oldest 24 buckets):");
  for (const m of monthly) {
    console.log(`  ${m.month}: ${m.rows}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
