import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Lock to the Agurin account (assumes there's a row in Summoner with that gameName).
  const summoner = await prisma.summoner.findFirst({
    where: { gameName: "Agurin" },
    select: { puuid: true, gameName: true, tagLine: true, region: true },
  });
  if (!summoner) {
    console.log("No Summoner row for gameName=Agurin");
    return;
  }
  console.log(
    `Summoner: ${summoner.gameName}#${summoner.tagLine} ${summoner.region} ${summoner.puuid}`
  );

  // Most recent 200 matches per account: that's TRENDS_FETCH_COUNT.
  const top200 = await prisma.match.findMany({
    where: { puuid: summoner.puuid },
    orderBy: { playedAt: "desc" },
    take: 200,
    select: { matchId: true, playedAt: true, queueType: true, gameVersion: true },
  });
  console.log(`\nMost recent 200 cached matches for Agurin: ${top200.length}`);

  const seriousQueues = new Set(["Ranked Solo", "Ranked Flex"]);
  const serious = top200.filter((m) => seriousQueues.has(m.queueType));
  console.log(`  filtered to serious (Solo+Flex): ${serious.length}`);

  const seriousWithVersion = serious.filter((m) => m.gameVersion !== "");
  const seriousEmpty = serious.filter((m) => m.gameVersion === "");
  console.log(`  serious with gameVersion: ${seriousWithVersion.length}`);
  console.log(`  serious empty gameVersion: ${seriousEmpty.length}`);

  // Truncate to year-major (API+10) so groupings match what the UI shows.
  const truncate = (gv: string): string => {
    if (!gv) return "";
    const [maj, min] = gv.split(".");
    if (!maj || !min) return "";
    const n = Number(maj);
    if (!Number.isFinite(n)) return "";
    return `${n >= 20 ? n : n + 10}.${min}`;
  };

  const byPatch = new Map<string, number>();
  for (const m of serious) {
    const p = truncate(m.gameVersion) || "(empty)";
    byPatch.set(p, (byPatch.get(p) ?? 0) + 1);
  }
  console.log("\nAgurin serious-matches by patch (in the last 200):");
  for (const [patch, count] of [...byPatch.entries()].sort((a, b) =>
    b[0].localeCompare(a[0])
  )) {
    console.log(`  ${patch}: ${count}`);
  }

  // Activity widget: Profile renders 365-day heatmap. Replicate the "matches
  // played in last 365 days" count to see if there are surprises.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const yearTotal = await prisma.match.count({
    where: { puuid: summoner.puuid, playedAt: { gte: oneYearAgo } },
  });
  const yearByQueue = await prisma.match.groupBy({
    by: ["queueType"],
    where: { puuid: summoner.puuid, playedAt: { gte: oneYearAgo } },
    _count: { matchId: true },
  });
  console.log(`\nMatches in the last 365 days (all queues): ${yearTotal}`);
  console.log("  by queue:");
  for (const row of yearByQueue.sort((a, b) => b._count.matchId - a._count.matchId)) {
    console.log(`    ${row.queueType}: ${row._count.matchId}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
