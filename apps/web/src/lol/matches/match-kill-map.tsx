import { ShimmerBlock } from "@/components/shimmer-block";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.24 },
} as const;

const MINIMAP_URL =
  "https://wsrv.nl/?url=raw.communitydragon.org/latest/game/assets/maps/info/map11/2dlevelminimap_npe_1.png&w=512&output=webp";

function formatGameTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function MatchKillMap({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; durationSec: number; participants: ParticipantDetail[] };
  myPuuid?: string;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const reduced = useReducedMotion();

  if (!myPuuid) return null;

  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-20 rounded" />
        <ShimmerBlock className="aspect-square w-full max-w-xs mx-auto rounded-md" />
      </section>
    );
  }
  if (timeline.isError) return null;

  const myParticipantId = timeline.data.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;

  const championByParticipantId = new Map<number, string>();
  for (const tp of timeline.data.participants) {
    const dp = detail.participants.find((p) => p.puuid === tp.puuid);
    if (dp) {
      championByParticipantId.set(tp.participantId, dp.championName);
    }
  }

  const kills = timeline.data.kills.filter((k) => k.position !== null);

  if (kills.length === 0) return null;

  const totalStaggerMs = 600;

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Kill map</h3>
      <div className="relative aspect-square w-full max-w-xs mx-auto overflow-hidden rounded-md border bg-card/60">
        <img
          src={MINIMAP_URL}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 15000 15000"
          role="img"
          aria-label="Kill map"
        >
          {kills.map((kill, i) => {
            // position is guaranteed non-null by the filter above
            const pos = kill.position ?? { x: 0, y: 0 };
            const isMyKill = kill.killerId === myParticipantId;
            const isMyDeath = kill.victimId === myParticipantId;
            const isBlue = kill.killerId <= 5;

            const r = isMyKill ? 200 : 150;
            const fill = isMyDeath ? "white" : isBlue ? "#60a5fa" : "#f87171";
            const fillOpacity = isMyDeath ? 0.5 : isMyKill ? 0.9 : 0.75;
            const delayS = i * (totalStaggerMs / kills.length / 1000);

            const killerName =
              championByParticipantId.get(kill.killerId) ?? `P${kill.killerId}`;
            const victimName =
              championByParticipantId.get(kill.victimId) ?? `P${kill.victimId}`;
            const assistNames = kill.assistIds
              .map((id) => championByParticipantId.get(id) ?? `P${id}`)
              .join(", ");
            const tooltipText = assistNames
              ? `${formatGameTime(kill.ts)} — ${killerName} killed ${victimName} (${assistNames})`
              : `${formatGameTime(kill.ts)} — ${killerName} killed ${victimName}`;

            return (
              <TooltipPrimitive.Root
                // biome-ignore lint/suspicious/noArrayIndexKey: kills are ordered events with no stable id
                key={i}
                delayDuration={100}
              >
                <TooltipPrimitive.Trigger asChild>
                  <m.circle
                    cx={pos.x}
                    cy={15000 - pos.y}
                    r={r}
                    fill={fill}
                    initial={
                      reduced
                        ? { opacity: fillOpacity, scale: 1 }
                        : { opacity: 0, scale: 0 }
                    }
                    animate={{ opacity: fillOpacity, scale: 1 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 400,
                            damping: 20,
                            delay: delayS,
                          }
                    }
                    style={{ cursor: "default" }}
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
        </svg>
      </div>
    </m.section>
  );
}
