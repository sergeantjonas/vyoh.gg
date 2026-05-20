import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import {
  useSeriousMatches,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { useChampionName } from "@/lol/champions/use-champions";
import { type CompositeRead, buildComposite } from "@/lol/profile/pregame-composite";
import {
  MIN_CALIBRATION_SAMPLE,
  calibrateConfidence,
} from "@/lol/profile/pregame-replay";
import { type RitualSignal, SignalTile } from "@/lol/profile/ritual-tile";
import { computeHourDayStats, computeTiltStats } from "@/lol/profile/use-habits-stats";
import { usePregameCalibration } from "@/lol/profile/use-pregame-calibration";
import { computeStreak } from "@/lol/trends/trend-stats";
import { Link } from "@tanstack/react-router";
import {
  type CalibrationStats,
  type MatchSummary,
  type PregameCalibrationByQueue,
  emptyBySignal,
  excludeRemakes,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const SUGGEST_DAYS = 14;
const TIME_SLOT_DELTA = 0.05;
const MIN_HOUR_SAMPLE = 3;

const EMPTY_CALIBRATION: CalibrationStats = {
  n: 0,
  directionalHits: 0,
  directionalAccuracy: 0,
  meanLpForPositive: null,
  meanLpForNegative: null,
  meanLpForNeutral: null,
  bySignal: emptyBySignal(),
};

// Solo and Flex are independent LP ladders. The active queue (= "what are
// you about to play next?") is always the queueType of the most recent
// serious match — it drives the verdict label and the signal-history
// filter regardless of whether calibration data exists yet. Calibration
// is a separate concern: prefer the active queue's stats; if absent, fall
// back to the largest-sample queue so the headline still surfaces a
// directional read while the active queue accumulates LP snapshots.
function pickActiveCalibration(
  byQueue: PregameCalibrationByQueue,
  activeQueueType: string | null
): CalibrationStats {
  if (activeQueueType && byQueue[activeQueueType]) {
    return byQueue[activeQueueType];
  }
  let best: CalibrationStats | null = null;
  for (const stats of Object.values(byQueue)) {
    if (!best || stats.n > best.n) best = stats;
  }
  return best ?? EMPTY_CALIBRATION;
}

function nowMonFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// All signal builders accept `now` so replayComposite() can recompute signals
// at historical points (LP2 calibration backtest).
export function buildFormSignal(matches: MatchSummary[]): RitualSignal {
  const played = excludeRemakes(matches);
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

export function buildTiltSignal(matches: MatchSummary[]): RitualSignal {
  const played = excludeRemakes(matches);
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

export function buildTimeSlotSignal(
  matches: MatchSummary[],
  now: Date = new Date()
): RitualSignal {
  const played = excludeRemakes(matches);
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

export function buildChampionSignal(
  matches: MatchSummary[],
  accountSlug: string,
  nameFor: (alias: string) => string,
  now: Date = new Date()
): RitualSignal {
  const cutoff = now.getTime() - SUGGEST_DAYS * 24 * 60 * 60 * 1000;
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
            alt={nameFor(name)}
            className="size-5 rounded-sm"
          />
        </Link>
        <span>
          {nameFor(name)} — {stat.games}g · {wr}% WR
        </span>
      </span>
    ),
    detail: `Last ${SUGGEST_DAYS} days`,
    tone: wr >= 50 ? "positive" : "neutral",
  };
}

const VERDICT_TONE: Record<RitualSignal["tone"], string> = {
  neutral: "border-border bg-card/40",
  positive: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-rose-500/40 bg-rose-500/10",
};

function CompositeVerdict({
  composite,
  signals,
  calibration,
  headlineQueueType,
  byQueue,
}: {
  composite: CompositeRead;
  signals: RitualSignal[];
  calibration: CalibrationStats;
  headlineQueueType: string | null;
  byQueue: PregameCalibrationByQueue;
}) {
  const reduced = useReducedMotion();
  const confidence = calibrateConfidence(composite, calibration);
  if (composite.empty) {
    return (
      <m.div
        layout
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-lg border border-dashed bg-card/30 px-3 py-2.5 text-sm text-muted-foreground/80"
      >
        {composite.band}
      </m.div>
    );
  }
  return (
    <m.div
      layout
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${VERDICT_TONE[composite.tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Composite read · next {headlineQueueType ?? "ranked"}
        </div>
        <CompositeDisclosure
          composite={composite}
          signals={signals}
          calibration={calibration}
          confidenceSource={confidence.source}
          headlineQueueType={headlineQueueType}
          byQueue={byQueue}
        />
      </div>
      <div className="text-sm leading-snug text-foreground/90">
        {composite.band}
        {confidence.text && (
          <span className="text-muted-foreground/70"> — {confidence.text}</span>
        )}
      </div>
    </m.div>
  );
}

function CompositeDisclosure({
  composite,
  signals,
  calibration,
  confidenceSource,
  headlineQueueType,
  byQueue,
}: {
  composite: CompositeRead;
  signals: RitualSignal[];
  calibration: CalibrationStats;
  confidenceSource: "calibration" | "heuristic";
  headlineQueueType: string | null;
  byQueue: PregameCalibrationByQueue;
}) {
  // Prefer a contributor aligned with the composite tone so the "dominant"
  // signal reads as evidence for the verdict, not against it.
  const aligned = signals.filter((s) => s.tone === composite.tone);
  const firing =
    aligned.length > 0 ? aligned : signals.filter((s) => s.tone !== "neutral");
  const queueRows = Object.entries(byQueue).sort((a, b) => b[1].n - a[1].n);
  return (
    <details className="group text-[10px]">
      <summary className="cursor-pointer text-muted-foreground/70 hover:text-foreground/90">
        How is this computed?
      </summary>
      <div className="mt-2 flex flex-col gap-1.5 rounded border border-border/60 bg-background/40 p-2 text-muted-foreground/80">
        <div>
          Each signal maps to <span className="text-foreground/80">+1, 0, or −1</span>.
          The LP band is the mean × 20, ± 5.
        </div>
        <ul className="flex flex-col gap-0.5">
          {signals.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="w-14 text-foreground/70">{s.id}</span>
              <span
                className={
                  s.tone === "positive"
                    ? "text-emerald-400/90"
                    : s.tone === "warning"
                      ? "text-rose-400/90"
                      : "text-muted-foreground/60"
                }
              >
                {s.tone === "positive" ? "+1" : s.tone === "warning" ? "−1" : "0"}
              </span>
            </li>
          ))}
        </ul>
        <div>
          {composite.firing} of {signals.length} signals fired ·{" "}
          {firing.length > 0
            ? `dominant: ${firing[0]?.id}`
            : "no signal had a non-neutral read"}
        </div>
        <div>
          {confidenceSource === "calibration"
            ? `Headline confidence is calibrated from your last ${calibration.n} ${headlineQueueType ?? "ranked"} games (directional hits ${calibration.directionalHits}/${calibration.n}).`
            : `Confidence is heuristic until enough ranked games accrue for a backtest (best queue has ${calibration.n}, need 30).`}
        </div>
        {queueRows.length > 0 && (
          <ul className="flex flex-col gap-0.5 border-t border-border/40 pt-1">
            {queueRows.map(([queueType, stats]) => (
              <li key={queueType} className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">{queueType}</span>
                <span className="text-muted-foreground/60">
                  {stats.n >= MIN_CALIBRATION_SAMPLE
                    ? `${Math.round(stats.directionalAccuracy * 100)}% directional · n=${stats.n}`
                    : `n=${stats.n} (need ${MIN_CALIBRATION_SAMPLE})`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function ProfilePregameRitual({ accountSlug }: { accountSlug: string }) {
  // Predictions are about your next "serious" game (ranked / draft) — ARAM
  // tilt patterns and ARAM time-of-day don't transfer.
  const { matches } = useSeriousMatches();
  const nameFor = useChampionName();
  const account = useAccountFromSlug(accountSlug);
  const { ids: seriousQueueIds } = useSeriousQueues();
  const queueIdsArr = useMemo(() => [...seriousQueueIds], [seriousQueueIds]);
  const calibrationQuery = usePregameCalibration(account, queueIdsArr);

  // LP2 calibration backtest — server-side replay over the full ranked
  // history, reported per-queue (Solo vs Flex are independent LP ladders).
  // While the query is pending, fall through to an empty record so
  // calibrateConfidence() shows LP1's heuristic string rather than the tile
  // flickering out.
  const byQueue: PregameCalibrationByQueue = calibrationQuery.data ?? {};

  // Active queue = "what are you about to play next?", read from the most
  // recent serious match's queueType. The signals and the headline label
  // both scope to this queue so a Solo prediction never carries Flex form
  // or tilt. Calibration may not exist yet for this queue (LP snapshots
  // can lag), so it's looked up separately and falls back gracefully.
  const activeQueueType = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const ordered = [...matches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    return ordered[0]?.queueType ?? null;
  }, [matches]);
  const activeCalibration = pickActiveCalibration(byQueue, activeQueueType);

  const queueScopedMatches = useMemo(() => {
    if (!matches) return null;
    if (!activeQueueType) return matches;
    return matches.filter((m) => m.queueType === activeQueueType);
  }, [matches, activeQueueType]);

  const signals = useMemo(() => {
    if (!queueScopedMatches) return null;
    return [
      buildFormSignal(queueScopedMatches),
      buildTiltSignal(queueScopedMatches),
      buildTimeSlotSignal(queueScopedMatches),
      buildChampionSignal(queueScopedMatches, accountSlug, nameFor),
    ];
  }, [queueScopedMatches, accountSlug, nameFor]);

  const composite = useMemo(
    () => (signals ? buildComposite(signals, activeCalibration) : null),
    [signals, activeCalibration]
  );

  if (!matches || matches.length === 0 || !signals || !composite) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Pre-game</h3>
      <CompositeVerdict
        composite={composite}
        signals={signals}
        calibration={activeCalibration}
        headlineQueueType={activeQueueType}
        byQueue={byQueue}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {signals.map((s, i) => (
          <SignalTile key={s.id} signal={s} index={i} />
        ))}
      </div>
    </section>
  );
}
