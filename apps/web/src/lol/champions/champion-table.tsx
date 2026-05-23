import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { championClassIconUrl } from "@/lol/_shared/assets/champion-icon";
import { ROLE_LABEL, RoleIcon, type RolePosition } from "@/lol/_shared/assets/role-icon";
import { CardTilt } from "@/lol/_shared/ui/card-tilt";
import { WinRateBar } from "@/lol/_shared/ui/win-rate-bar";
import { useActiveChampion } from "@/lol/champions/active-champion-context";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link } from "@tanstack/react-router";
import { formatPlaytimeFromSeconds } from "@vyoh/shared";
import { type MotionStyle, type Variants, m } from "motion/react";
import { useMemo, useRef } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import type { ChampionSortOption } from "./champion-sort-selector";
import type { ChampionStats } from "./champion-stats";
import { useChampionName, useChampions } from "./use-champions";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function sortStats(stats: ChampionStats[], sort: ChampionSortOption): ChampionStats[] {
  const compare = (a: ChampionStats, b: ChampionStats): number => {
    switch (sort) {
      case "winRate":
        return b.winRate - a.winRate || b.games - a.games;
      case "avgKda":
        return b.avgKda - a.avgKda || b.games - a.games;
      case "playtime":
        return b.totalDurationSec - a.totalDurationSec || b.games - a.games;
      default:
        return b.games - a.games;
    }
  };
  return [...stats].sort(compare);
}

export function ChampionTable({
  stats,
  sort,
  accountSlug,
  onCardHover,
}: {
  stats: ChampionStats[];
  sort: ChampionSortOption;
  accountSlug: string;
  onCardHover?: ((champion: string) => void) | undefined;
}) {
  const championName = useChampionName();
  const champions = useChampions();
  const sorted = useMemo(() => sortStats(stats, sort), [stats, sort]);
  // First occurrence per champion in `stats` (sorted by games desc) is the
  // primary role — that row keeps the shared `champ-card-{champion}` layoutId
  // for the detail-page morph; sibling rows get role-suffixed ids and just
  // fade in via the existing variant.
  const primaryRoleByChampion = useMemo(() => {
    const map = new Map<string, RolePosition>();
    for (const s of stats) {
      if (!map.has(s.champion)) map.set(s.champion, s.position);
    }
    return map;
  }, [stats]);
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {sorted.map((s) => {
        const isPrimary = primaryRoleByChampion.get(s.champion) === s.position;
        const layoutId = isPrimary
          ? `champ-card-${s.champion.toLowerCase()}`
          : `champ-card-${s.champion.toLowerCase()}-${s.position.toLowerCase()}`;
        const info = champions.data?.get(s.champion.toLowerCase());
        const parentClasses = info?.modernClasses ?? [];
        const subclasses = info?.modernSubclasses ?? [];
        return (
          <ChampionTableRow
            key={`${s.champion}-${s.position}`}
            s={s}
            isPrimary={isPrimary}
            layoutId={layoutId}
            parentClasses={parentClasses}
            subclasses={subclasses}
            accountSlug={accountSlug}
            displayName={championName(s.champion)}
            onCardHover={onCardHover}
          />
        );
      })}
    </m.ul>
  );
}

function ChampionTableRow({
  s,
  isPrimary,
  layoutId,
  parentClasses,
  subclasses,
  accountSlug,
  displayName,
  onCardHover,
}: {
  s: ChampionStats;
  isPrimary: boolean;
  layoutId: string;
  parentClasses: string[];
  subclasses: string[];
  accountSlug: string;
  displayName: string;
  onCardHover?: ((champion: string) => void) | undefined;
}) {
  const { setActiveChampion, saveListScroll, setOriginRect } = useActiveChampion();
  const cardRef = useRef<HTMLDivElement>(null);
  const alias = s.champion;
  return (
    <m.li
      variants={item}
      layout
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <CardTilt>
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{ accountSlug, championKey: alias.toLowerCase() }}
          onMouseEnter={() => onCardHover?.(alias)}
          onPointerDown={() => {
            // Origin rect only fires from the primary row — its layoutId
            // (`champ-card-{alias}`) matches the detail-hero, so the
            // explicit rect animation is consistent with Motion's morph.
            // Non-primary rows still seed activeChampion + scroll memory so
            // the return trip lands on the right row.
            saveListScroll();
            if (isPrimary) {
              const rect = cardRef.current?.getBoundingClientRect() ?? null;
              if (rect)
                setOriginRect({ championAlias: alias, rect, direction: "forward" });
            }
            setActiveChampion(alias);
          }}
        >
          <m.div
            ref={cardRef}
            layoutId={layoutId}
            style={championCardStyle(alias) as unknown as MotionStyle}
            className={championCardClassName}
          >
            <ChampionCardChrome champion={alias} />
            <div className="relative ml-auto flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 font-medium">
                <span>{displayName}</span>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <span className="inline-flex">
                      <RoleIcon
                        position={s.position}
                        title={ROLE_LABEL[s.position]}
                        className="size-3.5 opacity-70"
                      />
                    </span>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="top"
                      sideOffset={4}
                      className={TOOLTIP_CONTENT_CLASS}
                    >
                      {ROLE_LABEL[s.position]}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </div>
              {parentClasses.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  {parentClasses.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <img
                        src={championClassIconUrl(c.toLowerCase())}
                        alt=""
                        aria-hidden={true}
                        className="size-3.5 shrink-0"
                        draggable={false}
                      />
                      {c}
                    </span>
                  ))}
                  {subclasses.length > 0 && (
                    <span className="text-muted-foreground/50">
                      ·{" "}
                      {subclasses
                        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(" · ")}
                    </span>
                  )}
                </div>
              )}
              <div className="font-mono text-sm tabular-nums">
                <span
                  className={cn(s.winRate >= 0.5 ? "text-emerald-400" : "text-red-400")}
                >
                  <CountUp to={Math.round(s.winRate * 100)} duration={0.7} />%
                </span>
                <span className="text-muted-foreground"> WR · </span>
                <span className="text-amber-400">
                  <CountUp to={s.avgKda} decimals={2} duration={0.7} />
                </span>
                <span className="text-muted-foreground"> KDA</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {s.games} {s.games === 1 ? "game" : "games"} ·{" "}
                {formatPlaytimeFromSeconds(s.totalDurationSec)}
              </div>
              <WinRateBar winRate={s.winRate} />
            </div>
          </m.div>
        </Link>
      </CardTilt>
    </m.li>
  );
}
