import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  FireDrakeIcon,
  HextechDrakeIcon,
  InhibitorIcon,
  MountainDrakeIcon,
  OceanDrakeIcon,
  RiftHeraldIcon,
  TowerIcon,
} from "@/components/game-icons";
import { cn } from "@/lib/utils";
import type { MatchTimelineProjection, TeamSummary } from "@vyoh/shared";
import type { ComponentType } from "react";

function ObjectivePip({
  Icon,
  count,
  iconClassName,
}: {
  Icon: ComponentType<{ className?: string }>;
  count: number;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-mono text-[10px] tabular-nums",
        count === 0 ? "opacity-25" : ""
      )}
    >
      <Icon className={cn("size-3", iconClassName)} />
      <span>{count}</span>
    </span>
  );
}

export function TeamObjectiveStrip({
  objectives,
}: { objectives: TeamSummary["objectives"] }) {
  return (
    <div className="flex items-center gap-2.5">
      <ObjectivePip
        Icon={TowerIcon}
        count={objectives.tower.kills}
        iconClassName="text-amber-400/80"
      />
      <ObjectivePip
        Icon={InhibitorIcon}
        count={objectives.inhibitor.kills}
        iconClassName="text-violet-400/80"
      />
      <ObjectivePip
        Icon={FireDrakeIcon}
        count={objectives.dragon.kills}
        iconClassName="text-emerald-400/80"
      />
      <ObjectivePip
        Icon={RiftHeraldIcon}
        count={objectives.riftHerald.kills}
        iconClassName="text-purple-400/80"
      />
      <ObjectivePip
        Icon={BaronNashorIcon}
        count={objectives.baron.kills}
        iconClassName="text-purple-300/80"
      />
    </div>
  );
}

// Soul drake = whichever team's 4th non-Elder dragon kill arrives first in the
// timeline. Element comes from that drake's type. Elder is excluded since it
// only spawns after a soul has already been claimed.
const SOUL_LABEL: Record<string, string> = {
  DRAGON_FIRE: "Infernal Soul",
  DRAGON_OCEAN: "Ocean Soul",
  DRAGON_MOUNTAIN: "Mountain Soul",
  DRAGON_CLOUD: "Cloud Soul",
  DRAGON_HEXTECH: "Hextech Soul",
  DRAGON_CHEMTECH: "Chemtech Soul",
};

const SOUL_COLORS: Record<string, { bg: string; text: string }> = {
  DRAGON_FIRE: { bg: "bg-orange-500/15", text: "text-orange-400" },
  DRAGON_OCEAN: { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  DRAGON_MOUNTAIN: { bg: "bg-stone-500/20", text: "text-stone-300" },
  DRAGON_CLOUD: { bg: "bg-slate-400/15", text: "text-slate-200" },
  DRAGON_HEXTECH: { bg: "bg-violet-500/15", text: "text-violet-300" },
  DRAGON_CHEMTECH: { bg: "bg-emerald-500/15", text: "text-emerald-300" },
};

const SOUL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  DRAGON_FIRE: FireDrakeIcon,
  DRAGON_OCEAN: OceanDrakeIcon,
  DRAGON_MOUNTAIN: MountainDrakeIcon,
  DRAGON_CLOUD: CloudDrakeIcon,
  DRAGON_HEXTECH: HextechDrakeIcon,
  DRAGON_CHEMTECH: ChemtechDrakeIcon,
};

export function computeSoul(
  timeline: MatchTimelineProjection | undefined
): { teamId: number; type: string } | null {
  if (!timeline) return null;
  const dragons = timeline.objectives
    .filter((o) => o.type.startsWith("DRAGON_") && o.type !== "DRAGON_ELDER")
    .sort((a, b) => a.ts - b.ts);
  const counts = new Map<number, number>();
  for (const d of dragons) {
    const c = (counts.get(d.teamId) ?? 0) + 1;
    counts.set(d.teamId, c);
    if (c >= 4) return { teamId: d.teamId, type: d.type };
  }
  return null;
}

export function SoulChip({ type }: { type: string }) {
  const Icon = SOUL_ICON[type];
  const colors = SOUL_COLORS[type];
  const label = SOUL_LABEL[type];
  if (!Icon || !colors || !label) return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        colors.bg,
        colors.text
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
