import { computeHourDayStats, computeTiltStats } from "@/lol/profile/use-habits-stats";
import { computeStreak } from "@/lol/trends/trend-stats";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface Insight {
  kind: "tilt" | "streak" | "hour";
  headline: string;
  detail: string;
  /** Higher = more prominent. Used to pick the headline. */
  weight: number;
}

function tiltInsight(matches: MatchSummary[]): Insight | null {
  if (matches.length < 10) return null;
  const tilt = computeTiltStats(matches);
  if (tilt.afterWin.games < 5 || tilt.afterLoss.games < 5) return null;
  const wrWin = tilt.afterWin.wins / tilt.afterWin.games;
  const wrLoss = tilt.afterLoss.wins / tilt.afterLoss.games;
  const deltaPp = Math.round((wrWin - wrLoss) * 100);
  if (Math.abs(deltaPp) < 8) return null;
  return {
    kind: "tilt",
    headline:
      deltaPp > 0
        ? `Your win rate drops ${deltaPp}% after a loss.`
        : `You bounce back ${Math.abs(deltaPp)}% better after a loss than a win.`,
    detail: `${tilt.afterWin.games} games tracked after a win, ${tilt.afterLoss.games} after a loss.`,
    weight: Math.abs(deltaPp),
  };
}

function streakInsight(matches: MatchSummary[]): Insight | null {
  let bestWin = 0;
  let bestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  const ordered = [...excludeRemakes(matches)].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt)
  );
  for (const m of ordered) {
    if (m.win) {
      runWin += 1;
      runLoss = 0;
      if (runWin > bestWin) bestWin = runWin;
    } else {
      runLoss += 1;
      runWin = 0;
      if (runLoss > bestLoss) bestLoss = runLoss;
    }
  }
  const liveStreak = computeStreak(ordered);
  if (bestWin >= 4 || bestLoss >= 4 || (liveStreak && liveStreak.count >= 3)) {
    if (bestWin >= bestLoss && bestWin >= 4) {
      return {
        kind: "streak",
        headline: `Your longest win streak this window: ${bestWin} games.`,
        detail: "Worth knowing what worked there.",
        weight: bestWin * 5,
      };
    }
    if (bestLoss >= 4) {
      return {
        kind: "streak",
        headline: `Your longest loss streak this window: ${bestLoss} games.`,
        detail: "Worth knowing what changed during it.",
        weight: bestLoss * 4,
      };
    }
  }
  return null;
}

function hourInsight(matches: MatchSummary[]): Insight | null {
  if (matches.length < 15) return null;
  const overallWr =
    matches.filter((m) => m.win && !m.remake).length /
    Math.max(excludeRemakes(matches).length, 1);
  const hourDay = computeHourDayStats(matches);
  let bestSlot: { day: number; hour: number; wr: number; games: number } | null = null;
  for (const slot of hourDay) {
    if (slot.games < 4) continue;
    const wr = slot.wins / slot.games;
    if (!bestSlot || wr > bestSlot.wr) {
      bestSlot = { day: slot.day, hour: slot.hour, wr, games: slot.games };
    }
  }
  if (!bestSlot) return null;
  const deltaPp = Math.round((bestSlot.wr - overallWr) * 100);
  if (deltaPp < 10) return null;
  const dayLabel = DAY_LABELS[bestSlot.day] ?? "?";
  const wrPct = Math.round(bestSlot.wr * 100);
  return {
    kind: "hour",
    headline: `Your strongest slot is ${dayLabel} ${bestSlot.hour}:00 — ${wrPct}% WR.`,
    detail: `${bestSlot.games} games at this hour, +${deltaPp}% above your average.`,
    weight: deltaPp + 5,
  };
}

function pickInsight(matches: MatchSummary[]): Insight | null {
  const candidates: Insight[] = [];
  const t = tiltInsight(matches);
  if (t) candidates.push(t);
  const s = streakInsight(matches);
  if (s) candidates.push(s);
  const h = hourInsight(matches);
  if (h) candidates.push(h);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.weight - a.weight)[0] ?? null;
}

export function RecapTopInsight({ matches }: { matches: MatchSummary[] | undefined }) {
  const reduced = useReducedMotion();
  const insight = useMemo(() => (matches ? pickInsight(matches) : null), [matches]);

  if (!insight) {
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
          Headline insight
        </h2>
        <p className="text-base text-muted-foreground">
          Once you've played a few more games, the standout pattern will land here.
        </p>
      </m.section>
    );
  }

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
        Headline insight
      </h2>
      <p className="text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
        {insight.headline}
      </p>
      <p className="text-sm text-muted-foreground/80">{insight.detail}</p>
    </m.section>
  );
}
