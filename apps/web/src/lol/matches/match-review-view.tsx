import { cn } from "@/lib/utils";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type {
  MatchDetail,
  MatchSummary,
  MatchTimelineProjection,
  ParticipantOwnerExtras,
  TeamSummary,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

// Summoner's Rift queues — lane-phase review makes sense for these.
const SR_QUEUES = new Set([
  "Ranked Solo",
  "Ranked Flex",
  "Normal Draft",
  "Normal Blind",
  "Swiftplay",
  "Quickplay",
  "Clash",
]);

// --- Data helpers ---

type GoldPoint = { min: number; diff: number };

function buildOwnerTeamPids(
  timelineParticipants: MatchTimelineProjection["participants"],
  detailParticipants: MatchDetail["participants"],
  ownerTeamId: number
): Set<number> {
  const ownerPuuids = new Set(
    detailParticipants.filter((p) => p.teamId === ownerTeamId).map((p) => p.puuid)
  );
  return new Set(
    timelineParticipants
      .filter((p) => ownerPuuids.has(p.puuid))
      .map((p) => p.participantId)
  );
}

function buildGoldDiffSeries(
  timeline: MatchTimelineProjection,
  teamPids: Set<number>
): GoldPoint[] {
  return timeline.frames.map((frame) => {
    let ownerGold = 0;
    let enemyGold = 0;
    for (const [pidStr, data] of Object.entries(frame.perParticipant)) {
      if (teamPids.has(Number(pidStr))) {
        ownerGold += data.gold;
      } else {
        enemyGold += data.gold;
      }
    }
    return { min: frame.ts / 60000, diff: ownerGold - enemyGold };
  });
}

function nearestDiff(series: GoldPoint[], minVal: number): number {
  let best = series[0];
  if (!best) return 0;
  for (const p of series) {
    if (Math.abs(p.min - minVal) < Math.abs(best.min - minVal)) best = p;
  }
  return best.diff;
}

function fmtGoldDiff(gold: number): string {
  const abs = Math.abs(gold);
  const sign = gold >= 0 ? "+" : "−";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${abs}`;
}

// --- Verdict templates ---

type VerdictTone = "positive" | "neutral" | "warning";
type VerdictResult = { verdict: string; tone: VerdictTone };

export function getLaningVerdict(
  summary: MatchSummary,
  challenges: ParticipantOwnerExtras["challenges"] | undefined
): VerdictResult {
  const pos = summary.teamPosition;
  if (pos === "JUNGLE") return { verdict: "No lane phase — jungle champion.", tone: "neutral" };
  if (pos === "UTILITY") return { verdict: "Support — CS isn't the read.", tone: "neutral" };

  const maxCs = challenges?.maxCsAdvantageOnLaneOpponent ?? 0;
  const maxLevel = challenges?.maxLevelLeadLaneOpponent ?? 0;

  if (maxCs >= 25 || maxLevel >= 3) {
    return {
      verdict: `Stomped lane — peaked at +${maxCs} CS over your opponent.`,
      tone: "positive",
    };
  }
  if (maxCs >= 12 || maxLevel >= 2) {
    return { verdict: `Won lane — +${maxCs} CS peak advantage.`, tone: "positive" };
  }
  if (summary.csAt10 >= 62) {
    return { verdict: `Even lane — ${summary.csAt10} CS at 10 min.`, tone: "neutral" };
  }
  return { verdict: `Tough lane — ${summary.csAt10} CS at 10 min.`, tone: "warning" };
}

export function getMidVerdict(
  series: GoldPoint[],
  deathTimings: number[]
): VerdictResult {
  const midPoints = series.filter((p) => p.min >= 14 && p.min <= 25);
  if (midPoints.length < 2) return { verdict: "Short game — no mid phase.", tone: "neutral" };

  const first = midPoints[0]!;
  const last = midPoints[midPoints.length - 1]!;
  const trend = last.diff - first.diff;
  const midDeaths = deathTimings.filter((t) => t >= 840 && t <= 1500).length;
  const d = (n: number) => (n === 1 ? "1 death" : `${n} deaths`);

  const aheadAt14 = first.diff > 500;
  const aheadAt25 = last.diff > 500;

  if (aheadAt14 && aheadAt25) {
    if (trend >= 1000) return { verdict: "Extended the lead through mid.", tone: "positive" };
    return {
      verdict: `Held the lead through mid${midDeaths > 0 ? ` — ${d(midDeaths)}` : ""}.`,
      tone: "positive",
    };
  }
  if (aheadAt14 && !aheadAt25) {
    return {
      verdict: `Lost the lead mid — ${d(midDeaths)} in the 14–25 window.`,
      tone: "warning",
    };
  }
  if (!aheadAt14 && aheadAt25) {
    return { verdict: "Clawed back mid — reversed a deficit before 25.", tone: "positive" };
  }
  if (!aheadAt14 && !aheadAt25) {
    if (trend >= 2000) return { verdict: "Closing the gap in mid.", tone: "positive" };
    return {
      verdict: `Struggled mid${midDeaths > 0 ? ` — ${d(midDeaths)}` : ""}.`,
      tone: "warning",
    };
  }
  return { verdict: "Even mid game.", tone: "neutral" };
}

export function getLateVerdict(
  summary: MatchSummary,
  ownerTeamObjectives: TeamSummary["objectives"] | undefined,
  series: GoldPoint[]
): VerdictResult {
  const latePoints = series.filter((p) => p.min >= 25);
  const aheadAt25 = latePoints.length > 0 && (latePoints[0]?.diff ?? 0) > 500;
  const barons = ownerTeamObjectives?.baron.kills ?? 0;

  if (summary.win) {
    if (aheadAt25) {
      if (barons >= 2) return { verdict: `Closed with ${barons} Barons — decisive.`, tone: "positive" };
      return { verdict: "Led throughout late — closed it.", tone: "positive" };
    }
    return { verdict: "Fought back in late and closed it.", tone: "positive" };
  }
  if (aheadAt25) return { verdict: "Led into late — couldn't close.", tone: "warning" };
  return { verdict: "Got closed out in late.", tone: "warning" };
}

// --- Chart ---

const CHART_H = 148;
const CHART_MARGIN = { top: 10, right: 8, bottom: 22, left: 52 };

function GameArcChart({
  series,
  killTimings,
  deathTimings,
}: {
  series: GoldPoint[];
  killTimings: number[];
  deathTimings: number[];
}) {
  return (
    <ParentSize debounceTime={0}>
      {({ width }) => {
        const innerW = width - CHART_MARGIN.left - CHART_MARGIN.right;
        const innerH = CHART_H - CHART_MARGIN.top - CHART_MARGIN.bottom;
        if (innerW <= 0 || series.length < 2) return null;

        const maxMin = series[series.length - 1]?.min ?? 30;
        const xScale = scaleLinear({ domain: [0, maxMin], range: [0, innerW] });

        const maxAbs = Math.max(...series.map((p) => Math.abs(p.diff)), 1500);
        const yScale = scaleLinear({ domain: [-maxAbs, maxAbs], range: [innerH, 0] });
        const zeroY = yScale(0);

        const xTicks: number[] = [];
        for (let t = 0; t <= maxMin; t += 5) xTicks.push(t);

        const yTickGold = maxAbs >= 10000 ? 5000 : maxAbs >= 4000 ? 2000 : 1000;
        const yTicks = [-yTickGold, yTickGold].filter(
          (t) => Math.abs(t) <= maxAbs
        );

        return (
          <svg
            width={width}
            height={CHART_H}
            aria-label="Team gold advantage over time"
          >
            <Group left={CHART_MARGIN.left} top={CHART_MARGIN.top}>
              {/* Zero line */}
              <line
                x1={0}
                x2={innerW}
                y1={zeroY}
                y2={zeroY}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={1}
              />
              {/* Y-axis labels */}
              {yTicks.map((t) => (
                <text
                  key={t}
                  x={-6}
                  y={yScale(t)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={10}
                  fill="currentColor"
                  fillOpacity={0.45}
                >
                  {fmtGoldDiff(t)}
                </text>
              ))}
              {/* X-axis ticks */}
              {xTicks.map((t) => (
                <g key={t} transform={`translate(${xScale(t)}, ${innerH})`}>
                  <line y1={0} y2={4} stroke="currentColor" strokeOpacity={0.2} />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.45}
                  >
                    {t}m
                  </text>
                </g>
              ))}
              {/* Gold diff line */}
              <LinePath
                data={series}
                x={(d) => xScale(d.min)}
                y={(d) => yScale(d.diff)}
                stroke="#60a5fa"
                strokeWidth={1.5}
                fill="none"
              />
              {/* Kill annotations */}
              {killTimings.map((t, i) => (
                <circle
                  // eslint-disable-next-line react/no-array-index-key
                  key={`k${i}`}
                  cx={xScale(t / 60)}
                  cy={yScale(nearestDiff(series, t / 60))}
                  r={3}
                  fill="#34d399"
                  aria-hidden
                />
              ))}
              {/* Death annotations */}
              {deathTimings.map((t, i) => (
                <circle
                  // eslint-disable-next-line react/no-array-index-key
                  key={`d${i}`}
                  cx={xScale(t / 60)}
                  cy={yScale(nearestDiff(series, t / 60))}
                  r={3}
                  fill="#f87171"
                  aria-hidden
                />
              ))}
            </Group>
          </svg>
        );
      }}
    </ParentSize>
  );
}

// --- Phase verdict strip ---

type PhaseVerdict = { phase: string } & VerdictResult;

function VerdictCard({ phase, verdict, tone }: PhaseVerdict) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3",
        tone === "positive" && "border-emerald-500/20 bg-emerald-500/5",
        tone === "warning" && "border-red-500/20 bg-red-500/5",
        tone === "neutral" && "border-border/50"
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          tone === "positive" && "text-emerald-400",
          tone === "warning" && "text-red-400",
          tone === "neutral" && "text-muted-foreground"
        )}
      >
        {phase}
      </span>
      <p className="text-sm leading-snug text-foreground">{verdict}</p>
    </div>
  );
}

function PhaseVerdictStrip({ verdicts }: { verdicts: PhaseVerdict[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {verdicts.map((v) => (
        <VerdictCard key={v.phase} {...v} />
      ))}
    </div>
  );
}

// --- Main view ---

export function MatchReviewView({
  detail,
  myPuuid,
  summary,
  timeline,
}: {
  detail: MatchDetail;
  myPuuid: string | undefined;
  summary: MatchSummary | undefined;
  timeline: MatchTimelineProjection | undefined;
}) {
  const reduced = useReducedMotion();

  const ownerDetail = myPuuid
    ? detail.participants.find((p) => p.puuid === myPuuid)
    : undefined;
  const ownerTeamId = ownerDetail?.teamId;
  const ownerTeam =
    ownerTeamId !== undefined
      ? detail.teams.find((t) => t.teamId === ownerTeamId)
      : undefined;

  const goldDiffSeries = useMemo((): GoldPoint[] => {
    if (!timeline || ownerTeamId === undefined) return [];
    const teamPids = buildOwnerTeamPids(
      timeline.participants,
      detail.participants,
      ownerTeamId
    );
    return buildGoldDiffSeries(timeline, teamPids);
  }, [timeline, detail.participants, ownerTeamId]);

  const verdicts = useMemo((): PhaseVerdict[] | null => {
    if (!summary) return null;
    const challenges = ownerDetail?.owner?.challenges;
    const laning = getLaningVerdict(summary, challenges);
    const mid =
      goldDiffSeries.length >= 2
        ? getMidVerdict(goldDiffSeries, summary.deathTimings)
        : { verdict: "No timeline data for mid phase.", tone: "neutral" as const };
    const late = getLateVerdict(summary, ownerTeam?.objectives, goldDiffSeries);
    return [
      { phase: "Laning", ...laning },
      { phase: "Mid game", ...mid },
      { phase: "Late game", ...late },
    ];
  }, [summary, ownerDetail, goldDiffSeries, ownerTeam]);

  if (!SR_QUEUES.has(detail.queueType)) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border/50">
        <p className="text-sm text-muted-foreground">
          Review isn't available for {detail.queueType} matches.
        </p>
      </div>
    );
  }

  if (!summary || !verdicts) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border/50">
        <p className="text-sm text-muted-foreground">Match data not available.</p>
      </div>
    );
  }

  return (
    <m.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <section aria-label="Team gold advantage over time">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">Gold lead</span>
          <span className="text-xs text-muted-foreground">your team vs. opponents</span>
        </div>
        {goldDiffSeries.length >= 2 ? (
          <>
            <GameArcChart
              series={goldDiffSeries}
              killTimings={summary.killTimings}
              deathTimings={summary.deathTimings}
            />
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-emerald-400" aria-hidden />
                Your kills
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-red-400" aria-hidden />
                Your deaths
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed border-border/50">
            <p className="text-sm text-muted-foreground">No timeline data for this match.</p>
          </div>
        )}
      </section>

      <section aria-label="Phase verdicts">
        <PhaseVerdictStrip verdicts={verdicts} />
      </section>
    </m.div>
  );
}
