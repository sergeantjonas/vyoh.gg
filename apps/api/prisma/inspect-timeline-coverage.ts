import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Per-account: total matches, matches with deathTimings populated (timeline projected),
  // matches still empty.
  const rows = await prisma.$queryRaw<
    Array<{
      gameName: string;
      total: bigint;
      projected: bigint;
      empty: bigint;
    }>
  >`
    SELECT
      s."gameName",
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE m."csAt10" > 0 OR cardinality(m."deathTimings") > 0)::bigint AS projected,
      COUNT(*) FILTER (WHERE m."csAt10" = 0 AND cardinality(m."deathTimings") = 0)::bigint AS empty
    FROM "Match" m
    JOIN "Summoner" s ON s."puuid" = m."puuid"
    GROUP BY s."gameName"
    ORDER BY s."gameName"
  `;

  console.log("Timeline projection coverage (per account):");
  for (const r of rows) {
    const pct =
      Number(r.total) > 0 ? Math.round((Number(r.projected) / Number(r.total)) * 100) : 0;
    console.log(
      `  ${r.gameName.padEnd(20)} total=${r.total}  projected=${r.projected} (${pct}%)  empty=${r.empty}`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
