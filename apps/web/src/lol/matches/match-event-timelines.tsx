import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  ElderDragonIcon,
  FireDrakeIcon,
  HextechDrakeIcon,
  InhibitorIcon,
  KillsIcon,
  MountainDrakeIcon,
  OceanDrakeIcon,
  RiftHeraldIcon,
  TowerIcon,
  VoidGrubIcon,
} from "@/components/game-icons";
import { ShimmerBlock } from "@/components/shimmer-block";
import { cn } from "@/lib/utils";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  MatchTimelineKill,
  MatchTimelineObjective,
  ParticipantDetail,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useState } from "react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.22 },
} as const;

function formatGameTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function objectiveLabel(type: string): string {
  switch (type) {
    case "DRAGON_FIRE":
      return "Fire Drake";
    case "DRAGON_OCEAN":
      return "Ocean Drake";
    case "DRAGON_MOUNTAIN":
      return "Mountain Drake";
    case "DRAGON_CLOUD":
      return "Cloud Drake";
    case "DRAGON_HEXTECH":
      return "Hextech Drake";
    case "DRAGON_CHEMTECH":
      return "Chemtech Drake";
    case "DRAGON_ELDER":
      return "Elder Dragon";
    case "BARON_NASHOR":
      return "Baron Nashor";
    case "RIFT_HERALD":
      return "Rift Herald";
    case "HORDE":
      return "Void Grubs";
    case "INHIBITOR":
      return "Inhibitor";
    case "TOWER":
      return "Tower";
    default:
      return type.replace(/_/g, " ");
  }
}

const OBJECTIVE_ICONS: Record<string, typeof VoidGrubIcon> = {
  DRAGON_FIRE: FireDrakeIcon,
  DRAGON_OCEAN: OceanDrakeIcon,
  DRAGON_MOUNTAIN: MountainDrakeIcon,
  DRAGON_CLOUD: CloudDrakeIcon,
  DRAGON_HEXTECH: HextechDrakeIcon,
  DRAGON_CHEMTECH: ChemtechDrakeIcon,
  DRAGON_ELDER: ElderDragonIcon,
  BARON_NASHOR: BaronNashorIcon,
  RIFT_HERALD: RiftHeraldIcon,
  HORDE: VoidGrubIcon,
  INHIBITOR: InhibitorIcon,
  TOWER: TowerIcon,
};

function ObjectiveIcon({ type, teamId }: { type: string; teamId: number }) {
  const teamColor = teamId === 100 ? "text-[#0c95ab]" : "text-[#be1d36]";
  const badgeCls =
    teamId === 100
      ? "bg-blue-400/15 text-blue-300 border-blue-400/30"
      : "bg-red-400/15 text-red-300 border-red-400/30";

  const Icon = OBJECTIVE_ICONS[type];
  if (Icon) {
    return (
      <span className="inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-sm">
        <Icon className={cn("w-5 h-5", teamColor)} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "w-6 h-6 flex items-center justify-center rounded-full border font-mono text-[9px] font-bold",
        badgeCls
      )}
    >
      {type.slice(0, 1)}
    </span>
  );
}

type KillWithJitter = MatchTimelineKill & { jitter: number };

function KillStrip({
  kills,
  durationMs,
  myParticipantId,
  championByPid,
}: {
  kills: MatchTimelineKill[];
  durationMs: number;
  myParticipantId?: number;
  championByPid: Map<number, string>;
}) {
  // Jitter kills that fall within 2.5% of game time of the preceding kill,
  // alternating above/below centre so each dot stays individually hoverable.
  const threshold = durationMs * 0.025;
  const jittered: KillWithJitter[] = [];
  for (const kill of kills) {
    const prev = jittered[jittered.length - 1];
    const tooClose = prev !== undefined && kill.ts - prev.ts < threshold;
    const jitter = tooClose ? (prev.jitter > 0 ? -1 : 1) : 0;
    jittered.push({ ...kill, jitter });
  }

  return (
    <div className="relative w-full h-7 overflow-hidden rounded-sm border bg-card/40">
      {jittered.map((kill, i) => {
        const left = `${(kill.ts / durationMs) * 100}%`;
        const top = kill.jitter > 0 ? "30%" : kill.jitter < 0 ? "70%" : "50%";
        const isMe = kill.killerId === myParticipantId;
        const isBlue = kill.killerId <= 5;
        const color = isBlue ? "#60a5fa" : "#f87171";
        const sizeClass = isMe ? "w-3 h-3" : "w-2 h-2";
        const killerName = championByPid.get(kill.killerId) ?? `P${kill.killerId}`;
        const victimName = championByPid.get(kill.victimId) ?? `P${kill.victimId}`;
        const assistNames = kill.assistIds
          .map((id) => championByPid.get(id) ?? `P${id}`)
          .join(", ");
        const tooltipText = assistNames
          ? `${formatGameTime(kill.ts)} — ${killerName} killed ${victimName} (${assistNames})`
          : `${formatGameTime(kill.ts)} — ${killerName} killed ${victimName}`;

        return (
          <TooltipPrimitive.Root
            // biome-ignore lint/suspicious/noArrayIndexKey: ordered events, no stable id
            key={i}
            delayDuration={100}
          >
            <TooltipPrimitive.Trigger asChild>
              <span
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-default ${sizeClass}`}
                style={{ left, top, backgroundColor: color, opacity: isMe ? 1 : 0.75 }}
              />
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={5}
                collisionPadding={8}
                className="pointer-events-none z-50 rounded border bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md"
              >
                {tooltipText}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        );
      })}
    </div>
  );
}

function ObjectiveBar({
  objectives,
  teamId,
  durationMs,
}: {
  objectives: MatchTimelineObjective[];
  teamId: number;
  durationMs: number;
}) {
  const teamObjectives = objectives.filter((o) => o.teamId === teamId);
  const borderClass = teamId === 100 ? "border-blue-400/20" : "border-red-400/20";
  const teamName = teamId === 100 ? "Blue" : "Red";

  return (
    <div
      className={cn(
        "relative w-full h-7 overflow-hidden rounded-sm border bg-card/40",
        borderClass
      )}
    >
      {teamObjectives.map((obj, i) => {
        const left = `${(obj.ts / durationMs) * 100}%`;
        const tooltipText = `${formatGameTime(obj.ts)} — ${objectiveLabel(obj.type)} (${teamName} team)`;
        return (
          <TooltipPrimitive.Root
            // biome-ignore lint/suspicious/noArrayIndexKey: ordered events, no stable id
            key={i}
            delayDuration={100}
          >
            <TooltipPrimitive.Trigger asChild>
              <span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center cursor-default"
                style={{ left }}
              >
                <ObjectiveIcon type={obj.type} teamId={obj.teamId} />
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={5}
                collisionPadding={8}
                className="pointer-events-none z-50 rounded border bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md"
              >
                {tooltipText}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        );
      })}
    </div>
  );
}

export function MatchEventTimelines({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; durationSec: number; participants: ParticipantDetail[] };
  myPuuid?: string;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const reduced = useReducedMotion();
  const [zoom, setZoom] = useState(1);

  if (!myPuuid) return null;

  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-44 rounded" />
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <ShimmerBlock className="h-3 w-10 rounded" />
              <ShimmerBlock className="h-7 flex-1 rounded-sm" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (timeline.isError) return null;

  const durationMs = detail.durationSec * 1000;
  const myParticipantId = timeline.data.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;

  const championByPid = new Map<number, string>();
  for (const tp of timeline.data.participants) {
    const dp = detail.participants.find((p) => p.puuid === tp.puuid);
    if (dp) championByPid.set(tp.participantId, dp.championName);
  }

  const kills = timeline.data.kills;
  const objectives = timeline.data.objectives;
  const totalMins = Math.ceil(detail.durationSec / 60);

  // Tick density scales with zoom so the axis stays readable
  const tickStep = zoom >= 4 ? 1 : zoom >= 2 ? 2 : 5;
  const ticks = Array.from({ length: totalMins + 1 }, (_, i) => i).filter(
    (m) => m <= totalMins && m % tickStep === 0
  );

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Kill & objective timeline</h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z / 2))}
            disabled={zoom === 1}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
          >
            −
          </button>
          <span className="w-7 text-center font-mono text-[10px] text-muted-foreground">
            {zoom}×
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(8, z * 2))}
            disabled={zoom === 8}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {/* Fixed label column — outside scroll container, no background needed */}
        <div className="flex flex-col gap-1.5 w-10 shrink-0">
          <div className="h-3" />
          <div className="h-7 flex items-center justify-center">
            <KillsIcon className="size-4 opacity-60" />
          </div>
          <span className="h-7 flex items-center text-[10px] font-mono uppercase tracking-wider text-blue-400/70">
            Blue
          </span>
          <span className="h-7 flex items-center text-[10px] font-mono uppercase tracking-wider text-red-400/70">
            Red
          </span>
        </div>

        {/* Scrollable timeline content */}
        <div className="overflow-x-auto min-w-0 flex-1">
          <div
            style={{ width: zoom > 1 ? `${zoom * 100}%` : "100%", minWidth: "100%" }}
            className="flex flex-col gap-1.5"
          >
            {/* Time axis */}
            <div className="relative h-3">
              {ticks.map((m) => (
                <span
                  key={m}
                  style={{ left: `${(m / totalMins) * 100}%` }}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground"
                >
                  {m}m
                </span>
              ))}
            </div>

            {/* Kill strip */}
            <KillStrip
              kills={kills}
              durationMs={durationMs}
              myParticipantId={myParticipantId}
              championByPid={championByPid}
            />

            {/* Objective bars — split by team */}
            <ObjectiveBar objectives={objectives} teamId={100} durationMs={durationMs} />
            <ObjectiveBar objectives={objectives} teamId={200} durationMs={durationMs} />
          </div>
        </div>
      </div>
    </m.section>
  );
}
