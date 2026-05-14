// Baseline: personal — per-champion WR in the recent half of the window vs the older half.
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const MIN_GAMES_PER_HALF = 4;

interface ImprovementCandidate {
  champion: string;
  earlyGames: number;
  earlyWr: number;
  recentGames: number;
  recentWr: number;
  deltaPp: number;
}

function computeMostImproved(matches: MatchSummary[]): ImprovementCandidate | null {
  const valid = matches.filter((m) => !m.remake);
  if (valid.length < MIN_GAMES_PER_HALF * 2) return null;
  const sorted = [...valid].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const cutoff = Math.floor(sorted.length / 2);
  const earlyHalf = sorted.slice(0, cutoff);
  const recentHalf = sorted.slice(cutoff);

  type Bucket = { games: number; wins: number };
  const early = new Map<string, Bucket>();
  const recent = new Map<string, Bucket>();
  const tally = (target: Map<string, Bucket>, match: MatchSummary) => {
    const prev = target.get(match.champion) ?? { games: 0, wins: 0 };
    target.set(match.champion, {
      games: prev.games + 1,
      wins: prev.wins + (match.win ? 1 : 0),
    });
  };
  for (const m of earlyHalf) tally(early, m);
  for (const m of recentHalf) tally(recent, m);

  let best: ImprovementCandidate | null = null;
  for (const [champion, recentB] of recent) {
    if (recentB.games < MIN_GAMES_PER_HALF) continue;
    const earlyB = early.get(champion);
    if (!earlyB || earlyB.games < MIN_GAMES_PER_HALF) continue;
    const earlyWr = earlyB.wins / earlyB.games;
    const recentWr = recentB.wins / recentB.games;
    const deltaPp = Math.round((recentWr - earlyWr) * 100);
    if (deltaPp <= 0) continue;
    if (!best || deltaPp > best.deltaPp) {
      best = {
        champion,
        earlyGames: earlyB.games,
        earlyWr,
        recentGames: recentB.games,
        recentWr,
        deltaPp,
      };
    }
  }
  return best;
}

export function RecapMostImproved({
  matches,
  accountSlug,
}: {
  matches: MatchSummary[] | undefined;
  accountSlug: string;
}) {
  const reduced = useReducedMotion();
  const best = useMemo(() => (matches ? computeMostImproved(matches) : null), [matches]);
  const championName = useChampionName();

  if (!best) {
    return (
      <m.section
        layout
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={reduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col gap-3 rounded-xl border bg-card/40 p-6"
      >
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
          Most improved
        </h2>
        <p className="text-base text-muted-foreground">
          Once a champion in your pool gains traction late in the window, that lift will
          land here.
        </p>
      </m.section>
    );
  }

  const earlyPct = Math.round(best.earlyWr * 100);
  const recentPct = Math.round(best.recentWr * 100);

  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-4 rounded-xl border bg-card/40 p-6 sm:p-8"
    >
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Most improved
      </h2>
      <div className="flex items-center gap-4">
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{ accountSlug, championKey: best.champion.toLowerCase() }}
          className="shrink-0"
        >
          <ChampionSquareIcon
            championName={best.champion}
            alt={championName(best.champion)}
            className="size-14 rounded-lg ring-1 ring-border/60"
          />
        </Link>
        <div className="flex flex-col">
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            {championName(best.champion)}
          </p>
          <p className="text-sm text-muted-foreground">
            {earlyPct}% → {recentPct}% win rate · +{best.deltaPp}% in the recent half
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground/80">
        Early window: {best.earlyGames} games. Recent window: {best.recentGames} games.
        Whatever changed, keep doing it.
      </p>
    </m.section>
  );
}
