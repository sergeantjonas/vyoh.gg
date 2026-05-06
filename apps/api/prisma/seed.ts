import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);

const matches = [
  {
    matchId: "EUW1_7234521894",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1834,
    playedAt: hoursAgo(2),
  },
  {
    matchId: "EUW1_7234518332",
    queueType: "Ranked Solo",
    champion: "Jhin",
    kills: 4,
    deaths: 7,
    assists: 5,
    win: false,
    durationSec: 2102,
    playedAt: hoursAgo(5),
  },
  {
    matchId: "EUW1_7234511027",
    queueType: "Ranked Flex",
    champion: "Lulu",
    kills: 2,
    deaths: 4,
    assists: 19,
    win: true,
    durationSec: 1612,
    playedAt: hoursAgo(28),
  },
  {
    matchId: "EUW1_7234503991",
    queueType: "ARAM",
    champion: "Jinx",
    kills: 21,
    deaths: 9,
    assists: 14,
    win: true,
    durationSec: 1287,
    playedAt: hoursAgo(53),
  },
  {
    matchId: "EUW1_7234492210",
    queueType: "Normal Draft",
    champion: "Lee Sin",
    kills: 6,
    deaths: 6,
    assists: 11,
    win: false,
    durationSec: 1955,
    playedAt: hoursAgo(72),
  },
  {
    matchId: "EUW1_7234481105",
    queueType: "Ranked Solo",
    champion: "Akali",
    kills: 11,
    deaths: 5,
    assists: 7,
    win: true,
    durationSec: 1718,
    playedAt: hoursAgo(96),
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  for (const match of matches) {
    await prisma.match.upsert({
      where: { matchId: match.matchId },
      create: match,
      update: match,
    });
  }

  console.log(`Seeded ${matches.length} matches.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
