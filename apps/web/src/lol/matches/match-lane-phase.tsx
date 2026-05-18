import { ShimmerBlock } from "@/components/shimmer-block";
import { cn } from "@/lib/utils";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import { formatGold } from "@vyoh/shared";
import type { MatchTimelineFrame, ParticipantDetail } from "@vyoh/shared";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.28 },
} as const;

const LANE_WINDOW_MINS = 20;

interface LanePoint {
  minute: number;
  goldDiff: number;
  myGold: number;
  oppGold: number;
  myCs: number;
  oppCs: number;
  csDiff: number;
}

function buildLaneData(
  frames: MatchTimelineFrame[],
  myPid: number,
  oppPid: number,
  durationSec: number
): LanePoint[] {
  const maxMs = Math.min(LANE_WINDOW_MINS * 60_000, durationSec * 1000);
  return frames
    .filter((f) => f.ts <= maxMs)
    .map((f) => {
      const mine = f.perParticipant[myPid];
      const opp = f.perParticipant[oppPid];
      const myGold = mine?.gold ?? 0;
      const oppGold = opp?.gold ?? 0;
      const myCs = mine?.cs ?? 0;
      const oppCs = opp?.cs ?? 0;
      return {
        minute: Math.round(f.ts / 60_000),
        myGold,
        oppGold,
        goldDiff: myGold - oppGold,
        myCs,
        oppCs,
        csDiff: myCs - oppCs,
      };
    });
}

function LaneTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: LanePoint }>;
  label?: number;
}) {
  const reduced = useReducedMotion();
  const pt = payload?.[0]?.payload;
  return (
    <AnimatePresence>
      {active && pt ? (
        <m.div
          key="lane-tooltip"
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-1.5 font-mono text-muted-foreground">{label}m</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Gold lead</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  pt.goldDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {pt.goldDiff >= 0 ? "+" : ""}
                {formatGold(pt.goldDiff)}
              </span>
            </div>
            <div className="flex justify-between gap-6 font-mono text-[10px] text-muted-foreground/70">
              <span>You {formatGold(pt.myGold)}</span>
              <span>Opp {formatGold(pt.oppGold)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-6 border-t pt-1">
              <span className="text-muted-foreground">CS lead</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  pt.csDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {pt.csDiff >= 0 ? "+" : ""}
                {pt.csDiff}
              </span>
            </div>
            <div className="flex justify-between gap-6 font-mono text-[10px] text-muted-foreground/70">
              <span>You {pt.myCs}</span>
              <span>Opp {pt.oppCs}</span>
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MatchLanePhase({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; durationSec: number; participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const reduced = useReducedMotion();

  if (!myPuuid) return null;

  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-40 w-full rounded-md" />
      </section>
    );
  }
  if (timeline.isError) return null;

  if (detail.durationSec < 10 * 60) return null;

  const myParticipant = detail.participants.find((p) => p.puuid === myPuuid);
  if (!myParticipant) return null;

  const isARAM = !myParticipant.teamPosition;
  if (isARAM) return null;

  const myParticipantId = timeline.data.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;
  if (myParticipantId === undefined) return null;

  const opponent = detail.participants.find(
    (p) =>
      p.teamId !== myParticipant.teamId && p.teamPosition === myParticipant.teamPosition
  );
  if (!opponent) return null;

  const opponentParticipantId = timeline.data.participants.find(
    (p) => p.puuid === opponent.puuid
  )?.participantId;
  if (opponentParticipantId === undefined) return null;

  const data = buildLaneData(
    timeline.data.frames,
    myParticipantId,
    opponentParticipantId,
    detail.durationSec
  );
  if (data.length === 0) return null;

  const maxAbsGold = Math.max(...data.map((d) => Math.abs(d.goldDiff)), 500);

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Lane phase</h3>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="50%" stopColor="#34d399" stopOpacity={0.2} />
                <stop offset="50%" stopColor="#fb7185" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="lpStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="50%" stopColor="#34d399" stopOpacity={1} />
                <stop offset="50%" stopColor="#fb7185" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              tickFormatter={(v: number) => `${v}m`}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[-maxAbsGold, maxAbsGold]}
              tickFormatter={(v: number) =>
                v === 0
                  ? "0"
                  : v > 0
                    ? `+${(v / 1000).toFixed(1)}k`
                    : `${(v / 1000).toFixed(1)}k`
              }
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              width={40}
              tickCount={5}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              y={0}
              stroke="var(--foreground)"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
            <Tooltip
              content={<LaneTooltip />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="goldDiff"
              fill="url(#lpFill)"
              stroke="url(#lpStroke)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 3,
                fill: "var(--foreground)",
                fillOpacity: 0.6,
                strokeWidth: 0,
              }}
              animationDuration={reduced ? 0 : 1200}
              animationBegin={reduced ? 0 : 150}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </m.section>
  );
}
