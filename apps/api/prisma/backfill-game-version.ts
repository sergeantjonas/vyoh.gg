import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const updated = await prisma.$executeRaw`
    UPDATE "Match" m
    SET "gameVersion" = COALESCE(mdc.detail->'info'->>'gameVersion', '')
    FROM "MatchDetailCache" mdc
    WHERE m."matchId" = mdc."matchId"
      AND m."gameVersion" = ''
      AND mdc.detail->'info'->>'gameVersion' IS NOT NULL
  `;

  console.log(`Backfilled gameVersion on ${updated} Match rows.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
