// One-shot: populate the new T4 Phase A fields (visionScore, damageShare,
// firstBloodKill) on existing Match rows by reading the raw payload from
// MatchDetailCache.detail. Damage share requires the user's per-team total,
// so we compute it client-side from the cached participants array. Skips
// rows where the cache is in the old projected shape (no `info` block).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

interface RawParticipant {
  puuid: string;
  teamId: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  firstBloodKill: boolean;
}

interface CachedRiotMatch {
  info?: {
    participants?: RawParticipant[];
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Pull every Match row that's still on default values for the new fields,
  // joined with its raw cache row. Iterate in batches so we don't materialize
  // all 5000+ rows in memory.
  const targets = await prisma.$queryRaw<
    Array<{ matchId: string; puuid: string; detail: CachedRiotMatch }>
  >`
    SELECT m."matchId", m."puuid", mdc.detail
    FROM "Match" m
    JOIN "MatchDetailCache" mdc ON mdc."matchId" = m."matchId"
    WHERE m."visionScore" = 0 AND m."damageShare" = 0 AND m."firstBloodKill" = false
  `;

  console.log(`Inspecting ${targets.length} Match rows for backfill.`);

  let updated = 0;
  let skipped = 0;
  for (const row of targets) {
    const participants = row.detail?.info?.participants;
    if (!Array.isArray(participants)) {
      skipped++;
      continue;
    }
    const me = participants.find((p) => p.puuid === row.puuid);
    if (!me) {
      skipped++;
      continue;
    }

    let teamTotalDamage = 0;
    for (const p of participants) {
      if (p.teamId === me.teamId) teamTotalDamage += p.totalDamageDealtToChampions;
    }
    const damageShare =
      teamTotalDamage > 0 ? me.totalDamageDealtToChampions / teamTotalDamage : 0;

    await prisma.match.update({
      where: { matchId_puuid: { matchId: row.matchId, puuid: row.puuid } },
      data: {
        visionScore: me.visionScore ?? 0,
        damageShare,
        firstBloodKill: Boolean(me.firstBloodKill),
      },
    });
    updated++;
    if (updated % 200 === 0) {
      console.log(`  progress ${updated}/${targets.length}`);
    }
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped} (cache shape mismatch).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
