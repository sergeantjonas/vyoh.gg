import { championIconUrl } from "@/lib/champion-icon";
import { itemIconUrl } from "@/lib/item-icon";
import { cn } from "@/lib/utils";
import { useSplashChampion } from "@/lol/splash-backdrop";
import { useChampionName } from "@/lol/use-champions";
import { useItems } from "@/lol/use-items";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";
import { AnimatePresence, type Variants, m } from "motion/react";
import { useState } from "react";

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
  const url = itemIconUrl(id);
  const [hovered, setHovered] = useState(false);

  if (!url) {
    return <div className="size-5 rounded-sm bg-muted/40" />;
  }

  const item = items.data?.get(id);
  const name = item?.name ?? `Item ${id}`;
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt={name} className="size-5 rounded-sm bg-muted" loading="lazy" />
      <AnimatePresence>
        {hovered && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full right-0 z-50 mb-1.5 w-max max-w-72 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <img
                src={url}
                alt=""
                aria-hidden="true"
                className="size-10 shrink-0 rounded-md bg-muted"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="text-sm font-semibold leading-tight">{name}</div>
                {item?.priceTotal ? (
                  <div className="font-mono text-xs text-amber-400">
                    {item.priceTotal}g
                  </div>
                ) : null}
              </div>
            </div>
            {item?.description && (
              <div
                className="item-tooltip-body mt-2 text-xs leading-relaxed text-muted-foreground"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Riot item data from CDragon
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
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
  );
}
