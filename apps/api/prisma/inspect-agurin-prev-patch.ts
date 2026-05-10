import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const summoner = await prisma.summoner.findFirst({
    where: { gameName: "Agurin" },
    select: { puuid: true, gameName: true, tagLine: true },
  });
  if (!summoner) return;

  // Pull the chronologically newest match where the truncated API patch is 16.8
  // (= year-major 26.8). 16.8.x.x covers all build numbers within that patch.
  const newestPrev = await prisma.match.findFirst({
    where: {
      puuid: summoner.puuid,
      gameVersion: { startsWith: "16.8." },
    },
    orderBy: { playedAt: "desc" },
    select: { matchId: true, playedAt: true, queueType: true, gameVersion: true },
  });

  if (!newestPrev) {
    console.log("No matches found on patch 16.8 (= 26.8) for Agurin.");
    return;
  }

  console.log("Newest 26.8 match for Agurin:");
  console.log(`  ${newestPrev.playedAt.toISOString()}  ${newestPrev.matchId}`);
  console.log(`  queue=${newestPrev.queueType}  gameVersion=${newestPrev.gameVersion}`);

  const totalSince = await prisma.match.count({
    where: {
      puuid: summoner.puuid,
      playedAt: { gt: newestPrev.playedAt },
    },
  });
  const seriousSince = await prisma.match.count({
    where: {
      puuid: summoner.puuid,
      playedAt: { gt: newestPrev.playedAt },
      queueType: { in: ["Ranked Solo", "Ranked Flex"] },
    },
  });

  console.log("\nMatches Agurin has played since that game:");
  console.log(`  total (all queues): ${totalSince}`);
  console.log(`  serious (Solo+Flex): ${seriousSince}`);

  // Also count matches on each side of the patch boundary for context.
  const on269 = await prisma.match.count({
    where: { puuid: summoner.puuid, gameVersion: { startsWith: "16.9." } },
  });
  const on268 = await prisma.match.count({
    where: { puuid: summoner.puuid, gameVersion: { startsWith: "16.8." } },
  });
  console.log("\nFor reference:");
  console.log(`  total on 26.9: ${on269}`);
  console.log(`  total on 26.8: ${on268}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
