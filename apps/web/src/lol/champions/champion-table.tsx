import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, RoleIcon, type RolePosition } from "@/lol/_shared/assets/role-icon";
import { CardTilt } from "@/lol/_shared/ui/card-tilt";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link } from "@tanstack/react-router";
import { type MotionStyle, type Variants, m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import type { ChampionSortOption } from "./champion-sort-selector";
import type { ChampionStats } from "./champion-stats";
import { useChampionName } from "./use-champions";

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

function formatPlaytime(sec: number): string {
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

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
  const reduced = useReducedMotion();
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
        return (
          <m.li
            key={`${s.champion}-${s.position}`}
            variants={item}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <CardTilt>
              <Link
                to="/lol/$accountSlug/champions/$championKey"
                params={{ accountSlug, championKey: s.champion.toLowerCase() }}
                onMouseEnter={() => onCardHover?.(s.champion)}
              >
                <m.div
                  layoutId={layoutId}
                  style={championCardStyle(s.champion) as unknown as MotionStyle}
                  className={championCardClassName}
                >
                  <ChampionCardChrome champion={s.champion} />
                  <div className="relative ml-auto flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{championName(s.champion)}</span>
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
                    <div className="font-mono text-sm tabular-nums">
                      <span
                        className={cn(
                          s.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"
                        )}
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
                      {formatPlaytime(s.totalDurationSec)}
                    </div>
                    <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-muted/30">
                      <m.div
                        className={cn(
                          "absolute inset-y-0 left-0 h-full w-full rounded-full",
                          s.winRate >= 0.5
                            ? "bg-gradient-to-r from-emerald-500/70 to-emerald-400/90"
                            : "bg-gradient-to-r from-red-500/70 to-red-400/90"
                        )}
                        style={{ transformOrigin: "left" }}
                        initial={{ scaleX: reduced ? s.winRate : 0 }}
                        animate={{ scaleX: s.winRate }}
                        transition={{
                          type: "spring",
                          stiffness: 220,
                          damping: 28,
                          delay: 0.1,
                        }}
                      />
                    </div>
                  </div>
                </m.div>
              </Link>
            </CardTilt>
          </m.li>
        );
      })}
    </m.ul>
  );
}
