import type { SectionTab } from "@/_shared/section-layout/section-nav";
import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { NotFound } from "@/components/not-found";
import { routeMeta } from "@/lib/route-meta";
import { useScrollResetOnNav } from "@/lib/use-scroll-reset-on-nav";
import { cn } from "@/lib/utils";
import { SteamPreferences } from "@/steam/_shared/steam-preferences";
import { NewPurchasePrompt } from "@/steam/curation/new-purchase-prompt";
import { ActiveGameProvider, useActiveGame } from "@/steam/library/active-game-context";
import { SteamProfileBackdrop } from "@/steam/profile-backdrop";
import {
  STEAM_IDENTITY_AVATAR_MORPH_ID,
  STEAM_IDENTITY_NAME_MORPH_ID,
} from "@/steam/profile/identity-layout";
import { runSteamIdentityMorphNav } from "@/steam/profile/identity-morph-nav";
import { STEAM_TAB_SEGMENTS, type SteamTabSegment, isSteamTabActive } from "@/steam/tabs";
import { useSafariSlideDirection } from "@/steam/use-safari-slide-direction";
import { useSteamSummary } from "@/steam/use-steam-summary";
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  CalendarClock,
  Fingerprint,
  LayoutDashboard,
  Library,
  ListChecks,
  type LucideIcon,
  Trophy,
} from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useCallback, useEffect } from "react";

export const Route = createFileRoute("/steam")({
  component: SteamLayout,
  notFoundComponent: NotFound,
  head: () =>
    routeMeta({
      title: "Steam · vyoh.gg",
      description: "Steam library, achievements, and wishlist on vyoh.gg.",
    }),
});

// Keyed by segment and `satisfies Record<SteamTabSegment, …>`, so a segment
// added to STEAM_TAB_SEGMENTS without chrome here is a type error rather than
// a tab the router knows about and the strip never renders.
const TAB_CHROME = {
  "": { to: "/steam", label: "Profile", Icon: LayoutDashboard, exact: true },
  portrait: { to: "/steam/portrait", label: "Portrait", Icon: Fingerprint, exact: false },
  library: { to: "/steam/library", label: "Library", Icon: Library, exact: false },
  wishlist: { to: "/steam/wishlist", label: "Wishlist", Icon: ListChecks, exact: false },
  upcoming: {
    to: "/steam/upcoming",
    label: "Upcoming",
    Icon: CalendarClock,
    exact: false,
  },
  achievements: {
    to: "/steam/achievements",
    label: "Achievements",
    Icon: Trophy,
    exact: false,
  },
} as const satisfies Record<
  SteamTabSegment,
  { to: string; label: string; Icon: LucideIcon; exact: boolean }
>;

const TABS = STEAM_TAB_SEGMENTS.map((segment) => TAB_CHROME[segment]);

function SteamLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Safari/iOS bypasses router VT for intra-Steam navs (see
  // navigation-type.ts) because WebKit's VT snapshot capture is
  // expensive on Steam-shaped DOM. Without VT the destination would
  // appear instantly with no animation — `useSafariSlideDirection`
  // computes the would-be slide direction so a cheap CSS animation
  // can stand in. Returns null on Chrome/Firefox, on cross-section
  // navs, and on first mount.
  const safariSlideDir = useSafariSlideDirection(pathname);
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  useScrollResetOnNav(pathname, [
    // Panel-aware: both directions (list↔panel + panel↔panel sub-nav) skip
    // the top-reset because the list stays mounted under the panel. Mirrors
    // the LoL matches and champions skip-pairs.
    { listPath: "/steam/library", detailPrefix: "/steam/library/" },
  ]);

  const inLibrarySubtree =
    pathname === "/steam/library" || pathname.startsWith("/steam/library/");

  // Publish the section header's bottom y as `--account-header-h` so the
  // detail-panel `SlidePanel` can dock under it (otherwise the panel covers
  // the section tab strip). Same pattern as LoL's `$accountSlug.tsx`.
  const onHeaderRect = useCallback((rect: DOMRect) => {
    document.documentElement.style.setProperty("--account-header-h", `${rect.bottom}px`);
  }, []);

  const steamTabs: SectionTab[] = TABS.map((tab) => ({
    to: tab.to,
    label: tab.label,
    Icon: tab.Icon,
    active: isSteamTabActive(tab, pathname),
    // Profile↔tab navigations morph the avatar + persona name between the
    // hero and the strip (M2b). The driver hand-rolls its own view transition
    // and reports whether it took over; if so we suppress the Link's plain
    // navigation. Modified clicks and reduced-motion fall through to the
    // router slide (and Safari falls through inside the driver via isWebKit).
    onSelect: (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (prefersReducedMotion) return;
      const tookOver = runSteamIdentityMorphNav({
        fromPathname: pathname,
        toPathname: tab.to,
        toIsProfileIndex: tab.to === "/steam",
        navigate: () => navigate({ to: tab.to, viewTransition: false } as never),
      });
      if (tookOver) e.preventDefault();
    },
  }));

  return (
    <ActiveGameProvider>
      <GameListReturnReset inSubtree={inLibrarySubtree} />
      <SteamProfileBackdrop>
        <SectionShell
          identity={<SteamIdentity />}
          // Reset the scroll-driven compact state on every nav (see the
          // SectionShell prop comment for the full why).
          pathname={pathname}
          // The Steam Profile is the only tab that mounts the cinematic hero
          // that owns identity at scroll-top — the strip's identity slot
          // resolves to null there until the user scrolls. Same role as LoL's
          // `isProfileIndex` flag.
          heroOwnsIdentity={pathname === "/steam" || pathname === "/steam/"}
          tabs={steamTabs}
          tabIndicatorId="steam-tab-indicator"
          actions={<SteamPreferences />}
          onHeaderRect={onHeaderRect}
        >
          {/* Above the outlet rather than on one tab: the owner may land
              anywhere in the section, and a question they only get asked on
              `/steam` exactly is a question they can walk past. Renders null
              for everyone else, and for the owner whenever nothing is
              quarantined — which is almost always. */}
          <NewPurchasePrompt />

          {safariSlideDir ? (
            // `key` forces a fresh DOM element per pathname so the CSS
            // animation re-fires on every Safari intra-Steam nav. The
            // Outlet inside would unmount/remount anyway on a route
            // change (TanStack swaps the matched component), so the
            // wrapper recreation adds one extra div replacement, no
            // additional component churn.
            <div
              key={pathname}
              className={
                safariSlideDir === "left"
                  ? "safari-slide-in-from-right"
                  : "safari-slide-in-from-left"
              }
            >
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </SectionShell>
      </SteamProfileBackdrop>
    </ActiveGameProvider>
  );
}

function GameListReturnReset({ inSubtree }: { inSubtree: boolean }) {
  const { clearListScroll, setActiveGame, setOriginRect } = useActiveGame();
  useEffect(() => {
    if (inSubtree) return;
    clearListScroll();
    setActiveGame(null);
    setOriginRect(null);
  }, [inSubtree, clearListScroll, setActiveGame, setOriginRect]);
  return null;
}

function SteamIdentity() {
  const { compact } = useSectionShellState();
  const prefersReducedMotion = useReducedMotion();
  const { data: summary } = useSteamSummary();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isProfileIndex = pathname === "/steam" || pathname === "/steam/";

  // On the Profile landing the cinematic hero owns the identity until the page
  // scrolls; the strip stays empty so we don't double-render avatar + persona
  // name. Once `compact` flips, the strip mounts the identity and the shared
  // `layoutId` morphs it up from the hero. On every other tab there's no hero,
  // so the strip renders unconditionally.
  if (isProfileIndex && !compact) return null;
  // Attach the shared ids only when a hero exists to morph with (Profile tab)
  // and motion is allowed; otherwise the strip renders as a plain header. The
  // `data-identity-{avatar,name}` markers are unconditional: the strip only
  // renders when it's the visible identity owner, so tagging it always keeps
  // exactly one avatar/name pair marked in the DOM for any future cross-nav
  // identity morph.
  const morph = isProfileIndex && !prefersReducedMotion;
  const avatarLayoutId = morph ? STEAM_IDENTITY_AVATAR_MORPH_ID : undefined;
  const nameLayoutId = morph ? STEAM_IDENTITY_NAME_MORPH_ID : undefined;

  return (
    <section className="flex items-center gap-3">
      {summary ? (
        <m.img
          {...(avatarLayoutId ? { layoutId: avatarLayoutId } : {})}
          data-identity-avatar=""
          src={
            summary.animatedAvatarUrl && !prefersReducedMotion
              ? summary.animatedAvatarUrl
              : summary.avatarUrl
          }
          alt=""
          className={cn(
            "rounded-full object-cover ring-1 ring-border transition-[width,height]",
            compact ? "size-10" : "size-12"
          )}
        />
      ) : (
        <div
          className={cn(
            "animate-pulse rounded-full bg-muted ring-1 ring-border transition-all",
            compact ? "size-10" : "size-12"
          )}
        />
      )}
      {summary ? (
        <m.span
          {...(nameLayoutId ? { layoutId: nameLayoutId } : {})}
          data-identity-name=""
          className="text-xl font-semibold"
        >
          {summary.personaName}
        </m.span>
      ) : (
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      )}
    </section>
  );
}
