import { CrossedSwordsIcon, TwoCoinsIcon } from "@/components/game-icons";
import { cn } from "@/lib/utils";
import { championIconUrl } from "@/lol/_shared/champion-icon";
import { useSplashChampion } from "@/lol/_shared/splash-backdrop";
import { useChampionName } from "@/lol/champions/use-champions";
import { useItems } from "@/lol/matches/use-items";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";
import { type Variants, m, useReducedMotion } from "motion/react";
import type { ComponentType, SVGProps } from "react";

const itemsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemReveal: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 26 },
  },
};

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
  const reduced = useReducedMotion();
  return (
    <m.div
      variants={itemsContainer}
      initial={reduced ? "show" : "hidden"}
      animate="show"
      className="flex gap-0.5"
    >
      {items.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
        <m.div key={i} variants={itemReveal}>
          <ItemSlot id={id} />
        </m.div>
      ))}
    </m.div>
  );
}

function StatBar({
  Icon,
  label,
  value,
  max,
  fillClassName,
  labelClassName,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  max: number;
  fillClassName: string;
  labelClassName: string;
}) {
  const reduced = useReducedMotion();
  const target = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex w-10 items-center gap-1 font-mono text-[10px] uppercase tracking-wider",
          labelClassName
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <div className="relative h-1 w-20 overflow-hidden rounded-full bg-muted/40">
        <m.div
          className={cn("absolute inset-y-0 left-0 w-full rounded-full", fillClassName)}
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: reduced ? target : 0 }}
          animate={{ scaleX: target }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
          }
        />
      </div>
      <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {(value / 1000).toFixed(1)}k
      </span>
    </div>
  );
}

function ParticipantRow({
  p,
  isMe,
  maxDamage,
  maxGold,
}: {
  p: ParticipantDetail;
  isMe?: boolean;
  maxDamage: number;
  maxGold: number;
}) {
  const championName = useChampionName();
  const reduced = useReducedMotion();
  const displayName = championName(p.championName);
  return (
    <m.li
      variants={teamRow}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card/60 p-2 backdrop-blur-sm transition-colors",
        isMe && "relative border-foreground/40 bg-card/80 ring-2 ring-foreground/30"
      )}
    >
      {isMe && !reduced && (
        <m.div
          className="pointer-events-none absolute inset-0 rounded-md"
          animate={{
            boxShadow: [
              "0 0 0 2px rgba(255,255,255,0)",
              "0 0 0 2px rgba(255,255,255,0.2), 0 0 14px 2px rgba(255,255,255,0.06)",
              "0 0 0 2px rgba(255,255,255,0)",
            ],
          }}
          transition={{
            duration: 2.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 0.8,
          }}
        />
      )}
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
      <div className="flex flex-col items-end gap-1.5">
        <ItemSlots items={p.items} />
        <div className="flex flex-col gap-0.5">
          <StatBar
            Icon={CrossedSwordsIcon}
            label="Dmg"
            value={p.totalDamage}
            max={maxDamage}
            fillClassName="bg-gradient-to-r from-red-500/80 to-orange-400/80"
            labelClassName="text-red-400/80"
          />
          <StatBar
            Icon={TwoCoinsIcon}
            label="Gld"
            value={p.goldEarned}
            max={maxGold}
            fillClassName="bg-gradient-to-r from-amber-500/80 to-yellow-300/80"
            labelClassName="text-amber-400/80"
          />
        </div>
      </div>
    </m.li>
  );
}

function TeamBlock({
  title,
  participants,
  myPuuid,
  maxDamage,
  maxGold,
}: {
  title: string;
  participants: ParticipantDetail[];
  myPuuid?: string;
  maxDamage: number;
  maxGold: number;
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
          <ParticipantRow
            key={p.puuid}
            p={p}
            isMe={p.puuid === myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
          />
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
  const reduced = useReducedMotion();
  const blue = detail.participants.filter((p) => p.teamId === 100);
  const red = detail.participants.filter((p) => p.teamId === 200);
  const maxDamage = Math.max(...detail.participants.map((p) => p.totalDamage), 1);
  const maxGold = Math.max(...detail.participants.map((p) => p.goldEarned), 1);

  useSplashChampion(currentChampion);

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <TeamBlock
            title="Blue side"
            participants={blue}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
          />
        </m.div>
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.12 }}
        >
          <TeamBlock
            title="Red side"
            participants={red}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
          />
        </m.div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
