import { ShimmerBlock } from "@/components/shimmer-block";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ItemIcon } from "@/lol/_shared/item-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useItems } from "@/lol/matches/use-items";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  MatchTimelineBuildEvent,
  MatchTimelineProjection,
  ParticipantDetail,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useState } from "react";

const NOISE_CATEGORIES = new Set(["Consumable", "Trinket"]);

function isNoise(categories: string[]): boolean {
  return categories.some((c) => NOISE_CATEGORIES.has(c));
}

function formatGameTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface DisplayEntry {
  itemId: number;
  ts: number;
  type: "PURCHASED" | "SOLD";
}

function resolveDisplayEntries(
  events: MatchTimelineBuildEvent[],
  itemData: Map<number, { categories: string[] }> | undefined,
  showConsumables: boolean
): DisplayEntry[] {
  const result: DisplayEntry[] = [];

  for (const ev of events) {
    if (ev.type === "UNDO") {
      // Remove the most recent matching purchase
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i]?.itemId === ev.itemId && result[i]?.type === "PURCHASED") {
          result.splice(i, 1);
          break;
        }
      }
      continue;
    }

    if (ev.type === "SOLD") {
      // Mark the most recent matching purchase as sold (in-place update)
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i]?.itemId === ev.itemId && result[i]?.type === "PURCHASED") {
          result.splice(i, 1, {
            itemId: ev.itemId,
            ts: result[i]?.ts ?? ev.ts,
            type: "SOLD",
          });
          break;
        }
      }
      continue;
    }

    // PURCHASED
    const item = itemData?.get(ev.itemId);
    if (!showConsumables && item && isNoise(item.categories)) continue;

    result.push({ itemId: ev.itemId, ts: ev.ts, type: "PURCHASED" });
  }

  return result;
}

function BuildItemSlot({
  entry,
  delay,
}: {
  entry: DisplayEntry;
  delay: number;
}) {
  const items = useItems();
  const item = entry.itemId !== 0 ? items.data?.get(entry.itemId) : undefined;
  const reduced = useReducedMotion();

  return (
    <m.div
      initial={reduced ? {} : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 26, delay }
      }
      className="flex flex-col items-center gap-0.5"
    >
      <TooltipPrimitive.Root delayDuration={100}>
        <TooltipPrimitive.Trigger asChild>
          <span
            className={cn(
              "relative inline-block cursor-default",
              entry.type === "SOLD" && "opacity-40"
            )}
          >
            {entry.type === "SOLD" && (
              <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="h-px w-full rotate-45 bg-red-400/80" />
              </span>
            )}
            {item ? (
              <ItemIcon
                iconUrl={item.iconUrl}
                alt={item.name}
                className="size-7 rounded-sm"
              />
            ) : (
              <span className="inline-block size-7 rounded-sm bg-muted/40" />
            )}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={5}
            collisionPadding={8}
            className="pointer-events-none z-50 rounded border bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md"
          >
            <div className="font-medium">{item?.name ?? `Item ${entry.itemId}`}</div>
            <div className="font-mono text-muted-foreground">
              {entry.type === "SOLD" ? "Sold " : ""}
              {formatGameTime(entry.ts)}
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </m.div>
  );
}

function BuildRow({
  participant,
  participantId,
  timeline,
  showConsumables,
  isMe,
  itemData,
}: {
  participant: ParticipantDetail;
  participantId: number;
  timeline: MatchTimelineProjection;
  showConsumables: boolean;
  isMe?: boolean;
  itemData: Map<number, { categories: string[] }> | undefined;
}) {
  const championName = useChampionName();
  const events =
    timeline.buildOrders.find((bo) => bo.participantId === participantId)?.events ?? [];
  const entries = resolveDisplayEntries(events, itemData, showConsumables);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2",
        isMe && "border-foreground/30 bg-card/70"
      )}
    >
      {/* participant label */}
      <div className="flex w-28 shrink-0 items-center gap-2">
        <ChampionSquareIcon
          championName={participant.championName}
          className="size-6 rounded-sm"
        />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">
            {championName(participant.championName)}
          </div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {participant.riotIdGameName}
          </div>
        </div>
      </div>

      {/* items timeline */}
      <div className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-x-auto">
        {entries.length === 0 ? (
          <span className="text-xs text-muted-foreground/50">No items</span>
        ) : (
          entries.map((entry, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list, no reordering
            <BuildItemSlot key={i} entry={entry} delay={i * 0.025} />
          ))
        )}
      </div>
    </div>
  );
}

export function MatchBuildOrder({
  detail,
  myPuuid,
}: {
  detail: { matchId: string; queueType: string; participants: ParticipantDetail[] };
  myPuuid?: string;
}) {
  const timeline = useMatchTimeline(detail.matchId);
  const items = useItems();
  const reduced = useReducedMotion();

  const myParticipant = detail.participants.find((p) => p.puuid === myPuuid);
  const isARAM = !myParticipant?.teamPosition;
  const isRanked = detail.queueType.includes("Ranked");

  const opponent =
    !isARAM && myParticipant
      ? detail.participants.find(
          (p) =>
            p.teamId !== myParticipant.teamId &&
            p.teamPosition === myParticipant.teamPosition
        )
      : undefined;

  const [showConsumables, setShowConsumables] = useState(false);
  const [showOpponent, setShowOpponent] = useState(isRanked && !!opponent);

  if (!myPuuid || !myParticipant) return null;
  if (timeline.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-14 w-full rounded-md" />
      </section>
    );
  }
  if (timeline.isError) return null;

  const myParticipantId = timeline.data.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;
  const opponentParticipantId =
    opponent && showOpponent
      ? timeline.data.participants.find((p) => p.puuid === opponent.puuid)?.participantId
      : undefined;

  if (myParticipantId === undefined) return null;

  return (
    <m.section
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.15 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Build order</h3>
        <div className="flex items-center gap-3">
          {opponent && (
            <button
              type="button"
              onClick={() => setShowOpponent((v) => !v)}
              className={cn(
                "cursor-pointer rounded px-2 py-0.5 font-mono text-xs transition-colors",
                showOpponent
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {showOpponent ? "Hide opponent" : "Show opponent"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowConsumables((v) => !v)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 font-mono text-xs transition-colors",
              showConsumables
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {showConsumables ? "Hide consumables" : "Show consumables"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <BuildRow
          participant={myParticipant}
          participantId={myParticipantId}
          timeline={timeline.data}
          showConsumables={showConsumables}
          isMe
          itemData={items.data}
        />
        {opponent && showOpponent && opponentParticipantId !== undefined && (
          <BuildRow
            participant={opponent}
            participantId={opponentParticipantId}
            timeline={timeline.data}
            showConsumables={showConsumables}
            itemData={items.data}
          />
        )}
      </div>
    </m.section>
  );
}
