import { CountUp } from "@/components/count-up";
import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
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
import { Link, useNavigate } from "@tanstack/react-router";
import { formatPlaytimeFromSeconds } from "@vyoh/shared";
import { type Variants, m, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import type { ChampionSortOption } from "./champion-sort-selector";
import type { ChampionRoleSplit, ChampionStats } from "./champion-stats";
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

// Stacked role icons (sized by share of games) with a rich tooltip showing
// per-lane games + win rate. Single-role pools render as a plain role icon
// with the label-only tooltip we used to render directly on the row.
function RoleBreakdown({ roles }: { roles: ChampionRoleSplit[] }) {
  const dominant = roles[0];
  if (!dominant) return null;
  if (roles.length === 1) {
    return (
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex">
            <RoleIcon
              position={dominant.position}
              title={ROLE_LABEL[dominant.position]}
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
            {ROLE_LABEL[dominant.position]}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    );
  }
  const totalGames = roles.reduce((s, r) => s + r.games, 0);
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span
          className="inline-flex items-center gap-0.5"
          aria-label={`Played in ${roles.length} roles`}
        >
          {roles.map((r) => (
            // Dominant role lands closest to full opacity; supporting roles
            // fade with their share of games so visual hierarchy matches data.
            <span
              key={r.position}
              className="inline-flex"
              style={{ opacity: 0.4 + 0.6 * (r.games / totalGames) }}
            >
              <RoleIcon
                position={r.position}
                title={ROLE_LABEL[r.position]}
                className="size-3.5"
              />
            </span>
          ))}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={cn(TOOLTIP_CONTENT_CLASS, "px-2.5 py-1.5")}
        >
          <ul className="flex flex-col gap-0.5 text-xs">
            {roles.map((r) => (
              <li key={r.position} className="flex items-center gap-2">
                <RoleIcon position={r.position} className="size-3.5 shrink-0" />
                <span className="w-16">{ROLE_LABEL[r.position]}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {r.games} {r.games === 1 ? "game" : "games"}
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    r.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {Math.round(r.winRate * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
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
  const champions = useChampions();
  const sorted = useMemo(() => sortStats(stats, sort), [stats, sort]);
  // Back-nav from the detail page: read the saved list scroll, restore it
  // synchronously, then pin briefly while the hero→row morph plays out.
  // restoredScrollY === 0 ⇒ fresh visit (Trends → Champions, first load),
  // so settle defaults to true and rows render normally with the stagger.
  const { readListScroll, activeChampion } = useActiveChampion();
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
        // One row per champion; multi-role pools surface their breakdown
        // inline (see ChampionTableRow). The detail page is role-agnostic, so
        // duplicating rows per role would link to the same target.
        const info = champions.data?.get(s.champion.toLowerCase());
        const parentClasses = info?.modernClasses ?? [];
        const subclasses = info?.modernSubclasses ?? [];
        const isActiveRow = activeChampion === s.champion;
        const heldDuringSettle = !settled && !isActiveRow;
        return (
          <ChampionTableRow
            key={s.champion}
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
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const alias = s.champion;
  const position = s.position;
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef. Mirrors match-row.
  const savedOrigin = useRef<ChampionOrigin | null>(null);

  // Back-nav: only the row matching the user's last clicked alias consumes
  // the hero's backward rect. Position isn't part of the match because rows
  // are consolidated per champion — the breadcrumb's backward rect is also
  // keyed on the dominant role recorded on click, so list and hero agree.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (
        o?.championAlias?.toLowerCase() !== alias.toLowerCase() ||
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
            saveListScroll();
            setActiveChampion(alias);
            setActivePosition(position);
            if (supportsViewTransitions()) return;
            // Fallback path only: capture origin rect for the rect-morph.
            // VT path handles its own snapshot via `view-transition-name`
            // applied in onClick below.
            const rect = cardRef.current?.getBoundingClientRect() ?? null;
            if (rect)
              setOriginRect({
                championAlias: alias,
                position,
                rect,
                direction: "forward",
              });
          }}
          onClick={(e) => {
            // VT path: apply `view-transition-name` to the card via ref so
            // it is present at OLD-snapshot capture (synchronous with the
            // startViewTransition call), then clear it inside the callback
            // BEFORE awaiting navigation. This prevents the source name
            // from being present at NEW-snapshot capture, which would
            // collide with the destination hero's matching name (the
            // browser keeps the old route mounted alongside the new one
            // during the transition, so both elements briefly coexist).
            if (!supportsViewTransitions()) return;
            if (e.button !== 0) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            const el = cardRef.current;
            if (!el) return;
            e.preventDefault();
            const name = `champion-${alias}-${position}`;
            el.style.viewTransitionName = name;
            const doc = document as Document & {
              startViewTransition?: (cb: () => Promise<void>) => unknown;
            };
            doc.startViewTransition?.(async () => {
              // OLD snapshot captured by now (sync inside startViewTransition).
              // Clear before any await so NEW snapshot doesn't see the source.
              if (cardRef.current) cardRef.current.style.viewTransitionName = "";
              await navigate({
                to: "/lol/$accountSlug/champions/$championKey",
                params: { accountSlug, championKey: alias.toLowerCase() },
              });
            });
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
                <RoleBreakdown roles={s.roles} />
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
