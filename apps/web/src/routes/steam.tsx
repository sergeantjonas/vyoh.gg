import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { useTabSlideDirection } from "@/_shared/section-layout/use-tab-slide-direction";
import { cn } from "@/lib/utils";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";
import { type Variants, m, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";

export const Route = createFileRoute("/steam")({
  component: SteamLayout,
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

function isTabActive(tab: (typeof TABS)[number], pathname: string): boolean {
  if (tab.exact) return pathname === tab.to;
  if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return true;
  if ("extraPrefixes" in tab) {
    return tab.extraPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return false;
}

function tabIndexOf(pathname: string): number {
  return TABS.findIndex((tab) => isTabActive(tab, pathname));
}

const tabIconVariants: Variants = {
  initial: { scale: 0.75, y: -4 },
  animate: { scale: 1, y: 0 },
};

function SteamLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();

  const rawDirection = useTabSlideDirection(pathname, tabIndexOf);
  const slideDirection = prefersReducedMotion ? 0 : rawDirection;

  return (
    <>
      {summary?.profileBackgroundUrl &&
        typeof document !== "undefined" &&
        createPortal(
          // Fade the backdrop in on mount instead of having it pop in the
          // moment `summary` resolves — the network round-trip means the
          // image/video appears noticeably after first paint, which reads as
          // jarring without the easing.
          <m.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
            }
          >
            {summary.profileBackgroundVideoUrl && !prefersReducedMotion ? (
              <video
                key={summary.profileBackgroundVideoUrl}
                src={summary.profileBackgroundVideoUrl}
                poster={summary.profileBackgroundUrl}
                autoPlay
                loop
                muted
                playsInline
                className="size-full scale-105 object-cover blur-[2px]"
              />
            ) : (
              <img
                src={summary.profileBackgroundUrl}
                alt=""
                className="size-full scale-105 object-cover blur-[2px]"
              />
            )}
            {/* Gradient mask anchored heavier at the bottom so the page content
                cards stay focal. Mirrors the LoL splash gradient shape. The
                bottom stop is /95 (not /100) so a hint of image texture
                survives below the cards instead of fading to flat dark. */}
            <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
          </m.div>,
          document.body
        )}
      <SectionShell
        pathname={pathname}
        slideDirection={slideDirection}
        identity={<SteamIdentity />}
        nav={<SteamTabs pathname={pathname} />}
      >
        <Outlet />
      </SectionShell>
    </>
  );
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

function SteamTabs({ pathname }: { pathname: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <nav aria-label="Steam sections" className="flex items-center gap-1">
      {TABS.map((tab) => {
        const active = isTabActive(tab, pathname);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <m.span
              key={active ? 1 : 0}
              variants={tabIconVariants}
              initial={active && !prefersReducedMotion ? "initial" : false}
              animate="animate"
              transition={{ type: "spring", stiffness: 450, damping: 18 }}
              className="inline-flex"
            >
              <tab.Icon
                className={cn(
                  "size-4 transition-colors",
                  active
                    ? "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
            </m.span>
            {tab.label}
            {active && (
              <m.div
                layoutId="steam-tab-indicator"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-linear-to-r from-blue-400 via-cyan-400 to-sky-300"
                animate={{
                  boxShadow: [
                    "0 0 0px 0px rgba(96,165,250,0)",
                    "0 0 10px 1px rgba(96,165,250,0.45)",
                    "0 0 0px 0px rgba(96,165,250,0)",
                  ],
                }}
                transition={{
                  default: { type: "spring", stiffness: 500, damping: 35 },
                  boxShadow: {
                    duration: 2.4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  },
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
