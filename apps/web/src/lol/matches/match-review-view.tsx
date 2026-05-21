import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
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
import { type MouseEvent, useMemo, useState } from "react";

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

type AnnotationEvent = {
  tSec: number;
  type: "kill" | "death" | "assist";
  championName: string | undefined;
};

type EventCluster = { tSec: number; events: AnnotationEvent[] };

function clusterEvents(events: AnnotationEvent[], windowSec = 45): EventCluster[] {
  const sorted = [...events].sort((a, b) => a.tSec - b.tSec);
  const clusters: EventCluster[] = [];
  for (const evt of sorted) {
    const last = clusters.at(-1);
    if (last && evt.tSec - last.tSec <= windowSec) {
      last.events.push(evt);
    } else {
      clusters.push({ tSec: evt.tSec, events: [evt] });
    }
  }
  return clusters;
}

function clusterDotFill(events: AnnotationEvent[]): string {
  if (events.some((e) => e.type === "death")) return "#f87171";
  if (events.some((e) => e.type === "kill")) return "#34d399";
  return "#fbbf24";
}

function buildAnnotationEvents(
  timeline: MatchTimelineProjection,
  detail: MatchDetail,
  ownerPuuid: string
): AnnotationEvent[] {
  const ownerTlEntry = timeline.participants.find((p) => p.puuid === ownerPuuid);
  if (!ownerTlEntry) return [];
  const ownerPid = ownerTlEntry.participantId;
  const puuidToChampion = new Map(
    detail.participants.map((p) => [p.puuid, p.championName])
  );
  const pidToChampion = new Map(
    timeline.participants.map((p) => [p.participantId, puuidToChampion.get(p.puuid)])
  );
  return timeline.kills.flatMap((kill): AnnotationEvent[] => {
    const tSec = kill.ts / 1000;
    if (kill.killerId === ownerPid) {
      return [{ tSec, type: "kill", championName: pidToChampion.get(kill.victimId) }];
    }
    if (kill.victimId === ownerPid) {
      return [{ tSec, type: "death", championName: pidToChampion.get(kill.killerId) }];
    }
    if (kill.assistIds.includes(ownerPid)) {
      return [{ tSec, type: "assist", championName: pidToChampion.get(kill.victimId) }];
    }
    return [];
  });
}

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
  if (pos === "JUNGLE")
    return { verdict: "No lane phase — jungle champion.", tone: "neutral" };
  if (pos === "UTILITY")
    return { verdict: "Support — CS isn't the read.", tone: "neutral" };

  const maxCs = challenges?.maxCsAdvantageOnLaneOpponent ?? 0;
  const maxLevel = challenges?.maxLevelLeadLaneOpponent ?? 0;

  if (maxCs >= 25 || maxLevel >= 3) {
    return {
      verdict: `Stomped lane — peaked at +${Math.round(maxCs)} CS over your opponent.`,
      tone: "positive",
    };
  }
  if (maxCs >= 12 || maxLevel >= 2) {
    return {
      verdict: `Won lane — +${Math.round(maxCs)} CS peak advantage.`,
      tone: "positive",
    };
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
  if (midPoints.length < 2)
    return { verdict: "Short game — no mid phase.", tone: "neutral" };

  const first = midPoints.at(0);
  const last = midPoints.at(-1);
  if (!first || !last) return { verdict: "Short game — no mid phase.", tone: "neutral" };
  const trend = last.diff - first.diff;
  const midDeaths = deathTimings.filter((t) => t >= 840 && t <= 1500).length;
  const d = (n: number) => (n === 1 ? "1 death" : `${n} deaths`);

  const aheadAt14 = first.diff > 500;
  const aheadAt25 = last.diff > 500;

  if (aheadAt14 && aheadAt25) {
    if (trend >= 1000)
      return { verdict: "Extended the lead through mid.", tone: "positive" };
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
    return {
      verdict: "Clawed back mid — reversed a deficit before 25.",
      tone: "positive",
    };
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
      if (barons >= 2)
        return { verdict: `Closed with ${barons} Barons — decisive.`, tone: "positive" };
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

type EventTooltip = { cluster: EventCluster; x: number; y: number };

function EventDot({
  cx,
  cy,
  cluster,
  onHover,
}: {
  cx: number;
  cy: number;
  cluster: EventCluster;
  onHover: (e: MouseEvent<SVGCircleElement>, cluster: EventCluster) => void;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={clusterDotFill(cluster.events)}
      aria-hidden
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(e, cluster)}
    />
  );
}

function ChartTooltip({ tooltip }: { tooltip: EventTooltip }) {
  const { cluster, x, y } = tooltip;
  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-2 rounded-lg border border-border/60 bg-popover/90 px-2.5 py-2 shadow-lg backdrop-blur-sm"
      style={{ left: x, top: y, transform: "translate(-50%, -115%)" }}
    >
      {cluster.events.map((event) => {
        const min = Math.floor(event.tSec / 60);
        const sec = Math.floor(event.tSec % 60);
        const timeStr = `${min}:${sec.toString().padStart(2, "0")}`;
        const label =
          event.type === "kill" ? "Kill" : event.type === "death" ? "Death" : "Assist";
        const labelColor =
          event.type === "kill"
            ? "text-emerald-400"
            : event.type === "death"
              ? "text-red-400"
              : "text-amber-400";
        return (
          <div
            key={`${event.type}-${event.tSec}-${event.championName ?? ""}`}
            className="flex items-center gap-2"
          >
            {event.championName && (
              <ChampionSquareIcon
                championName={event.championName}
                className="size-8 rounded-sm"
              />
            )}
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-xs font-semibold", labelColor)}>{label}</span>
              <span className="font-mono text-xs text-muted-foreground">{timeStr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GameArcChart({
  series,
  events,
}: {
  series: GoldPoint[];
  events: AnnotationEvent[];
}) {
  const [tooltip, setTooltip] = useState<EventTooltip | null>(null);

  const handleHover = (e: MouseEvent<SVGCircleElement>, cluster: EventCluster) => {
    const circle = e.currentTarget;
    const container = circle.closest("[data-chart-container]");
    if (!container) return;
    const cr = circle.getBoundingClientRect();
    const pr = container.getBoundingClientRect();
    setTooltip({ cluster, x: cr.left - pr.left + cr.width / 2, y: cr.top - pr.top });
  };

  return (
    <div
      className="relative"
      data-chart-container=""
      onMouseLeave={() => setTooltip(null)}
    >
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
          const yTicks = [-yTickGold, yTickGold].filter((t) => Math.abs(t) <= maxAbs);

          return (
            <svg
              width={width}
              height={CHART_H}
              role="img"
              aria-label="Team gold advantage over time"
            >
              <title>Team gold advantage over time</title>
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
                {/* Event dots */}
                {clusterEvents(events).map((cluster) => (
                  <EventDot
                    key={`cluster-${cluster.tSec}`}
                    cx={xScale(cluster.tSec / 60)}
                    cy={yScale(nearestDiff(series, cluster.tSec / 60))}
                    cluster={cluster}
                    onHover={handleHover}
                  />
                ))}
              </Group>
            </svg>
          );
        }}
      </ParentSize>
      {tooltip && <ChartTooltip tooltip={tooltip} />}
    </div>
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

  const annotationEvents = useMemo((): AnnotationEvent[] => {
    if (!timeline || !myPuuid) return [];
    return buildAnnotationEvents(timeline, detail, myPuuid);
  }, [timeline, detail, myPuuid]);

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
            <GameArcChart series={goldDiffSeries} events={annotationEvents} />
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full bg-emerald-400"
                  aria-hidden
                />
                Kills
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full bg-amber-400"
                  aria-hidden
                />
                Assists
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full bg-red-400"
                  aria-hidden
                />
                Deaths
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed border-border/50">
            <p className="text-sm text-muted-foreground">
              No timeline data for this match.
            </p>
          </div>
        )}
      </section>

      <section aria-label="Phase verdicts">
        <PhaseVerdictStrip verdicts={verdicts} />
      </section>
    </m.div>
  );
}
