import {
  ROLE_DAMAGE_SHARE,
  ROLE_LABEL,
  ROLE_VISION_SCORE,
  isRole,
} from "@/lol/_shared/analytics/role-baselines";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import { useChampionName } from "@/lol/champions/use-champions";
import { type RitualSignal, SignalTile } from "@/lol/profile/ritual-tile";
import { computeTiltStats } from "@/lol/profile/use-habits-stats";
import { useNewMatchNotice } from "@/lol/profile/use-new-match-notice";
import { Link } from "@tanstack/react-router";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const TILT_DELTA = 0.05;
const BASELINE_MIN_REL = 0.15;
const KDA_MIN_REL = 0.2;
const CHAMP_MIN_SAMPLE = 3;
// Below 1.5k team gold diff at 15 we read the game as "even"; above 5k it's
// a stomp, with a dedicated phrasing.
const GAME_SHAPE_EVEN_GOLD = 1500;
const GAME_SHAPE_STOMP_GOLD = 5000;

interface PostGameInput {
  last: MatchSummary;
  history: MatchSummary[];
  accountSlug: string;
  nameFor: (alias: string) => string;
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
    Math.max(1, excludeRemakes(history).length);
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
  nameFor,
}: PostGameInput): RitualSignal {
  const same = history.filter((m) => !m.remake && m.champion === last.champion);
  const others = same.filter((m) => m.matchId !== last.matchId);
  const displayName = nameFor(last.champion);
  const iconLink = (
    <Link
      to="/lol/$accountSlug/champions/$championKey"
      params={{ accountSlug, championKey: last.champion.toLowerCase() }}
      className="shrink-0"
    >
      <ChampionSquareIcon
        championName={last.champion}
        alt={displayName}
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
          <span>First reads on {displayName} — not enough history yet.</span>
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
    verdict = `${matchKda.toFixed(1)} KDA on ${displayName} — above your ${avgKda.toFixed(1)} average.`;
    tone = "positive";
  } else if (rel <= -KDA_MIN_REL) {
    verdict = `${matchKda.toFixed(1)} KDA on ${displayName} — below your ${avgKda.toFixed(1)} average.`;
    tone = "warning";
  } else {
    verdict = `${matchKda.toFixed(1)} KDA on ${displayName} — matches your average.`;
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
    detail: `${others.length + 1} games on ${displayName} in window`,
    tone,
  };
}

function formatKGold(absGold: number): string {
  return `${(absGold / 1000).toFixed(1)}k`;
}

/**
 * Lane-phase / comeback read off `teamGoldDiffAt15`. Returns null when the
 * timeline hasn't been projected yet (historical rows pre-Phase B backfill)
 * so the v1 set falls through unchanged.
 */
function buildGameShapeSignal({ last }: PostGameInput): RitualSignal | null {
  if (last.csAt15 === 0 && last.goldAt15 === 0) return null;
  const diff = last.teamGoldDiffAt15;
  const abs = Math.abs(diff);
  const ahead = diff > 0;

  if (abs < GAME_SHAPE_EVEN_GOLD) {
    return {
      id: "shape",
      label: "Game shape",
      verdict: last.win
        ? "Even at 15 — pulled it out late."
        : "Even at 15 — couldn't pull ahead.",
      detail: `${formatKGold(abs)} gold ${ahead ? "ahead" : "behind"} at 15`,
      tone: "neutral",
    };
  }

  const kgold = formatKGold(abs);
  const isStomp = abs >= GAME_SHAPE_STOMP_GOLD;

  if (last.win && ahead) {
    return {
      id: "shape",
      label: "Game shape",
      verdict: isStomp
        ? `Stomped early — up ${kgold} at 15 and closed.`
        : `Led ${kgold} at 15 — converted.`,
      tone: "positive",
    };
  }
  if (last.win && !ahead) {
    return {
      id: "shape",
      label: "Game shape",
      verdict: isStomp
        ? `Down ${kgold} at 15 — hard comeback.`
        : `Down ${kgold} at 15 — comeback win.`,
      tone: "positive",
    };
  }
  if (!last.win && ahead) {
    return {
      id: "shape",
      label: "Game shape",
      verdict: `Up ${kgold} at 15 — let it slip.`,
      tone: "warning",
    };
  }
  return {
    id: "shape",
    label: "Game shape",
    verdict: isStomp ? `Hard-stomped — down ${kgold} at 15.` : `Down ${kgold} at 15.`,
    tone: "warning",
  };
}

export function ProfilePostGame({ accountSlug }: { accountSlug: string }) {
  // Pair with Pregame Ritual: same data source (ranked/draft only) so the two
  // surfaces read as a matched set. ARAM games won't trigger a post-game read.
  const { matches } = useSeriousMatches();
  const reduced = useReducedMotion();
  const nameFor = useChampionName();

  const computed = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const ordered = [...matches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    const last = ordered.find((m) => !m.remake);
    if (!last) return null;
    const input: PostGameInput = { last, history: matches, accountSlug, nameFor };
    // Game-shape replaces the champion read when timeline data is present:
    // the lane-phase narrative is a stronger headline than KDA-vs-average,
    // and the grid stays at 4 tiles. Historical rows without a projected
    // timeline fall back to the v1 set unchanged.
    const gameShape = buildGameShapeSignal(input);
    const trailing: RitualSignal = gameShape ?? buildChampionReadSignal(input);
    return {
      last,
      signals: [
        buildOutcomeSignal(input),
        trailing,
        buildBaselineSignal(input),
        buildTiltForecastSignal(input),
      ],
    };
  }, [matches, accountSlug, nameFor]);

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
