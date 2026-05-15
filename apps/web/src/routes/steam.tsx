import { cn } from "@/lib/utils";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";
import { AnimatePresence, type Variants, m, useReducedMotion } from "motion/react";
import { useRef } from "react";

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

const tabSlideVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -32 }),
};

function isTabActive(tab: (typeof TABS)[number], pathname: string): boolean {
  if (tab.exact) return pathname === tab.to;
  if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return true;
  if ("extraPrefixes" in tab) {
    return tab.extraPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return false;
}

function SteamLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();

  // Compute slide direction synchronously during render so the entering element
  // always receives the correct `initial` on the same frame it mounts.
  const slideDirectionRef = useRef(0);
  const prevPathnameRef = useRef(pathname);
  if (prevPathnameRef.current !== pathname) {
    const prevIdx = TABS.findIndex((tab) => isTabActive(tab, prevPathnameRef.current));
    const currIdx = TABS.findIndex((tab) => isTabActive(tab, pathname));
    slideDirectionRef.current =
      prevIdx !== -1 && currIdx !== -1 ? Math.sign(currIdx - prevIdx) : 0;
    prevPathnameRef.current = pathname;
  }
  const effectiveDir = prefersReducedMotion ? 0 : slideDirectionRef.current;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {summary && (
          <section className="flex items-center gap-3">
            <img
              src={summary.avatarUrl}
              alt=""
              className="size-9 rounded-full object-cover ring-1 ring-border"
            />
            <span className="text-xl font-semibold">{summary.personaName}</span>
          </section>
        )}
        <nav
          aria-label="Steam sections"
          className="flex items-center gap-1 border-b border-border/40"
        >
          {TABS.map((tab) => {
            const active = isTabActive(tab, pathname);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <m.span
                  key={active ? 1 : 0}
                  initial={
                    active && !prefersReducedMotion ? { scale: 0.75, y: -4 } : false
                  }
                  animate={{ scale: 1, y: 0 }}
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
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={effectiveDir}>
        <m.div
          key={pathname}
          custom={effectiveDir}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Outlet />
        </m.div>
      </AnimatePresence>
    </div>
  );
}
