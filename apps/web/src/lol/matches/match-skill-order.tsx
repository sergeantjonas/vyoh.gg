import { ShimmerBlock } from "@/components/shimmer-block";
import type { SpellInfo } from "@/lol/matches/use-champion-spells";
import { useChampionSpells } from "@/lol/matches/use-champion-spells";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useState } from "react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.26 },
} as const;

const SKILL_COLORS = [
  "bg-violet-500/70",
  "bg-sky-500/70",
  "bg-amber-500/70",
  "bg-rose-500/70",
] as const;

const SKILL_TEXT_COLORS = [
  "text-violet-400",
  "text-sky-400",
  "text-amber-400",
  "text-rose-400",
] as const;

const SKILL_LABELS = ["Q", "W", "E", "R"] as const;

function skillName(slot: number): string {
  return SKILL_LABELS[slot - 1] ?? `${slot}`;
}

function Cell({
  filled,
  skillIdx,
  level,
  ts,
}: {
  filled: boolean;
  skillIdx: number;
  level: number;
  ts?: number | undefined;
}) {
  const cell = (
    <span
      className={`block h-5 rounded-sm cursor-default ${
        filled ? SKILL_COLORS[skillIdx] : "bg-muted/20"
      }`}
    />
  );

  if (!filled) return cell;

  return (
    <TooltipPrimitive.Root delayDuration={100}>
      <TooltipPrimitive.Trigger asChild>{cell}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={5}
          collisionPadding={8}
          className="pointer-events-none z-50 rounded border bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md"
        >
          Level {level} — {skillName(skillIdx + 1)}
          {ts !== undefined && (
            <span className="ml-1.5 font-mono text-muted-foreground">
              {Math.floor(ts / 60000)}:
              {String(Math.floor((ts % 60000) / 1000)).padStart(2, "0")}
            </span>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function SpellRowLabel({
  label,
  spell,
  colorClass,
}: {
  label: string;
  spell?: SpellInfo | undefined;
  colorClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (spell && !failed) {
    return (
      <TooltipPrimitive.Root delayDuration={100}>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-block w-5 h-5 shrink-0 cursor-default">
            <img
              src={spell.iconUrl}
              alt={label}
              className="w-full h-full object-cover rounded-sm"
              onError={() => setFailed(true)}
            />
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="left"
            sideOffset={5}
            collisionPadding={8}
            className="pointer-events-none z-50 rounded border bg-popover/90 px-2 py-1.5 text-xs text-popover-foreground shadow-md backdrop-blur-md max-w-[200px]"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{spell.name}</span>
              <span className="text-[10px] leading-snug text-muted-foreground">
                {spell.description.length > 180
                  ? `${spell.description.slice(0, 180).trimEnd()}…`
                  : spell.description}
              </span>
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    );
  }

  return (
    <span
      className={`w-5 h-5 flex items-center justify-center text-xs font-mono shrink-0 ${colorClass}`}
    >
      {label}
    </span>
  );
}

export function MatchSkillOrder({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const reduced = useReducedMotion();

  const myParticipant = detail.participants.find((p) => p.puuid === myPuuid);
  const spellIcons = useChampionSpells(myParticipant?.championName ?? "");

  if (!myPuuid) return null;

  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-24 w-full rounded-md" />
      </section>
    );
  }
  if (timeline.isError) return null;

  const myParticipantId = timeline.data.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;

  if (myParticipantId === undefined) return null;

  const slots =
    timeline.data.skillOrders.find((so) => so.participantId === myParticipantId)?.slots ??
    [];

  if (slots.length === 0) return null;

  // Always render at least 18 columns so unplayed levels show as empty cells.
  // Extends beyond 18 automatically if the champion exceeded level cap.
  const displayLevelCount = Math.max(slots.length, 18);

  const gridRowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `20px repeat(${displayLevelCount}, minmax(16px, 1fr))`,
    gap: "0 6px",
    alignItems: "center",
  };

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Skill order</h3>
      <div className="overflow-x-auto">
        {/* Level header */}
        <div style={gridRowStyle} className="mb-1">
          <span />
          {Array.from({ length: displayLevelCount }, (_, colIdx) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length level columns
              key={colIdx}
              className="text-center font-mono text-[9px] text-muted-foreground"
            >
              {(colIdx + 1) % 3 === 1 ? colIdx + 1 : ""}
            </span>
          ))}
        </div>
        {/* Skill rows */}
        <div className="flex flex-col gap-1">
          {SKILL_LABELS.map((label, rowIdx) => (
            <div key={label} style={gridRowStyle}>
              <SpellRowLabel
                label={label}
                spell={spellIcons?.[rowIdx]}
                colorClass={SKILL_TEXT_COLORS[rowIdx] ?? ""}
              />
              {Array.from({ length: displayLevelCount }, (_, colIdx) => {
                const slotAtLevel = slots[colIdx];
                const filled = slotAtLevel?.slot === rowIdx + 1;
                return (
                  <Cell
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length level columns
                    key={colIdx}
                    filled={filled}
                    skillIdx={rowIdx}
                    level={colIdx + 1}
                    ts={filled ? slotAtLevel?.ts : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </m.section>
  );
}
