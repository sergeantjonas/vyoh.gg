import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useSeriousMatches } from "@/lol/_shared/serious-queues";
import { computeHourDayStats, computeTiltStats } from "@/lol/profile/use-habits-stats";
import { computeStreak } from "@/lol/trends/trend-stats";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import type { ReactNode } from "react";

const SUGGEST_DAYS = 14;
const TIME_SLOT_DELTA = 0.05;
const MIN_HOUR_SAMPLE = 3;

interface RitualSignal {
  id: string;
  label: string;
  verdict: ReactNode;
  detail?: string;
  tone: "neutral" | "positive" | "warning";
}

function nowMonFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function buildFormSignal(matches: MatchSummary[]): RitualSignal {
  const played = matches.filter((m) => !m.remake);
  if (played.length === 0) {
    return {
      id: "form",
      label: "Form",
      verdict: "No recent games.",
      tone: "neutral",
    };
  }
  const streak = computeStreak(played);
  const last = [...played].sort((a, b) => b.playedAt.localeCompare(a.playedAt))[0];
  if (streak) {
    const word = streak.type === "win" ? "win" : "loss";
    return {
      id: "form",
      label: "Form",
      verdict: `On a ${streak.count}-game ${word} streak.`,
      tone: streak.type === "win" ? "positive" : "warning",
    };
  }
  if (!last) {
    return { id: "form", label: "Form", verdict: "No recent games.", tone: "neutral" };
  }
  return {
    id: "form",
    label: "Form",
    verdict: last.win ? "Last game was a win." : "Last game was a loss.",
    tone: last.win ? "positive" : "warning",
  };
}

function buildTiltSignal(matches: MatchSummary[]): RitualSignal {
  const played = matches.filter((m) => !m.remake);
  if (played.length < 5) {
    return {
      id: "tilt",
      label: "After last game",
      verdict: "Need a few more games to read.",
      tone: "neutral",
    };
  }
  const last = [...played].sort((a, b) => b.playedAt.localeCompare(a.playedAt))[0];
  if (!last) {
    return {
      id: "tilt",
      label: "After last game",
      verdict: "No recent games.",
      tone: "neutral",
    };
  }
  const tilt = computeTiltStats(played);
  const bucket = last.win ? tilt.afterWin : tilt.afterLoss;
  if (bucket.games < 3) {
    return {
      id: "tilt",
      label: "After last game",
      verdict: `Not enough games after a ${last.win ? "win" : "loss"} yet.`,
      tone: "neutral",
    };
  }
  const wr = bucket.wins / bucket.games;
  const pct = Math.round(wr * 100);
  return {
    id: "tilt",
    label: "After last game",
    verdict: `After a ${last.win ? "win" : "loss"} you historically win ${pct}%.`,
    detail: `${bucket.games} games tracked`,
    tone: wr >= 0.5 ? "positive" : "warning",
  };
}

function buildTimeSlotSignal(matches: MatchSummary[]): RitualSignal {
  const played = matches.filter((m) => !m.remake);
  if (played.length < 10) {
    return {
      id: "slot",
      label: "Time slot",
      verdict: "Need more games to read your hours.",
      tone: "neutral",
    };
  }
  const overallWr = played.filter((m) => m.win).length / played.length;
  const hourDay = computeHourDayStats(played);
  const now = new Date();
  const day = nowMonFirstDay(now);
  const hour = now.getHours();
  const slot = hourDay.find((s) => s.day === day && s.hour === hour);
  const slotLabel = `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day]} ${hour}:00`;
  if (!slot || slot.games < MIN_HOUR_SAMPLE) {
    return {
      id: "slot",
      label: "Time slot",
      verdict: `Untested hour for you (${slotLabel}).`,
      tone: "neutral",
    };
  }
  const wr = slot.wins / slot.games;
  const delta = wr - overallWr;
  const wrPct = Math.round(wr * 100);
  if (delta >= TIME_SLOT_DELTA) {
    return {
      id: "slot",
      label: "Time slot",
      verdict: `${slotLabel} is one of your stronger slots — ${wrPct}% WR.`,
      detail: `${slot.games} games at this hour`,
      tone: "positive",
    };
  }
  if (delta <= -TIME_SLOT_DELTA) {
    return {
      id: "slot",
      label: "Time slot",
      verdict: `Off-peak hour for you — ${wrPct}% WR at ${slotLabel}.`,
      detail: `${slot.games} games at this hour`,
      tone: "warning",
    };
  }
  return {
    id: "slot",
    label: "Time slot",
    verdict: `${slotLabel} is on-par — ${wrPct}% WR.`,
    detail: `${slot.games} games at this hour`,
    tone: "neutral",
  };
}

function buildChampionSignal(matches: MatchSummary[], accountSlug: string): RitualSignal {
  const cutoff = Date.now() - SUGGEST_DAYS * 24 * 60 * 60 * 1000;
  const recent = matches.filter(
    (m) => !m.remake && new Date(m.playedAt).getTime() >= cutoff
  );
  if (recent.length === 0) {
    return {
      id: "champ",
      label: "Champion",
      verdict: `No games in the last ${SUGGEST_DAYS} days.`,
      tone: "neutral",
    };
  }
  const counts = new Map<string, { games: number; wins: number }>();
  for (const m of recent) {
    const prev = counts.get(m.champion) ?? { games: 0, wins: 0 };
    counts.set(m.champion, {
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
    });
  }
  const top = [...counts.entries()].sort((a, b) => b[1].games - a[1].games)[0];
  if (!top) {
    return {
      id: "champ",
      label: "Champion",
      verdict: "No champion data yet.",
      tone: "neutral",
    };
  }
  const [name, stat] = top;
  const wr = Math.round((stat.wins / stat.games) * 100);
  return {
    id: "champ",
    label: "Most played",
    verdict: (
      <span className="flex items-center gap-2">
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{ accountSlug, championKey: name.toLowerCase() }}
          className="shrink-0"
        >
          <ChampionSquareIcon
            championName={name}
            alt={name}
            className="size-5 rounded-sm"
          />
        </Link>
        <span>
          {name} — {stat.games}g · {wr}% WR
        </span>
      </span>
    ),
    detail: `Last ${SUGGEST_DAYS} days`,
    tone: wr >= 50 ? "positive" : "neutral",
  };
}

const TONE_DOT: Record<RitualSignal["tone"], string> = {
  neutral: "bg-muted-foreground/30",
  positive: "bg-emerald-500/70",
  warning: "bg-rose-500/70",
};

function SignalTile({ signal, index }: { signal: RitualSignal; index: number }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      layout
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: reduced ? 0 : index * 0.05 }}
      className="flex h-full flex-col gap-1 rounded-lg border bg-card/40 px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${TONE_DOT[signal.tone]}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {signal.label}
        </span>
      </div>
      <div className="text-sm leading-snug text-foreground/90">{signal.verdict}</div>
      {signal.detail && (
        <div className="text-[10px] text-muted-foreground/60">{signal.detail}</div>
      )}
    </m.div>
  );
}

export function ProfilePregameRitual({ accountSlug }: { accountSlug: string }) {
  // Predictions are about your next "serious" game (ranked / draft) — ARAM
  // tilt patterns and ARAM time-of-day don't transfer.
  const { matches } = useSeriousMatches();

  const signals = useMemo(() => {
    if (!matches) return null;
    return [
      buildFormSignal(matches),
      buildTiltSignal(matches),
      buildTimeSlotSignal(matches),
      buildChampionSignal(matches, accountSlug),
    ];
  }, [matches, accountSlug]);

  if (!matches || matches.length === 0 || !signals) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Pre-game</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {signals.map((s, i) => (
          <SignalTile key={s.id} signal={s} index={i} />
        ))}
      </div>
    </section>
  );
}
