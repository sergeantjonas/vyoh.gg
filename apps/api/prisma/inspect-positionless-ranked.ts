import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Per-queue: how many matches have empty teamPosition? Ranked queues
  // SHOULD always have a position. ARAM/Arena/Tutorial don't.
  const rows = await prisma.$queryRaw<
    Array<{ queueType: string; total: bigint; positionless: bigint }>
  >`
    SELECT
      "queueType",
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "teamPosition" = '')::bigint AS positionless
    FROM "Match"
    WHERE NOT remake
    GROUP BY "queueType"
    ORDER BY total DESC
  `;

  console.log("Per-queue positionless count:");
  for (const r of rows) {
    const pct =
      Number(r.total) > 0
        ? Math.round((Number(r.positionless) / Number(r.total)) * 100)
        : 0;
    console.log(
      `  ${r.queueType.padEnd(20)} total=${String(r.total).padStart(5)}  positionless=${String(r.positionless).padStart(5)} (${pct}%)`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
