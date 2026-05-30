import type { SectionTab } from "@/_shared/section-layout/section-nav";
import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { NotFound } from "@/components/not-found";
import { useScrollResetOnNav } from "@/lib/use-scroll-reset-on-nav";
import { cn } from "@/lib/utils";
import { SteamPreferences } from "@/steam/_shared/steam-preferences";
import { ActiveGameProvider, useActiveGame } from "@/steam/library/active-game-context";
import { SteamProfileBackdrop } from "@/steam/profile-backdrop";
import {
  STEAM_IDENTITY_AVATAR_MORPH_ID,
  STEAM_IDENTITY_NAME_MORPH_ID,
} from "@/steam/profile/identity-layout";
import { isSteamTabActive } from "@/steam/tabs";
import { useSafariSlideDirection } from "@/steam/use-safari-slide-direction";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
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
