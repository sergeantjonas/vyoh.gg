// Reports what the Portrait's identity cards would say against the live
// library, without building any of them. The point is to look at real numbers
// before committing to card copy — a claim that reads well on invented data
// ("62% of your hours sit in CRPG, Strategy, Soulslike") can turn out to be
// carried by two games, or by a tag the community applied as a joke.
//
// Also the tuning instrument for the engagement floor and the genre allowlist:
// `--floor` and `--rank-limit` override the shipped constants so a threshold
// can be argued from output rather than from taste. Neither flag writes
// anything — this script only reads.
//
// Build first (nest build), then:
//   node dist/src/scripts/probe-portrait-fingerprint.js
//   node dist/src/scripts/probe-portrait-fingerprint.js --floor 120 --rank-limit 8

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  COMPLETIONIST_PLAYTIME_MINUTES,
  GENRE_TAG_RANK_LIMIT,
  MEANINGFUL_PLAYTIME_MINUTES,
  isGenreTag,
  isSteamGameAppType,
  isUmbrellaGenreTag,
  selectGenreTags,
} from "@vyoh/shared";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { SteamPortraitService } from "../steam/portrait.service";

function numericFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const floor = numericFlag("floor", MEANINGFUL_PLAYTIME_MINUTES);
const rankLimit = numericFlag("rank-limit", GENRE_TAG_RANK_LIMIT);

const hours = (minutes: number) => Math.round(minutes / 60);
const pct = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);

type Game = {
  appid: number;
  name: string;
  minutes: number;
  tags: string[];
  genres: string[];
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["warn", "error"],
  });

  try {
    const prisma = app.get(PrismaService);

    const owned = await prisma.steamOwnedGame.findMany({
      where: { removedAt: null },
      select: {
        appid: true,
        name: true,
        snapshots: {
          orderBy: { snapshotDate: "desc" },
          take: 1,
          select: { playtimeForeverMinutes: true },
        },
      },
    });

    const enrichment = await prisma.steamGameEnrichment.findMany({
      select: { appid: true, appType: true, tagIds: true },
    });
    const enrichmentByAppid = new Map(enrichment.map((row) => [row.appid, row]));

    const tagCatalog = await prisma.steamTag.findMany({
      select: { id: true, name: true },
    });
    const tagName = new Map(tagCatalog.map((tag) => [tag.id, tag.name]));

    // The probe re-implements selection rather than calling `selectGenreTags`,
    // because the whole point is sweeping a rank limit the shipped helper
    // holds constant. The two must stay in step — the assertion below fails
    // loudly if the default run ever disagrees with the helper.
    const selectAt = (tags: string[], limit: number): string[] => {
      const genres = tags.slice(0, limit).filter(isGenreTag);
      const specific = genres.filter((tag) => !isUmbrellaGenreTag(tag));
      return specific.length > 0 ? specific : genres;
    };

    const library: Game[] = owned
      .filter((game) =>
        isSteamGameAppType(enrichmentByAppid.get(game.appid)?.appType ?? null)
      )
      .map((game) => {
        const tags = (enrichmentByAppid.get(game.appid)?.tagIds ?? []).flatMap((id) => {
          const name = tagName.get(id);
          return name ? [name] : [];
        });
        return {
          appid: game.appid,
          name: game.name,
          minutes: game.snapshots[0]?.playtimeForeverMinutes ?? 0,
          tags,
          genres: selectAt(tags, rankLimit),
        };
      });

    // The re-implementation above must agree with the shipped helper at the
    // default limit, or the probe is tuning something the app doesn't run.
    for (const game of library) {
      const shipped = selectGenreTags(game.tags).join("|");
      const local = selectAt(game.tags, GENRE_TAG_RANK_LIMIT).join("|");
      if (shipped !== local) {
        throw new Error(
          `probe drifted from selectGenreTags on ${game.name}: "${local}" vs "${shipped}"`
        );
      }
    }

    const cohort = library.filter((game) => game.minutes >= floor);
    const tasted = library.filter((game) => game.minutes > 0 && game.minutes < floor);
    const ghosts = library.filter((game) => game.minutes === 0);
    const totalMinutes = library.reduce((sum, game) => sum + game.minutes, 0);
    const cohortMinutes = cohort.reduce((sum, game) => sum + game.minutes, 0);

    console.log(`floor ${floor} min · rank limit ${rankLimit}\n`);

    console.log("── card 6 · library posture ─────────────────────────");
    console.log(`  owned                ${library.length}`);
    console.log(
      `  meaningfully played  ${cohort.length}  (${pct(cohort.length, library.length).toFixed(0)}%)`
    );
    console.log(`  tasted               ${tasted.length}`);
    console.log(`  never launched       ${ghosts.length}`);
    console.log(
      `  hours in cohort      ${hours(cohortMinutes)} of ${hours(totalMinutes)}  (${pct(cohortMinutes, totalMinutes).toFixed(1)}%)`
    );

    // Each game's playtime divides across its matched genres, so the shares
    // sum to 100. Counting a 400h game once per tag would report 300%+.
    const weights = new Map<string, number>();
    const gamesPerGenre = new Map<string, number>();
    for (const game of cohort) {
      if (game.genres.length === 0) continue;
      for (const genre of game.genres) {
        weights.set(genre, (weights.get(genre) ?? 0) + game.minutes / game.genres.length);
        gamesPerGenre.set(genre, (gamesPerGenre.get(genre) ?? 0) + 1);
      }
    }
    const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
    const distributed = [...weights.values()].reduce((sum, m) => sum + m, 0);

    console.log("\n── card 1 · lifetime genre ──────────────────────────");
    for (const [genre, minutes] of ranked.slice(0, 12)) {
      const carriers = gamesPerGenre.get(genre) ?? 0;
      console.log(
        `  ${pct(minutes, distributed).toFixed(1).padStart(5)}%  ${hours(minutes).toString().padStart(4)}h  ${genre}  (${carriers} game${carriers === 1 ? "" : "s"})`
      );
    }
    const top3 = ranked.slice(0, 3);
    const top3Share = pct(
      top3.reduce((sum, [, m]) => sum + m, 0),
      distributed
    );
    console.log(
      `\n  would read: "${top3Share.toFixed(0)}% of your ${hours(distributed)} hours sit in ${top3.map(([g]) => g).join(", ")}."`
    );

    // A genre carried by one game is a fact about that game, not about the
    // player — worth seeing before it ends up in card copy as identity.
    const thin = top3.filter(([genre]) => (gamesPerGenre.get(genre) ?? 0) < 3);
    if (thin.length > 0) {
      console.log(
        `  ⚠ thin: ${thin.map(([g]) => `${g} rests on ${gamesPerGenre.get(g)} game(s)`).join("; ")}`
      );
    }

    const blind = cohort.filter((game) => game.genres.length === 0);
    console.log(`\n  no genre signal: ${blind.length} of ${cohort.length}`);
    for (const game of blind) {
      console.log(`    · ${game.name} — ${game.tags.length} tags, none allowlisted`);
    }

    console.log("\n── card 3 · completionist floor ─────────────────────");
    const deep = cohort.filter((game) => game.minutes >= COMPLETIONIST_PLAYTIME_MINUTES);
    console.log(
      `  ${deep.length} games past ${COMPLETIONIST_PLAYTIME_MINUTES / 60}h — the only ones whose completion % means anything`
    );

    console.log("\n── cards 7 and 9 · the anti-portrait ────────────────");
    const tastedMinutes = tasted.reduce((sum, game) => sum + game.minutes, 0);
    console.log(
      `  tasted tier: ${tasted.length} games, ${hours(tastedMinutes)}h total, median ${median(tasted.map((g) => g.minutes))} min each`
    );
    for (const game of [...tasted].sort((a, b) => a.minutes - b.minutes).slice(0, 5)) {
      console.log(`    · ${game.name} — ${game.minutes} min`);
    }

    console.log("\n── how the fingerprint reads the heaviest games ─────");
    for (const game of [...cohort].sort((a, b) => b.minutes - a.minutes).slice(0, 12)) {
      console.log(
        `  ${hours(game.minutes).toString().padStart(4)}h  ${game.name} → ${game.genres.join(", ") || "—"}`
      );
    }

    console.log("\n── rank-limit sweep ─────────────────────────────────");
    console.log("  the joke tags drop out where the top three stops moving");
    for (const limit of [6, 8, 10, 12, 14, 20]) {
      const swept = new Map<string, number>();
      let blindAt = 0;
      for (const game of cohort) {
        const genres = selectAt(game.tags, limit);
        if (genres.length === 0) {
          blindAt += 1;
          continue;
        }
        for (const genre of genres) {
          swept.set(genre, (swept.get(genre) ?? 0) + game.minutes / genres.length);
        }
      }
      const top = [...swept.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      console.log(
        `  ${limit.toString().padStart(2)}  blind ${blindAt}  ${top.map(([g]) => g).join(", ")}`
      );
    }

    // What the endpoint actually answers, computed by the shipped service
    // rather than by anything above. Everything before this point is the
    // independent reading the numbers were argued from, so a disagreement
    // between the two sections is the finding.
    // Timed because the SSR priming rule in docs/repo-conventions.md turns on
    // latency, and reading the code cannot answer it.
    const startedAt = performance.now();
    const portrait = await app.get(SteamPortraitService).getPortrait();
    const elapsedMs = performance.now() - startedAt;

    console.log("\n── GET /api/steam/portrait ──────────────────────────");
    console.log(
      `  synced ${portrait.lastSyncedAt ?? "never"} · computed in ${elapsedMs.toFixed(0)} ms · ${JSON.stringify(portrait).length} B`
    );
    console.log(
      `  posture  ${portrait.posture.meaningfulCount} meaningful · ${portrait.posture.tastedCount} tasted · ${portrait.posture.ghostCount} ghosts of ${portrait.posture.ownedCount} owned`
    );
    console.log(
      `  lifetime ${portrait.lifetime.gamesCounted} games · ${hours(portrait.lifetime.distributedMinutes)}h · ${portrait.lifetime.gamesWithoutGenre} without genre`
    );
    for (const genre of portrait.lifetime.genres.slice(0, 5)) {
      console.log(
        `    ${(genre.share * 100).toFixed(1).padStart(5)}%  ${genre.tag}  (${genre.gameCount})`
      );
    }
    if (portrait.recent === null) {
      console.log("  recent   none — a delta needs two snapshot dates");
    } else {
      console.log(
        `  recent   ${portrait.recent.window.days}d since ${portrait.recent.window.since.slice(0, 10)} · ${portrait.recent.fingerprint.gamesCounted} games · ${hours(portrait.recent.fingerprint.distributedMinutes)}h`
      );
      for (const genre of portrait.recent.fingerprint.genres.slice(0, 5)) {
        console.log(
          `    ${(genre.share * 100).toFixed(1).padStart(5)}%  ${genre.tag}  (${genre.gameCount})`
        );
      }
    }
  } finally {
    await app.close();
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (upper === undefined) return 0;
  return sorted.length % 2 === 0 && lower !== undefined
    ? Math.round((lower + upper) / 2)
    : upper;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
