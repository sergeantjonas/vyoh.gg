import { championIconUrl } from "@/lib/champion-icon";
import { cn } from "@/lib/utils";
import { useSplashChampion } from "@/lol/splash-backdrop";
import { useChampionName } from "@/lol/use-champions";
import { useItems } from "@/lol/use-items";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const teamContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const teamRow: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function ItemSlot({ id }: { id: number }) {
  const items = useItems();
  const item = id !== 0 ? items.data?.get(id) : undefined;

  if (!item) {
    return <div className="size-5 rounded-sm bg-muted/40" />;
  }

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <img
          src={item.iconUrl}
          alt={item.name}
          className="size-5 rounded-sm bg-muted"
          loading="lazy"
        />
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="pointer-events-none z-50 w-max max-w-72 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-start gap-3">
            <img
              src={item.iconUrl}
              alt=""
              aria-hidden="true"
              className="size-10 shrink-0 rounded-md bg-muted"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-sm font-semibold leading-tight">{item.name}</div>
              {item.priceTotal ? (
                <div className="font-mono text-xs text-amber-400">{item.priceTotal}g</div>
              ) : null}
            </div>
          </div>
          {item.description && (
            <div
              className="item-tooltip-body mt-2 text-xs leading-relaxed text-muted-foreground"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Riot item data from CDragon
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function ItemSlots({ items }: { items: number[] }) {
  return (
    <div className="flex gap-0.5">
      {items.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
        <ItemSlot key={i} id={id} />
      ))}
    </div>
  );
}

function ParticipantRow({
  p,
  isMe,
}: {
  p: ParticipantDetail;
  isMe?: boolean;
}) {
  const championName = useChampionName();
  const displayName = championName(p.championName);
  return (
    <m.li
      variants={teamRow}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card/60 p-2 backdrop-blur-sm transition-colors",
        isMe && "border-foreground/40 bg-card/80 ring-2 ring-foreground/30"
      )}
    >
      <img
        src={championIconUrl(p.championName)}
        alt={displayName}
        loading="lazy"
        className="size-9 rounded-md"
      />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{displayName}</div>
        <div className="font-mono text-xs tabular-nums">
          <span className="text-emerald-400">{p.kills}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-red-400">{p.deaths}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-amber-400">{p.assists}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <ItemSlots items={p.items} />
        <div className="font-mono text-xs text-muted-foreground">
          {Math.round(p.goldEarned / 1000)}k g · {Math.round(p.totalDamage / 1000)}k dmg
        </div>
      </div>
    </m.li>
  );
}

function TeamBlock({
  title,
  participants,
  myPuuid,
}: {
  title: string;
  participants: ParticipantDetail[];
  myPuuid?: string;
}) {
  const win = participants[0]?.win ?? false;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-medium">
        <span>{title}</span>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            win ? "text-emerald-400" : "text-red-400"
          )}
        >
          {win ? "Win" : "Loss"}
        </span>
      </h3>
      <m.ul
        initial="hidden"
        animate="show"
        variants={teamContainer}
        className="flex flex-col gap-1"
      >
        {participants.map((p) => (
          <ParticipantRow key={p.puuid} p={p} isMe={p.puuid === myPuuid} />
        ))}
      </m.ul>
    </section>
  );
}

export function MatchDetailView({
  detail,
  currentChampion,
  myPuuid,
}: {
  detail: MatchDetail;
  currentChampion?: string;
  myPuuid?: string;
}) {
  const blue = detail.participants.filter((p) => p.teamId === 100);
  const red = detail.participants.filter((p) => p.teamId === 200);
  const playedAt = new Date(detail.playedAt);
  const championName = useChampionName();

  useSplashChampion(currentChampion);

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          {currentChampion && (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {championName(currentChampion)}
            </span>
          )}
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-semibold">{detail.queueType}</h2>
            <span className="text-sm text-muted-foreground">
              {formatDuration(detail.durationSec)} ·{" "}
              {playedAt.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TeamBlock title="Blue side" participants={blue} myPuuid={myPuuid} />
          <TeamBlock title="Red side" participants={red} myPuuid={myPuuid} />
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
