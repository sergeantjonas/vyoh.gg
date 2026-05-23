import { CountUp } from "@/components/count-up";
import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { championClassIconUrl } from "@/lol/_shared/assets/champion-icon";
import { ROLE_LABEL, RoleIcon } from "@/lol/_shared/assets/role-icon";
import { CardTilt } from "@/lol/_shared/ui/card-tilt";
import { WinRateBar } from "@/lol/_shared/ui/win-rate-bar";
import {
  type ChampionOrigin,
  useActiveChampion,
} from "@/lol/champions/active-champion-context";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link } from "@tanstack/react-router";
import { formatPlaytimeFromSeconds } from "@vyoh/shared";
import { type Variants, m, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import type { ChampionSortOption } from "./champion-sort-selector";
import type { ChampionStats } from "./champion-stats";
import { useChampionName, useChampions } from "./use-champions";

// While the back-nav scroll-restore + hero→row morph play out, hold
// non-active rows at a low opacity so the morphing card travels through a
// quiet strip. Mirrors match-list's settle hold.
const SETTLE_HOLD_MS = 800;
const SETTLE_HOLD_OPACITY = 0.6;

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
  // Back-nav from the detail page: read the saved list scroll, restore it
  // synchronously, then pin briefly while the hero→row morph plays out.
  // restoredScrollY === 0 ⇒ fresh visit (Trends → Champions, first load),
  // so settle defaults to true and rows render normally with the stagger.
  const { readListScroll, activeChampion, activePosition } = useActiveChampion();
  const [restoredScrollY] = useState(() => readListScroll());
  const [settled, setSettled] = useState(() => restoredScrollY <= 0);
  const didInitialScrollRef = useRef(false);
  const didPinRef = useRef(false);
  if (!didInitialScrollRef.current && restoredScrollY > 0) {
    didInitialScrollRef.current = true;
    mainScrollRef.current?.scrollTo(0, restoredScrollY);
  }
  useEffect(() => {
    if (settled) return;
    const id = window.setTimeout(() => setSettled(true), SETTLE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [settled]);
  useLayoutEffect(() => {
    // Guard against React 19 `reappearLayoutEffects` re-firing this hook on
    // Activity/Suspense reveal (TanStack Router + AnimatePresence keep the
    // exiting list alive briefly during forward nav, and the replay would
    // re-assert the saved scrollTop *after* useScrollResetOnNav reset it).
    // We only ever want to pin once per component instance, on the back-nav
    // mount that captured restoredScrollY > 0.
    if (didPinRef.current) return;
    const container = mainScrollRef.current;
    if (restoredScrollY <= 0 || !container) return;
    didPinRef.current = true;
    const target = restoredScrollY;
    container.scrollTo(0, target);
    let cancelled = false;
    const pinUntil = performance.now() + 600;
    const pin = () => {
      if (cancelled || performance.now() > pinUntil) return;
      if (Math.abs(container.scrollTop - target) > 1) container.scrollTo(0, target);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
    return () => {
      cancelled = true;
    };
  }, [restoredScrollY]);
  // Skip the entrance stagger on back-nav: the rows are already on screen,
  // and the morphing card is doing the work — re-running stagger would be
  // visual noise.
  const isReturnNav = restoredScrollY > 0;
  const listMotionProps = isReturnNav
    ? { initial: false as const }
    : { initial: "hidden" as const, animate: "show" as const, variants: container };
  return (
    <m.ul {...listMotionProps} className="flex flex-col gap-3">
      {sorted.map((s) => {
        // Every row owns its own morph against the detail hero, keyed by
        // alias + position. A champion played in multiple roles produces
        // multiple rows; whichever one the user clicked is the one that
        // captured the origin rect (forward) and consumes the hero rect on
        // return (backward).
        const info = champions.data?.get(s.champion.toLowerCase());
        const parentClasses = info?.modernClasses ?? [];
        const subclasses = info?.modernSubclasses ?? [];
        const isActiveRow =
          activeChampion === s.champion && activePosition === s.position;
        const heldDuringSettle = !settled && !isActiveRow;
        return (
          <ChampionTableRow
            key={`${s.champion}-${s.position}`}
            s={s}
            parentClasses={parentClasses}
            subclasses={subclasses}
            accountSlug={accountSlug}
            displayName={championName(s.champion)}
            onCardHover={onCardHover}
            heldDuringSettle={heldDuringSettle}
          />
        );
      })}
    </m.ul>
  );
}

function ChampionTableRow({
  s,
  parentClasses,
  subclasses,
  accountSlug,
  displayName,
  onCardHover,
  heldDuringSettle,
}: {
  s: ChampionStats;
  parentClasses: string[];
  subclasses: string[];
  accountSlug: string;
  displayName: string;
  onCardHover?: ((champion: string) => void) | undefined;
  heldDuringSettle: boolean;
}) {
  const {
    setActiveChampion,
    setActivePosition,
    saveListScroll,
    originRectRef,
    setOriginRect,
  } = useActiveChampion();
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const alias = s.champion;
  const position = s.position;
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef. Mirrors match-row.
  const savedOrigin = useRef<ChampionOrigin | null>(null);

  // Back-nav: only the row matching the user's last clicked (alias, position)
  // pair consumes the hero's backward rect — other rows for the same champion
  // (different role) ignore it so two rows don't try to morph from the same
  // hero simultaneously.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (
        o?.championAlias?.toLowerCase() !== alias.toLowerCase() ||
        o.position !== position ||
        o.direction !== "backward"
      )
        return;
      savedOrigin.current = o;
    }
    const origin = savedOrigin.current;
    if (!origin || !cardRef.current) return;
    if (reduced) return;
    const el = cardRef.current;
    el.style.visibility = "hidden";
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      setOriginRect(null);
      el.style.visibility = "";
      const listRect = el.getBoundingClientRect();
      const dx = origin.rect.left - listRect.left;
      const dy = origin.rect.top - listRect.top;
      const sx = origin.rect.width / listRect.width;
      const sy = origin.rect.height / listRect.height;
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      el.style.visibility = "";
    };
  }, []);

  return (
    <m.li
      variants={item}
      animate={{ opacity: heldDuringSettle ? SETTLE_HOLD_OPACITY : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <CardTilt>
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{ accountSlug, championKey: alias.toLowerCase() }}
          onMouseEnter={() => onCardHover?.(alias)}
          onPointerDown={() => {
            // Every row captures its own origin rect — a champion played in
            // multiple roles produces multiple rows, and the row the user
            // actually clicks is the one that should morph into the detail
            // hero (and back out on return).
            saveListScroll();
            const rect = cardRef.current?.getBoundingClientRect() ?? null;
            if (rect)
              setOriginRect({
                championAlias: alias,
                position,
                rect,
                direction: "forward",
              });
            setActiveChampion(alias);
            setActivePosition(position);
          }}
        >
          {/* Plain div, not m.div — Motion's layoutId morph would compete
              with the rect-based el.animate() in useLayoutEffect above and
              produce the "fast / broken" feel. Match-row uses the same plain
              wrapper for the same reason. */}
          <div
            ref={cardRef}
            style={championCardStyle(alias)}
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
          </div>
        </Link>
      </CardTilt>
    </m.li>
  );
}
