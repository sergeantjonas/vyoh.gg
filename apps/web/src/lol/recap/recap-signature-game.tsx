// Baseline: personal — top KDA performance from your own games; tie-break favours wins, then biggest behind-at-15 comeback.
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

function kdaValue(m: MatchSummary): number {
  if (m.deaths === 0) return m.kills + m.assists;
  return (m.kills + m.assists) / m.deaths;
}

function score(m: MatchSummary): number {
  // Prefer wins, then high KDA, then biggest comeback (most negative
  // teamGoldDiffAt15 that still ended in a W).
  const kda = kdaValue(m);
  const winBoost = m.win ? 5 : 0;
  const comeback = m.win && m.teamGoldDiffAt15 < 0 ? -m.teamGoldDiffAt15 / 5000 : 0;
  return kda + winBoost + comeback;
}

function pickSignature(matches: MatchSummary[]): MatchSummary | null {
  const valid = matches.filter((m) => !m.remake);
  if (valid.length === 0) return null;
  let best: MatchSummary | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const m of valid) {
    const s = score(m);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function RecapSignatureGame({
  matches,
  accountSlug,
}: {
  matches: MatchSummary[] | undefined;
  accountSlug: string;
}) {
  const reduced = useReducedMotion();
  const pick = useMemo(() => (matches ? pickSignature(matches) : null), [matches]);
  const championName = useChampionName();

  if (!pick) {
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
          Signature game
        </h2>
        <p className="text-base text-muted-foreground">
          Once you've played a few more games, the standout performance will land here.
        </p>
      </m.section>
    );
  }

  const kda = kdaValue(pick);
  const kdaText = pick.deaths === 0 ? `${kda.toFixed(0)} (perfect)` : kda.toFixed(2);
  const dateLabel = formatDate(pick.playedAt);
  const headline = pick.win
    ? pick.teamGoldDiffAt15 <= -3000
      ? "Comeback win"
      : "Standout win"
    : "Carry performance";

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
        Signature game
      </h2>
      <Link
        to="/lol/$accountSlug/matches/$matchId"
        params={{ accountSlug, matchId: pick.matchId }}
        className="group flex items-center gap-4 rounded-lg transition-colors"
      >
        <ChampionSquareIcon
          championName={pick.champion}
          alt={championName(pick.champion)}
          className="size-14 shrink-0 rounded-lg ring-1 ring-border/60"
        />
        <div className="flex flex-col">
          <p className="text-2xl font-semibold text-foreground transition-colors group-hover:text-foreground/80 sm:text-3xl">
            {headline} on {championName(pick.champion)}
          </p>
          <p className="text-sm text-muted-foreground">
            {pick.kills}/{pick.deaths}/{pick.assists} · KDA {kdaText}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>
      </Link>
    </m.section>
  );
}
