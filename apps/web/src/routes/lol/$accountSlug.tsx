import { mainScrollRef } from "@/lib/scroll-container";
import { toastMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/lol/_shared/account-switcher";
import championAssets from "@/lol/_shared/champion-assets.json";
import { HoverChampionProvider } from "@/lol/_shared/hover-champion-context";
import { RefreshAccountButton } from "@/lol/_shared/refresh-account-button";
import { SeriousQueuesProvider } from "@/lol/_shared/serious-queues";
import { SeriousQueuesSettings } from "@/lol/_shared/serious-queues-settings";
import { useSplashChampion } from "@/lol/_shared/splash-backdrop";
import { profileIconFallbackUrl, profileIconUrl } from "@/lol/_shared/summoner-icon";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useDDragonVersion } from "@/lol/_shared/use-ddragon-version";
import { ActiveMatchProvider, useActiveMatch } from "@/lol/matches/active-match-context";
import { MAX_COUNT } from "@/lol/matches/match-count-selector";
import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import { useLiveGame, useLiveGameEvents } from "@/lol/matches/use-live-match";
import {
  useCachedMatchesWindow,
  useMatchEventsSubscription,
} from "@/lol/matches/use-matches";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  ChevronLeft,
  Crown,
  History,
  LayoutDashboard,
  Radio,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, type Variants, m, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CHAMPION_KEYS = Object.keys(championAssets.champions as Record<string, unknown>);

const pageSlideVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -32 }),
};

const TABS = [
  { to: "/lol/$accountSlug", label: "Profile", Icon: LayoutDashboard, exact: true },
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History, exact: false },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp, exact: false },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown, exact: false },
] as const;

function iconPop(label: string): { scale: number; rotate?: number; y?: number } {
  if (label === "Profile") return { scale: 0.75, y: -4 };
  if (label === "Matches") return { scale: 0.75, rotate: -12 };
  if (label === "Trends") return { scale: 0.75, y: 5 };
  if (label === "Live") return { scale: 0.75, y: -4 };
  return { scale: 0.65, rotate: 8 };
}

const DEFAULT_COUNT = 20;

interface AccountSearch {
  queue?: number;
  count?: number;
}

function BackButton({
  accountSlug,
  pathname,
}: { accountSlug: string; pathname: string }) {
  const { setOriginRect } = useActiveMatch();
  const matchId = pathname.split("/").pop() ?? null;
  return (
    <Link
      to="/lol/$accountSlug/matches"
      params={{ accountSlug }}
      search={(prev: AccountSearch) => prev}
      onClick={() => {
        if (matchId) {
          const heroEl = document.querySelector(`[data-match-card="${matchId}"]`);
          if (heroEl instanceof HTMLElement) {
            setOriginRect({
              matchId,
              rect: heroEl.getBoundingClientRect(),
              direction: "backward",
            });
          }
        }
      }}
      className="group flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      Matches
    </Link>
  );
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
  const { count: countParam } = Route.useSearch();
  const count = countParam ?? DEFAULT_COUNT;
  const navigate = useNavigate();
  const account = useAccountFromSlug(accountSlug);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Single windowed query at the layout level. Trends, Champions, and the
  // splash backdrop all consume this via context. Reads from the api's
  // cached endpoint — pure DB query, no Riot calls — so navigating between
  // tabs costs nothing upstream. The match list still backfills via its
  // own useMatches infinite query; the sync worker fills the DB on a cron.
  //
  // Queue scope is intentionally left out here: the layer caches all queues
  // and downstream views decide their own scope (performance views filter
  // to SERIOUS_QUEUE_TYPES via useSeriousMatches; identity/cadence views
  // consume everything; the match list page owns its own queue filter UI).
  const matchesWindow = useCachedMatchesWindow(account, count);
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

  const profile = useProfileRank(account);
  const iconId = profile.data?.profileIconId;
  const level = profile.data?.summonerLevel;
  const { data: liveData } = useLiveGame(account);
  // Layout-level SSE subscription: keeps live-game state fresh on every
  // sub-tab (Profile, Matches, Trends, Champions, Live) and drives the
  // toast that announces a new game while you're elsewhere on the account.
  useLiveGameEvents(account, {
    onGameStarted: () => {
      if (!account) return;
      const livePath = `/lol/${accountSlug}/live`;
      if (pathname === livePath) return;
      void toastMessage(`${account.gameName} is in game`, {
        action: {
          label: "View live",
          onClick: () => {
            void navigate({
              to: "/lol/$accountSlug/live",
              params: { accountSlug },
            });
          },
        },
      });
    },
  });
  const ddVersion = useDDragonVersion();

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
  const isMatchDetailTransitionRef = useRef(false);
  const prevTabPathnameRef = useRef(pathname);
  if (prevTabPathnameRef.current !== pathname) {
    const prev = prevTabPathnameRef.current;
    // Strip trailing slash so the Profile index route ("/lol/$accountSlug")
    // resolves consistently regardless of how the router normalises it.
    const norm = (s: string) => s.replace(/\/$/, "");
    const resolve = (to: string) => norm(to.replace("$accountSlug", accountSlug));
    const prevIdx = TABS.findIndex(({ to }) => norm(prev) === resolve(to));
    const currIdx = TABS.findIndex(({ to }) => norm(pathname) === resolve(to));
    slideDirectionRef.current =
      prevIdx !== -1 && currIdx !== -1 ? Math.sign(currIdx - prevIdx) : 0;
    // Transitioning to or from a match detail page — cut instantly so the
    // card-morph animation runs without competing with a page fade.
    const prevIsDetail =
      prev.startsWith(matchesPathPrefix) && prev.length > matchesPathPrefix.length;
    const currIsDetail =
      pathname.startsWith(matchesPathPrefix) &&
      pathname.length > matchesPathPrefix.length;
    isMatchDetailTransitionRef.current = prevIsDetail || currIsDetail;
    prevTabPathnameRef.current = pathname;
  }
  const effectiveDir = prefersReducedMotion ? 0 : slideDirectionRef.current;

  // Compact mode toggles on scroll, but the act of compacting changes the
  // header's height by ~28px, which Chrome's scroll anchoring compensates for
  // by adjusting scrollTop. Without protection, the resulting scroll event can
  // drag scrollTop back across the threshold and cause a shrink/grow loop.
  // Defenses: (1) wide hysteresis (enter >96, exit <8), (2) cooldown ignoring
  // scroll events during the spring animation's settle time.
  const [compact, setCompact] = useState(false);
  const lastToggleRef = useRef(0);
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (Date.now() - lastToggleRef.current < 400) return;
      setCompact((prev) => {
        if (!prev && el.scrollTop > 96) {
          lastToggleRef.current = Date.now();
          return true;
        }
        if (prev && el.scrollTop < 8) {
          lastToggleRef.current = Date.now();
          return false;
        }
        return prev;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const [hoveredChampion, setHoveredChampion] = useState<string | null>(null);
  const [initialChampion, setInitialChampion] = useState<string | null>(null);
  // Initialize once per account so the splash follows account swaps but does
  // not reshuffle every time the match list refetches (e.g. SSE backfill).
  const initializedSlugRef = useRef<string | null>(null);
  useEffect(() => {
    if (!matches) return;
    if (initializedSlugRef.current === accountSlug) return;
    if (matches.length > 0) {
      const first = matches[0];
      if (first) setInitialChampion(first.champion);
    } else {
      const key = CHAMPION_KEYS[Math.floor(Math.random() * CHAMPION_KEYS.length)];
      if (key) setInitialChampion(key);
    }
    initializedSlugRef.current = accountSlug;
  }, [matches, accountSlug]);
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

  // Stable context value — pathname-driven re-renders of AccountLayout would
  // otherwise hand every useMatchWindow() consumer a fresh object identity,
  // forcing the profile widgets to commit on each tab cycle even when
  // matches/total/count are unchanged.
  const matchWindowValue = useMemo(
    () => ({ matches, isPending: matchesWindow.isPending, total, count, setCount }),
    [matches, matchesWindow.isPending, total, count, setCount]
  );

  return (
    <ActiveMatchProvider>
      <MatchListReturnReset inSubtree={isInMatchesSubtree} />
      <HoverChampionProvider setHovered={setHoveredChampion}>
        <SeriousQueuesProvider>
          <MatchWindowProvider value={matchWindowValue}>
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
                        <section className="flex items-center gap-3">
                          {iconId != null && (
                            <div className="relative shrink-0">
                              <img
                                src={profileIconUrl(iconId)}
                                alt=""
                                className={cn(
                                  "rounded-full object-cover ring-1 ring-border transition-all",
                                  compact ? "size-7" : "size-9"
                                )}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = profileIconFallbackUrl(
                                    iconId,
                                    ddVersion
                                  );
                                }}
                              />
                              {level != null && !compact && (
                                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm bg-background px-1 text-[10px] font-semibold tabular-nums leading-none ring-1 ring-border">
                                  {level}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-baseline gap-3">
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
                          </div>
                        </section>
                      )}
                      {!isMatchDetail && (
                        <div className="flex items-center gap-2">
                          {/* The Matches subtree shows every queue (it's a
                              browse surface), so the serious-queues
                              preference has no effect there — hide the icon
                              to avoid implying it does. */}
                          {!isInMatchesSubtree && <SeriousQueuesSettings />}
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
                          <BackButton accountSlug={accountSlug} pathname={pathname} />
                        </m.div>
                      ) : (
                        <m.div
                          key="tabs"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex gap-1"
                        >
                          {TABS.map(({ to, label, Icon, exact }) => {
                            const tabPath = to.replace("$accountSlug", accountSlug);
                            const active = exact
                              ? pathname === tabPath
                              : pathname === tabPath ||
                                pathname.startsWith(`${tabPath}/`);
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
                                    active && !prefersReducedMotion
                                      ? iconPop(label)
                                      : false
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
                          {liveData &&
                            (() => {
                              const livePath = `/lol/${accountSlug}/live`;
                              const active = pathname === livePath;
                              return (
                                <Link
                                  to="/lol/$accountSlug/live"
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
                                      active && !prefersReducedMotion
                                        ? iconPop("Live")
                                        : false
                                    }
                                    animate={{ scale: 1, rotate: 0, y: 0 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 450,
                                      damping: 18,
                                    }}
                                    className="inline-flex"
                                  >
                                    <Radio
                                      className={cn(
                                        "size-4 transition-colors",
                                        active
                                          ? "text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]"
                                          : "animate-pulse text-red-400/60 group-hover:text-red-400"
                                      )}
                                    />
                                  </m.span>
                                  Live
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
                            })()}
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                </m.div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
                />
              </header>

              <AnimatePresence mode="popLayout" initial={false} custom={effectiveDir}>
                <m.div
                  key={pathname}
                  custom={effectiveDir}
                  variants={pageSlideVariants}
                  initial={isMatchDetailTransitionRef.current ? "center" : "enter"}
                  animate="center"
                  exit="exit"
                  transition={
                    isMatchDetailTransitionRef.current
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 30 }
                  }
                >
                  <Outlet />
                </m.div>
              </AnimatePresence>
            </div>
          </MatchWindowProvider>
        </SeriousQueuesProvider>
      </HoverChampionProvider>
    </ActiveMatchProvider>
  );
}
