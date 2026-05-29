import type { SectionTab } from "@/_shared/section-layout/section-nav";
import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { NotFound } from "@/components/not-found";
import { useScrollResetOnNav } from "@/lib/use-scroll-reset-on-nav";
import { cn } from "@/lib/utils";
import { SteamPreferences } from "@/steam/_shared/steam-preferences";
import { ActiveGameProvider, useActiveGame } from "@/steam/library/active-game-context";
import { SteamProfileBackdrop } from "@/steam/profile-backdrop";
import { isSteamTabActive } from "@/steam/tabs";
import { useSafariSlideDirection } from "@/steam/use-safari-slide-direction";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

export const Route = createFileRoute("/steam")({
  component: SteamLayout,
  notFoundComponent: NotFound,
});

const TABS = [
  { to: "/steam", label: "Profile", Icon: LayoutDashboard, exact: true },
  {
    to: "/steam/library",
    label: "Library",
    Icon: Library,
    exact: false,
    // /steam/game/$appid is a Library drill-in but lives outside the /library/* subtree.
    extraPrefixes: ["/steam/game"],
  },
  { to: "/steam/wishlist", label: "Wishlist", Icon: ListChecks, exact: false },
  { to: "/steam/achievements", label: "Achievements", Icon: Trophy, exact: false },
] as const;

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

  useScrollResetOnNav(pathname, [
    { fromPrefix: "/steam/game/", toExact: "/steam/library" },
  ]);

  const inLibrarySubtree =
    pathname === "/steam/library" ||
    pathname.startsWith("/steam/library/") ||
    pathname.startsWith("/steam/game/");

  const steamTabs: SectionTab[] = TABS.map((tab) => ({
    to: tab.to,
    label: tab.label,
    Icon: tab.Icon,
    active: isSteamTabActive(tab, pathname),
  }));

  return (
    <ActiveGameProvider>
      <GameListReturnReset inSubtree={inLibrarySubtree} />
      <SteamProfileBackdrop>
        <SectionShell
          identity={<SteamIdentity />}
          tabs={steamTabs}
          tabIndicatorId="steam-tab-indicator"
          actions={<SteamPreferences />}
        >
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

  return (
    <section className="flex items-center gap-3">
      {summary ? (
        <img
          src={
            summary.animatedAvatarUrl && !prefersReducedMotion
              ? summary.animatedAvatarUrl
              : summary.avatarUrl
          }
          alt=""
          className={cn(
            "rounded-full object-cover ring-1 ring-border transition-all",
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
        <span className="text-xl font-semibold">{summary.personaName}</span>
      ) : (
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      )}
    </section>
  );
}
