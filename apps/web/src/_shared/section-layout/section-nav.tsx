import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { m } from "motion/react";
import type { ComponentType, MouseEvent } from "react";

// Structured descriptor for a section tab. The shell renders these three ways
// depending on viewport (full tab row ≥820px, a filling section dropdown
// 640–819px, an own-row dropdown <640px), so it needs the data — not an opaque
// pre-rendered nav node.
//
// `to`/`params` carry TanStack route targets. They're typed loosely here and
// cast at the single `<Link>` boundary below: sections build descriptors from
// their own typed route consts, so the literals are correct by construction.
// This is the accepted trade-off of the centralized-tabs API — the strict Link
// typing is relaxed in exactly one place rather than forking the strip per
// section. `preserveSearch` re-emits the current search params on navigation
// (LoL keeps `count`/window state; Steam routes carry no search).
export type SectionTab = {
  to: string;
  params?: Record<string, string>;
  preserveSearch?: boolean;
  // Replace the history entry instead of pushing one. Match-detail sub-tabs set
  // this so the whole detail page stays a single back-button entry regardless of
  // which sub-tab is open; section tabs (Profile/Matches/…) omit it and push.
  replace?: boolean;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
  // Optional click hook. Sections that drive a hand-rolled navigation (e.g.
  // LoL's Profile↔tab identity morph) provide this; if the handler calls
  // `e.preventDefault()` the `<Link>` skips its own navigation. Steam tabs omit
  // it and navigate via the plain `<Link>` (router-level VT slide).
  onSelect?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

// Live is a *route*, not a tab — it's a transient special state that reads
// better as a presence chip and gets route-active treatment. It never occupies
// tab-row space or the headroom a future stable tab would need.
export type SectionLiveTab = {
  to: string;
  params?: Record<string, string>;
  preserveSearch?: boolean;
  active: boolean;
};

// `(prev) => prev` re-emits the existing search; typed loosely and cast at the
// Link boundary alongside `to`/`params`.
const identitySearch = (prev: Record<string, unknown>) => prev;
function searchProp(preserve: boolean | undefined): unknown {
  return preserve ? identitySearch : undefined;
}

function SectionTabLink({
  tab,
  indicatorId,
  prefersReducedMotion,
}: {
  tab: SectionTab;
  indicatorId: string;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <Link
      to={tab.to as never}
      params={tab.params as never}
      search={searchProp(tab.preserveSearch) as never}
      replace={tab.replace ?? false}
      onClick={tab.onSelect}
      className={cn(
        "group relative flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
        tab.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <m.span
        key={tab.active ? 1 : 0}
        initial={tab.active && !prefersReducedMotion ? { scale: 0.75, y: -4 } : false}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        className="inline-flex"
      >
        <tab.Icon
          className={cn(
            "size-4 transition-colors",
            tab.active
              ? "text-theme-strong drop-shadow-[0_0_6px_var(--theme-muted)]"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        />
      </m.span>
      {tab.label}
      {tab.active && (
        <m.div
          layoutId={indicatorId}
          // `tab-indicator-pulse` = the slow breathing halo, shared by every
          // active-tab underline; layers over `theme-bar-glint` (white sweep).
          className="tab-indicator-pulse theme-bar-glint absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--theme-color)]"
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 500, damping: 35 }
          }
        />
      )}
    </Link>
  );
}

// Full tab row — only mounts at ≥820px. The active-tab underline morphs between
// tabs via `layoutId` (shared-layout); the id is section-scoped so LoL and
// Steam don't morph into each other.
export function SectionTabRow({
  tabs,
  indicatorId,
  prefersReducedMotion,
}: {
  tabs: SectionTab[];
  indicatorId: string;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <nav aria-label="Section tabs" className="flex items-center gap-1">
      {tabs.map((tab) => (
        <SectionTabLink
          key={tab.to}
          tab={tab}
          indicatorId={indicatorId}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </nav>
  );
}

// Route-aware live chip. Idle = subdued pulsing dot ("you have a live game,
// click to watch"); active = bright filled (you're on /live now, so the tabs /
// dropdown show nothing selected). Reduced motion drops the ping but keeps the
// solid dot (replace, don't disable).
export function SectionLiveChip({
  live,
  prefersReducedMotion,
}: {
  live: SectionLiveTab;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <Link
      to={live.to as never}
      params={live.params as never}
      search={searchProp(live.preserveSearch) as never}
      aria-label="Live game"
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
        live.active
          ? "border-red-400/80 bg-red-500/25 text-red-100 shadow-[0_0_12px_-2px_rgba(248,113,113,0.65)]"
          : "border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/15"
      )}
    >
      <span className="relative flex size-2">
        {!prefersReducedMotion && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400/70" />
        )}
        <span className="relative inline-flex size-2 rounded-full bg-red-400" />
      </span>
      Live
    </Link>
  );
}

// Collapsed section picker for the <820px tiers. A fixed min-width keeps the
// label from ever truncating — the strip drops to the own-row tier before that
// point. Flex behaviour (fill the inline row vs occupy its own row) is supplied
// by `className` from the shell's tier layout. When on /live, no section is
// current, so it reads as a neutral "Sections" picker.
export function SectionTabsDropdown({
  tabs,
  onLive,
  className,
}: {
  tabs: SectionTab[];
  onLive: boolean;
  className?: string;
}) {
  const active = tabs.find((tab) => tab.active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Sections"
          className={cn(
            "flex min-w-[168px] cursor-pointer items-center justify-between gap-2 rounded-lg border bg-card/60 px-4 py-2.5 text-base font-semibold transition-colors hover:bg-muted/40",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {active && !onLive ? (
              <>
                <active.Icon className="size-[18px] shrink-0 text-theme-strong" />
                <span className="truncate">{active.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Sections</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {tabs.map((tab) => (
          <DropdownMenuItem key={tab.to} asChild>
            <Link
              to={tab.to as never}
              params={tab.params as never}
              search={searchProp(tab.preserveSearch) as never}
              replace={tab.replace ?? false}
              onClick={tab.onSelect}
              className="flex cursor-pointer items-center gap-2"
            >
              <tab.Icon
                className={cn(
                  "size-4 shrink-0",
                  tab.active && !onLive ? "text-theme-strong" : "text-muted-foreground"
                )}
              />
              <span className={tab.active && !onLive ? "font-semibold" : undefined}>
                {tab.label}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
