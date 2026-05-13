import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import {
  ROLE_DAMAGE_SHARE,
  ROLE_LABEL,
  ROLE_VISION_SCORE,
  isRole,
} from "@/lol/_shared/role-baselines";
import { useSeriousMatches } from "@/lol/_shared/serious-queues";
import { type RitualSignal, SignalTile } from "@/lol/profile/ritual-tile";
import { computeTiltStats } from "@/lol/profile/use-habits-stats";
import { useNewMatchNotice } from "@/lol/profile/use-new-match-notice";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const TILT_DELTA = 0.05;
const BASELINE_MIN_REL = 0.15;
const KDA_MIN_REL = 0.2;
const CHAMP_MIN_SAMPLE = 3;

interface PostGameInput {
  last: MatchSummary;
  history: MatchSummary[];
  accountSlug: string;
}

function kdaOf(m: MatchSummary): number {
  return (m.kills + m.assists) / Math.max(1, m.deaths);
}

function buildOutcomeSignal({ last, history }: PostGameInput): RitualSignal {
  // Sort full history desc, find current streak ending at `last`. We want
  // the count of consecutive same-outcome games up to and including `last`.
  const ordered = [...history].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  let streak = 0;
  for (const m of ordered) {
    if (m.win === last.win) streak += 1;
    else break;
  }
  // Look at the match just before the streak for "broke a streak" framing.
  const beforeStreak = ordered[streak];
  const word = last.win ? "Win" : "Loss";
  let verdict: string;
  if (streak >= 3) {
    verdict = `${word} — ${streak}-game ${last.win ? "win" : "loss"} streak now.`;
  } else if (streak === 2) {
    verdict = `${word} — back-to-back ${last.win ? "wins" : "losses"}.`;
  } else if (beforeStreak) {
    let priorRun = 0;
    for (let i = streak; i < ordered.length; i++) {
      if (ordered[i]?.win === beforeStreak.win) priorRun += 1;
      else break;
    }
    if (priorRun >= 2) {
      verdict = `${word} — broke a ${priorRun}-game ${beforeStreak.win ? "win" : "loss"} run.`;
    } else {
      verdict = last.win ? "Win — back on the scoreboard." : "Loss — first one back.";
    }
  } else {
    verdict = last.win ? "Win." : "Loss.";
  }
  return {
    id: "outcome",
    label: "Last game",
    verdict,
    tone: last.win ? "positive" : "warning",
  };
}

function buildBaselineSignal({ last }: PostGameInput): RitualSignal {
  if (!isRole(last.teamPosition)) {
    return {
      id: "baseline",
      label: "Performance",
      verdict: "No role baseline for this queue.",
      tone: "neutral",
    };
  }
  const role = last.teamPosition;
  const dmgBase = ROLE_DAMAGE_SHARE[role];
  const visionBase = ROLE_VISION_SCORE[role];
  const dmgDelta = (last.damageShare - dmgBase) / dmgBase;
  const visionDelta = (last.visionScore - visionBase) / visionBase;

  // Pick the metric with the largest absolute relative delta — that's the
  // most surprising read on the game.
  type Pick = {
    key: "damage" | "vision";
    delta: number;
    pct: number;
    actualPct?: number;
  };
  const candidates: Pick[] = [
    {
      key: "damage",
      delta: dmgDelta,
      pct: Math.round(dmgDelta * 100),
      actualPct: Math.round(last.damageShare * 100),
    },
    { key: "vision", delta: visionDelta, pct: Math.round(visionDelta * 100) },
  ];
  candidates.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = candidates[0];
  if (!top || Math.abs(top.delta) < BASELINE_MIN_REL) {
    return {
      id: "baseline",
      label: "Performance",
      verdict: `On-par with the typical ${ROLE_LABEL[role].toLowerCase()} read.`,
      tone: "neutral",
    };
  }
  const sign = top.delta >= 0 ? "+" : "";
  const direction = top.delta >= 0 ? "above" : "below";
  const tone: RitualSignal["tone"] = top.delta >= 0 ? "positive" : "warning";
  let verdict: string;
  if (top.key === "damage") {
    verdict = `Damage share ${sign}${top.pct}% ${direction} the ${ROLE_LABEL[role].toLowerCase()} norm.`;
  } else {
    verdict = `Vision ${sign}${top.pct}% ${direction} the ${ROLE_LABEL[role].toLowerCase()} norm.`;
  }
  return {
    id: "baseline",
    label: "Performance",
    verdict,
    detail:
      top.key === "damage" && top.actualPct !== undefined
        ? `${top.actualPct}% of team damage`
        : top.key === "vision"
          ? `${last.visionScore} vision score`
          : undefined,
    tone,
  };
}

function buildTiltForecastSignal({ last, history }: PostGameInput): RitualSignal {
  if (history.length < 8) {
    return {
      id: "tilt",
      label: "Next game",
      verdict: "Need more games to read tilt patterns.",
      tone: "neutral",
    };
  }
  const tilt = computeTiltStats(history);
  const bucket = last.win ? tilt.afterWin : tilt.afterLoss;
  if (bucket.games < 3) {
    return {
      id: "tilt",
      label: "Next game",
      verdict: `Not enough data after a ${last.win ? "win" : "loss"} yet.`,
      tone: "neutral",
    };
  }
  const overallWr =
    history.filter((m) => !m.remake && m.win).length /
    Math.max(1, history.filter((m) => !m.remake).length);
  const wr = bucket.wins / bucket.games;
  const pct = Math.round(wr * 100);
  const delta = wr - overallWr;
  let tone: RitualSignal["tone"] = "neutral";
  let verdict: string;
  if (delta >= TILT_DELTA) {
    tone = "positive";
    verdict = `You historically win ${pct}% after a ${last.win ? "win" : "loss"} — ride it.`;
  } else if (delta <= -TILT_DELTA) {
    tone = "warning";
    verdict = `You only win ${pct}% after a ${last.win ? "win" : "loss"} — consider stepping away.`;
  } else {
    verdict = `${pct}% historical WR after a ${last.win ? "win" : "loss"}.`;
  }
  return {
    id: "tilt",
    label: "Next game",
    verdict,
    detail: `${bucket.games} games tracked`,
    tone,
  };
}

function buildChampionReadSignal({
  last,
  history,
  accountSlug,
}: PostGameInput): RitualSignal {
  const same = history.filter((m) => !m.remake && m.champion === last.champion);
  const others = same.filter((m) => m.matchId !== last.matchId);
  const iconLink = (
    <Link
      to="/lol/$accountSlug/champions/$championKey"
      params={{ accountSlug, championKey: last.champion.toLowerCase() }}
      className="shrink-0"
    >
      <ChampionSquareIcon
        championName={last.champion}
        alt={last.champion}
        className="size-5 rounded-sm"
      />
    </Link>
  );
  if (others.length < CHAMP_MIN_SAMPLE) {
    return {
      id: "champ",
      label: "Champion read",
      verdict: (
        <span className="flex items-center gap-2">
          {iconLink}
          <span>First reads on {last.champion} — not enough history yet.</span>
        </span>
      ),
      detail: `${others.length} prior game${others.length === 1 ? "" : "s"}`,
      tone: "neutral",
    };
  }
  const avgKda = others.reduce((s, m) => s + kdaOf(m), 0) / others.length;
  const matchKda = kdaOf(last);
  const rel = (matchKda - avgKda) / Math.max(0.1, avgKda);
  let verdict: string;
  let tone: RitualSignal["tone"];
  if (rel >= KDA_MIN_REL) {
    verdict = `${matchKda.toFixed(1)} KDA on ${last.champion} — above your ${avgKda.toFixed(1)} average.`;
    tone = "positive";
  } else if (rel <= -KDA_MIN_REL) {
    verdict = `${matchKda.toFixed(1)} KDA on ${last.champion} — below your ${avgKda.toFixed(1)} average.`;
    tone = "warning";
  } else {
    verdict = `${matchKda.toFixed(1)} KDA on ${last.champion} — matches your average.`;
    tone = "neutral";
  }
  return {
    id: "champ",
    label: "Champion read",
    verdict: (
      <span className="flex items-center gap-2">
        {iconLink}
        <span>{verdict}</span>
      </span>
    ),
    detail: `${others.length + 1} games on ${last.champion} in window`,
    tone,
  };
}

export function ProfilePostGame({ accountSlug }: { accountSlug: string }) {
  // Pair with Pregame Ritual: same data source (ranked/draft only) so the two
  // surfaces read as a matched set. ARAM games won't trigger a post-game read.
  const { matches } = useSeriousMatches();
  const reduced = useReducedMotion();

  const computed = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const ordered = [...matches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    const last = ordered.find((m) => !m.remake);
    if (!last) return null;
    const input: PostGameInput = { last, history: matches, accountSlug };
    return {
      last,
      signals: [
        buildOutcomeSignal(input),
        buildBaselineSignal(input),
        buildTiltForecastSignal(input),
        buildChampionReadSignal(input),
      ],
    };
  }, [matches, accountSlug]);

  const isFresh = useNewMatchNotice(computed?.last.matchId);

  if (!computed) return null;

  // Win/loss-tinted pulse: emerald for wins, rose for losses. The transparent
  // start/end frames let the existing border/background show through outside
  // the pulse window.
  const pulseColor = computed.last.win
    ? ["rgba(52,211,153,0)", "rgba(52,211,153,0.55)", "rgba(52,211,153,0)"]
    : ["rgba(244,63,94,0)", "rgba(244,63,94,0.55)", "rgba(244,63,94,0)"];

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Post-game</h3>
      <m.div
        className="relative grid grid-cols-1 gap-2 rounded-lg sm:grid-cols-2 lg:grid-cols-4"
        animate={
          isFresh && !reduced
            ? { scale: [1, 1.005, 1], boxShadow: pulseColor.map((c) => `0 0 0 2px ${c}`) }
            : { scale: 1, boxShadow: "0 0 0 2px rgba(0,0,0,0)" }
        }
        transition={{ duration: isFresh ? 6 : 0.3, ease: "easeOut" }}
      >
        {computed.signals.map((s, i) => (
          <SignalTile key={s.id} signal={s} index={i} />
        ))}
      </m.div>
    </section>
  );
}
