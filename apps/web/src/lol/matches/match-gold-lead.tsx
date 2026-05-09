import { ShimmerBlock } from "@/components/shimmer-block";
import { cn } from "@/lib/utils";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import type { MatchTimelineProjection, ParticipantDetail } from "@vyoh/shared";
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

const BLUE_IDS = [1, 2, 3, 4, 5] as const;
const RED_IDS = [6, 7, 8, 9, 10] as const;

interface GoldPoint {
  minute: number;
  myGold: number;
  theirGold: number;
  lead: number;
}

function buildChartData(
  timeline: MatchTimelineProjection,
  myTeamId: number
): GoldPoint[] {
  return timeline.frames.map((frame) => {
    const blue = BLUE_IDS.reduce(
      (sum, id) => sum + (frame.perParticipant[id]?.gold ?? 0),
      0
    );
    const red = RED_IDS.reduce(
      (sum, id) => sum + (frame.perParticipant[id]?.gold ?? 0),
      0
    );
    const myGold = myTeamId === 100 ? blue : red;
    const theirGold = myTeamId === 100 ? red : blue;
    return {
      minute: Math.round(frame.ts / 60_000),
      myGold,
      theirGold,
      lead: myGold - theirGold,
    };
  });
}

function detectFlips(data: GoldPoint[]): number[] {
  const flips: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (
      prev !== undefined &&
      curr !== undefined &&
      prev.lead !== 0 &&
      Math.sign(curr.lead) !== Math.sign(prev.lead)
    ) {
      flips.push(curr.minute);
    }
  }
  return flips;
}

function formatGold(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : `${g}g`;
}

function formatLead(lead: number): string {
  const abs = Math.abs(lead);
  const prefix = lead >= 0 ? "+" : "−";
  return `${prefix}${formatGold(abs)}`;
}

function GoldLeadTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: GoldPoint }>;
  label?: number;
}) {
  const reduced = useReducedMotion();
  const pt = payload?.[0]?.payload;
  return (
    <AnimatePresence>
      {active && pt ? (
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-1 font-mono text-muted-foreground">{label}m</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Your team</span>
              <span className="font-mono font-medium text-emerald-400">
                {formatGold(pt.myGold)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Enemy</span>
              <span className="font-mono font-medium text-rose-400">
                {formatGold(pt.theirGold)}
              </span>
            </div>
            <div
              className={cn(
                "mt-0.5 border-t pt-0.5 font-mono font-semibold",
                pt.lead >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {formatLead(pt.lead)}
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MatchGoldLead({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; participants: ParticipantDetail[] };
  myPuuid?: string;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const reduced = useReducedMotion();

  if (!myPuuid) return null;
  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-20 rounded" />
        <ShimmerBlock className="h-40 w-full rounded-md" />
      </section>
    );
  }
  if (timeline.isError) return null;

  const myTeamId = detail.participants.find((p) => p.puuid === myPuuid)?.teamId ?? 100;
  const data = buildChartData(timeline.data, myTeamId);
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.lead)), 1000);
  const flips = detectFlips(data);

  return (
    <m.section
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.2 }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Gold lead</h3>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="glFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="50%" stopColor="#34d399" stopOpacity={0.2} />
                <stop offset="50%" stopColor="#fb7185" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="glStroke" x1="0" y1="0" x2="0" y2="1">
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
              domain={[-maxAbs, maxAbs]}
              tickFormatter={(v: number) =>
                v === 0
                  ? "0"
                  : v > 0
                    ? `+${(v / 1000).toFixed(0)}k`
                    : `${(v / 1000).toFixed(0)}k`
              }
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              width={38}
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
            {flips.map((min) => (
              <ReferenceLine
                key={min}
                x={min}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.25}
                strokeDasharray="3 4"
              />
            ))}
            <Tooltip
              content={<GoldLeadTooltip />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="lead"
              fill="url(#glFill)"
              stroke="url(#glStroke)"
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
