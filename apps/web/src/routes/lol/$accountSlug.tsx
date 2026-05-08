import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/lol/_shared/account-switcher";
import { HoverChampionProvider } from "@/lol/_shared/hover-champion-context";
import { QueueFilter } from "@/lol/_shared/queue-filter";
import { RefreshAccountButton } from "@/lol/_shared/refresh-account-button";
import { useSplashChampion } from "@/lol/_shared/splash-backdrop";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { ActiveMatchProvider, useActiveMatch } from "@/lol/matches/active-match-context";
import { MAX_COUNT } from "@/lol/matches/match-count-selector";
import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import {
  useCachedMatchesWindow,
  useMatchEventsSubscription,
} from "@/lol/matches/use-matches";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ChevronLeft, Crown, History, TrendingUp } from "lucide-react";
import { AnimatePresence, type Variants, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const pageSlideVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -32 }),
};

const TABS = [
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown },
] as const;

function iconPop(label: string): { scale: number; rotate?: number; y?: number } {
  if (label === "Matches") return { scale: 0.75, rotate: -12 };
  if (label === "Trends") return { scale: 0.75, y: 5 };
  return { scale: 0.65, rotate: 8 };
}

const DEFAULT_COUNT = 20;

interface AccountSearch {
  queue?: number;
  count?: number;
}

function MatchListReturnReset({ inSubtree }: { inSubtree: boolean }) {
  const { clearListScroll, setActiveMatch } = useActiveMatch();
  useEffect(() => {
    if (inSubtree) return;
    clearListScroll();
    setActiveMatch(null);
  }, [inSubtree, clearListScroll, setActiveMatch]);
  return null;
}

export const Route = createFileRoute("/lol/$accountSlug")({
  component: AccountLayout,
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    queue: typeof search.queue === "number" ? search.queue : undefined,
    count:
      typeof search.count === "number" && search.count > 0
        ? Math.min(search.count, MAX_COUNT)
        : undefined,
  }),
});

function AccountLayout() {
  const { accountSlug } = Route.useParams();
  const { queue, count: countParam } = Route.useSearch();
  const count = countParam ?? DEFAULT_COUNT;
  const navigate = useNavigate();
  const account = useAccountFromSlug(accountSlug);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Single windowed query at the layout level. Trends, Champions, and the
  // splash backdrop all consume this via context. Reads from the api's
  // cached endpoint — pure DB query, no Riot calls — so navigating between
  // tabs costs nothing upstream. The match list still backfills via its
  // own useMatches infinite query; the sync worker fills the DB on a cron.
  const matchesWindow = useCachedMatchesWindow(account, count, queue);
  const matches = matchesWindow.data?.matches;
  const total = matchesWindow.data?.total ?? 0;

  // Open an SSE stream while this account layout is mounted. The hook
  // invalidates matched-cache queries when the backfill worker reports new
  // rows, so the matches list, trends, and champions tabs all light up
  // without polling.
  useMatchEventsSubscription(account);

  const setCount = useCallback(
    (next: number) => {
      navigate({
        to: ".",
        search: (prev: AccountSearch) => ({
          ...prev,
          count: next === DEFAULT_COUNT ? undefined : next,
        }),
      });
    },
    [navigate]
  );

  const matchesPath = `/lol/${accountSlug}/matches`;
  const matchesPathPrefix = `${matchesPath}/`;
  const isMatchDetail =
    pathname.startsWith(matchesPathPrefix) && pathname.length > matchesPathPrefix.length;
  // Saved-scroll/active-match state is only meaningful while we're inside
  // the matches subtree (list ↔ detail). Once the user navigates to Trends
  // or Champions, that state is stale — dropping it stops the back-nav
  // restore from firing on routine tab returns.
  const isInMatchesSubtree =
    pathname === matchesPath || pathname.startsWith(matchesPathPrefix);

  // TanStack Router's built-in scrollRestoration was disabled to let
  // MatchList drive its own restore on detail → list back-nav. The side
  // effect: every other route transition inherits whatever scroll position
  // we left behind — so clicking Trends from a deep position in /matches
  // dumps you partway down the (much shorter) Trends page. Scroll to top
  // on every transition except the one MatchList still owns.
  const prevPathnameRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev === null || prev === pathname) return;
    const isReturnFromDetail =
      prev.startsWith(matchesPathPrefix) && pathname === matchesPath;
    if (isReturnFromDetail) return;
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname, matchesPath, matchesPathPrefix]);

  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--account-header-h",
        `${el.getBoundingClientRect().bottom}px`
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prefersReducedMotion = useReducedMotion();

  // Compute slide direction synchronously during render so the entering element
  // always receives the correct `initial` on the same render it mounts.
  const slideDirectionRef = useRef(0);
  const prevTabPathnameRef = useRef(pathname);
  if (prevTabPathnameRef.current !== pathname) {
    const resolve = (to: string) => to.replace("$accountSlug", accountSlug);
    const prevIdx = TABS.findIndex(
      ({ to }) => prevTabPathnameRef.current === resolve(to)
    );
    const currIdx = TABS.findIndex(({ to }) => pathname === resolve(to));
    slideDirectionRef.current =
      prevIdx !== -1 && currIdx !== -1 ? Math.sign(currIdx - prevIdx) : 0;
    prevTabPathnameRef.current = pathname;
  }
  const effectiveDir = prefersReducedMotion ? 0 : slideDirectionRef.current;

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => setCompact(el.scrollTop > 72);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const [hoveredChampion, setHoveredChampion] = useState<string | null>(null);
  const [initialChampion, setInitialChampion] = useState<string | null>(null);
  useEffect(() => {
    if (initialChampion || !matches || matches.length === 0) return;
    const random = matches[Math.floor(Math.random() * matches.length)];
    if (random) setInitialChampion(random.champion);
  }, [matches, initialChampion]);
  // Debounce hover-driven splash changes so a quick mouse sweep over the match
  // list doesn't remount the backdrop (and refetch its splash) per row.
  // First-set and clears stay instant — only value↔value transitions wait.
  const target = hoveredChampion ?? initialChampion;
  const [splashChampion, setSplashChampion] = useState<string | null>(null);
  useEffect(() => {
    if (target === splashChampion) return;
    if (splashChampion === null || target === null) {
      setSplashChampion(target);
      return;
    }
    const id = setTimeout(() => setSplashChampion(target), 80);
    return () => clearTimeout(id);
  }, [target, splashChampion]);
  useSplashChampion(splashChampion);

  return (
    <ActiveMatchProvider>
      <MatchListReturnReset inSubtree={isInMatchesSubtree} />
      <HoverChampionProvider setHovered={setHoveredChampion}>
        <MatchWindowProvider
          value={{
            matches,
            isPending: matchesWindow.isPending,
            total,
            count,
            setCount,
          }}
        >
          <div className="flex flex-col gap-6">
            <header
              ref={headerRef}
              data-account-header
              className="sticky top-0 z-40 ml-[calc(50%-50vw)] -mt-6 w-screen bg-background/50 backdrop-blur-md"
            >
              <m.div
                className="mx-auto max-w-4xl px-6"
                animate={{
                  paddingTop: compact ? 8 : 24,
                  paddingBottom: compact ? 8 : 12,
                }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {account && (
                      <section className="flex items-baseline gap-3">
                        <h2 className="text-xl font-semibold">
                          {account.gameName}
                          <span className="text-muted-foreground">
                            #{account.tagLine}
                          </span>
                        </h2>
                        <AnimatePresence>
                          {!compact && (
                            <m.span
                              key="region"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={
                                prefersReducedMotion
                                  ? { duration: 0 }
                                  : { duration: 0.15 }
                              }
                              className="text-sm uppercase text-muted-foreground"
                            >
                              {account.region}
                            </m.span>
                          )}
                        </AnimatePresence>
                      </section>
                    )}
                    {!isMatchDetail && (
                      <div className="flex items-center gap-2">
                        <QueueFilter />
                        <AccountSwitcher currentSlug={accountSlug} />
                        <RefreshAccountButton account={account} />
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {isMatchDetail ? (
                      <m.div
                        key="back-nav"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Link
                          to="/lol/$accountSlug/matches"
                          params={{ accountSlug }}
                          search={(prev: AccountSearch) => prev}
                          className="group flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
                          Matches
                        </Link>
                      </m.div>
                    ) : (
                      <m.div
                        key="tabs"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex gap-1 border-b border-border"
                      >
                        {TABS.map(({ to, label, Icon }) => {
                          const tabPath = to.replace("$accountSlug", accountSlug);
                          const active =
                            pathname === tabPath || pathname.startsWith(`${tabPath}/`);
                          return (
                            <Link
                              key={to}
                              to={to}
                              params={{ accountSlug }}
                              search={(prev: AccountSearch) => prev}
                              className={cn(
                                "group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                                active
                                  ? "text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <m.span
                                key={active ? 1 : 0}
                                initial={
                                  active && !prefersReducedMotion ? iconPop(label) : false
                                }
                                animate={{ scale: 1, rotate: 0, y: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 450,
                                  damping: 18,
                                }}
                                className="inline-flex"
                              >
                                <Icon
                                  className={cn(
                                    "size-4 transition-colors",
                                    active
                                      ? "text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]"
                                      : "text-muted-foreground group-hover:text-foreground"
                                  )}
                                />
                              </m.span>
                              {label}
                              {active && (
                                <m.div
                                  layoutId="lol-tab-indicator"
                                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400"
                                  animate={{
                                    boxShadow: [
                                      "0 0 0px 0px rgba(56,189,248,0)",
                                      "0 0 10px 1px rgba(56,189,248,0.45)",
                                      "0 0 0px 0px rgba(56,189,248,0)",
                                    ],
                                  }}
                                  transition={{
                                    default: {
                                      type: "spring",
                                      stiffness: 500,
                                      damping: 35,
                                    },
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
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </m.div>
            </header>

            <AnimatePresence mode="popLayout" initial={false} custom={effectiveDir}>
              <m.div
                key={pathname}
                custom={effectiveDir}
                variants={pageSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Outlet />
              </m.div>
            </AnimatePresence>
          </div>
        </MatchWindowProvider>
      </HoverChampionProvider>
    </ActiveMatchProvider>
  );
}
