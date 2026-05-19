import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { useTabSlideDirection } from "@/_shared/section-layout/use-tab-slide-direction";
import { NotFound } from "@/components/not-found";
import { useMe } from "@/identity/use-me";
import { toastMessage } from "@/lib/toast";
import { useScrollResetOnNav } from "@/lib/use-scroll-reset-on-nav";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/lol/_shared/account/account-switcher";
import { RefreshAccountButton } from "@/lol/_shared/account/refresh-account-button";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import championAssets from "@/lol/_shared/assets/champion-assets.json";
import { useSplashChampion } from "@/lol/_shared/assets/splash-backdrop";
import {
  profileIconFallbackUrl,
  profileIconUrl,
} from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { SeriousQueuesProvider } from "@/lol/_shared/serious-queues/serious-queues";
import { SeriousQueuesSettings } from "@/lol/_shared/serious-queues/serious-queues-settings";
import { HoverChampionProvider } from "@/lol/_shared/ui/hover-champion-context";
import { type AccountSearch, validateAccountSearch } from "@/lol/account/account-search";
import {
  iconPop,
  isInMatchesSubtree as isInMatchesSubtreeFn,
  isMatchDetail as isMatchDetailFn,
  isTabActive,
  tabIndexFromPath,
} from "@/lol/account/account-tab-helpers";
import { ActiveMatchProvider, useActiveMatch } from "@/lol/matches/active-match-context";
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
  Crown,
  History,
  LayoutDashboard,
  Radio,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CHAMPION_KEYS = Object.keys(championAssets.champions as Record<string, unknown>);

const TABS = [
  { to: "/lol/$accountSlug", label: "Profile", Icon: LayoutDashboard, exact: true },
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History, exact: false },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp, exact: false },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown, exact: false },
  { to: "/lol/$accountSlug/patches", label: "Patches", Icon: ScrollText, exact: false },
] as const;

const DEFAULT_COUNT = 20;

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
  notFoundComponent: NotFound,
  validateSearch: validateAccountSearch,
});

function AccountLayout() {
  const { accountSlug } = Route.useParams();
  const { count: countParam } = Route.useSearch();
  const count = countParam ?? DEFAULT_COUNT;
  const navigate = useNavigate();
  const me = useMe();
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
        search: (prev: AccountSearch) => {
          const { count: _, ...rest } = prev;
          return next === DEFAULT_COUNT ? rest : { ...rest, count: next };
        },
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
  const isMatchDetail = isMatchDetailFn(pathname, accountSlug);
  // Saved-scroll/active-match state is only meaningful while we're inside
  // the matches subtree (list ↔ detail). Once the user navigates to Trends
  // or Champions, that state is stale — dropping it stops the back-nav
  // restore from firing on routine tab returns.
  const isInMatchesSubtree = isInMatchesSubtreeFn(pathname, accountSlug);

  // TanStack Router's built-in scrollRestoration was disabled to let
  // MatchList drive its own restore on detail → list back-nav. The side
  // effect: every other route transition inherits whatever scroll position
  // we left behind — so clicking Trends from a deep position in /matches
  // dumps you partway down the (much shorter) Trends page. Scroll to top
  // on every transition except the one MatchList still owns.
  useScrollResetOnNav(pathname, matchesPathPrefix, matchesPath);

  const prefersReducedMotion = useReducedMotion();

  // Page-slide direction is computed against the resolved tab paths (exact
  // match after `$accountSlug` substitution + trailing-slash strip). Match
  // detail routes like `/matches/<id>` return -1 and the slide is short-
  // circuited via slideTransitionOverride below — the card-morph animation
  // owns the visual transition there.
  const tabIndexOf = useCallback(
    (path: string) => tabIndexFromPath(TABS, path, accountSlug),
    [accountSlug]
  );
  const rawDirection = useTabSlideDirection(pathname, tabIndexOf);
  const slideDirection = prefersReducedMotion ? 0 : rawDirection;

  // Match-detail transitions cut to 0 duration so the card-morph animation
  // runs without competing with a page fade. Tracked synchronously during
  // render so the same frame the new pathname mounts uses the correct
  // initial state.
  const isMatchDetailTransitionRef = useRef(false);
  const prevPathnameForCutRef = useRef(pathname);
  if (prevPathnameForCutRef.current !== pathname) {
    const prev = prevPathnameForCutRef.current;
    const prevIsDetail = isMatchDetailFn(prev, accountSlug);
    const currIsDetail = isMatchDetailFn(pathname, accountSlug);
    isMatchDetailTransitionRef.current = prevIsDetail || currIsDetail;
    prevPathnameForCutRef.current = pathname;
  }
  const slideTransitionOverride = isMatchDetailTransitionRef.current
    ? { initial: "center" as const, transition: { duration: 0 } }
    : undefined;

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

  // Tag the header element + publish its bottom y as `--account-header-h`.
  // Downstream consumers: `[data-account-header]` selector in the hero-scrolled
  // analytics hook, and `top="var(--account-header-h)"` on the match-detail
  // and champion-detail sticky sub-headers.
  const setHeaderEl = useCallback((el: HTMLElement | null) => {
    if (el) el.setAttribute("data-account-header", "");
  }, []);
  const onHeaderRect = useCallback((rect: DOMRect) => {
    document.documentElement.style.setProperty("--account-header-h", `${rect.bottom}px`);
  }, []);

  if (!me.isPending && !me.isError && !account) {
    return <NotFound />;
  }

  return (
    <ActiveMatchProvider>
      <MatchListReturnReset inSubtree={isInMatchesSubtree} />
      <HoverChampionProvider setHovered={setHoveredChampion}>
        <SeriousQueuesProvider>
          <MatchWindowProvider value={matchWindowValue}>
            <SectionShell
              pathname={pathname}
              slideDirection={slideDirection}
              slideTransitionOverride={slideTransitionOverride}
              headerRef={setHeaderEl}
              onHeaderRect={onHeaderRect}
              identity={
                <LolIdentity
                  account={account}
                  iconId={iconId}
                  level={level}
                  ddVersion={ddVersion}
                  prefersReducedMotion={prefersReducedMotion}
                />
              }
              actions={
                isMatchDetail ? undefined : (
                  <div className="flex items-center gap-2">
                    {/* The Matches subtree shows every queue (it's a browse
                        surface), so the serious-queues preference has no
                        effect there — hide the icon to avoid implying it does. */}
                    {!isInMatchesSubtree && <SeriousQueuesSettings />}
                    <AccountSwitcher currentSlug={accountSlug} />
                    <RefreshAccountButton account={account} />
                  </div>
                )
              }
              nav={
                <LolNav
                  isMatchDetail={isMatchDetail}
                  accountSlug={accountSlug}
                  pathname={pathname}
                  liveData={liveData}
                  prefersReducedMotion={prefersReducedMotion}
                />
              }
            >
              <Outlet />
            </SectionShell>
          </MatchWindowProvider>
        </SeriousQueuesProvider>
      </HoverChampionProvider>
    </ActiveMatchProvider>
  );
}

function LolIdentity({
  account,
  iconId,
  level,
  ddVersion,
  prefersReducedMotion,
}: {
  account: ReturnType<typeof useAccountFromSlug>;
  iconId: number | null | undefined;
  level: number | null | undefined;
  ddVersion: ReturnType<typeof useDDragonVersion>;
  prefersReducedMotion: boolean | null;
}) {
  const { compact } = useSectionShellState();
  return (
    <section className="flex items-center gap-3">
      {iconId != null ? (
        <div className="relative shrink-0">
          <img
            src={profileIconUrl(iconId)}
            alt=""
            className={cn(
              "rounded-full object-cover ring-1 ring-border transition-all",
              compact ? "size-10" : "size-12"
            )}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = profileIconFallbackUrl(iconId, ddVersion);
            }}
          />
          {level != null && !compact && (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm bg-background px-1 text-[10px] font-semibold tabular-nums leading-none ring-1 ring-border">
              {level}
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "shrink-0 animate-pulse rounded-full bg-muted ring-1 ring-border transition-all",
            compact ? "size-10" : "size-12"
          )}
        />
      )}
      <div className="flex items-baseline gap-3">
        {account ? (
          <h2 className="text-xl font-semibold">
            {account.gameName}
            <span className="text-muted-foreground">#{account.tagLine}</span>
          </h2>
        ) : (
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        )}
        <AnimatePresence>
          {account && !compact && (
            <m.span
              key="region"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
              className="text-sm uppercase text-muted-foreground"
            >
              {account.region}
            </m.span>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function LolNav({
  isMatchDetail,
  accountSlug,
  pathname,
  liveData,
  prefersReducedMotion,
}: {
  isMatchDetail: boolean;
  accountSlug: string;
  pathname: string;
  liveData: ReturnType<typeof useLiveGame>["data"];
  prefersReducedMotion: boolean | null;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isMatchDetail ? null : (
        <m.div
          key="tabs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex gap-1"
        >
          {TABS.map(({ to, label, Icon, exact }) => {
            const active = isTabActive({ to, exact }, pathname, accountSlug);
            return (
              <LolTabLink
                key={to}
                to={to}
                accountSlug={accountSlug}
                label={label}
                Icon={Icon}
                active={active}
                prefersReducedMotion={prefersReducedMotion}
              />
            );
          })}
          {liveData && (
            <LolTabLink
              to="/lol/$accountSlug/live"
              accountSlug={accountSlug}
              label="Live"
              Icon={Radio}
              active={pathname === `/lol/${accountSlug}/live`}
              prefersReducedMotion={prefersReducedMotion}
              iconActiveClassName="text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]"
              iconIdleClassName="animate-pulse text-red-400/60 group-hover:text-red-400"
            />
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}

function LolTabLink({
  to,
  accountSlug,
  label,
  Icon,
  active,
  prefersReducedMotion,
  iconActiveClassName = "text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]",
  iconIdleClassName = "text-muted-foreground group-hover:text-foreground",
}: {
  to:
    | "/lol/$accountSlug"
    | "/lol/$accountSlug/matches"
    | "/lol/$accountSlug/trends"
    | "/lol/$accountSlug/champions"
    | "/lol/$accountSlug/patches"
    | "/lol/$accountSlug/live";
  accountSlug: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
  prefersReducedMotion: boolean | null;
  iconActiveClassName?: string;
  iconIdleClassName?: string;
}) {
  return (
    <Link
      to={to}
      params={{ accountSlug }}
      search={(prev: AccountSearch) => prev}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <m.span
        key={active ? 1 : 0}
        initial={active && !prefersReducedMotion ? iconPop(label) : false}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        className="inline-flex"
      >
        <Icon
          className={cn(
            "size-4 transition-colors",
            active ? iconActiveClassName : iconIdleClassName
          )}
        />
      </m.span>
      {label}
      {active && (
        <m.div
          layoutId="lol-tab-indicator"
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-linear-to-r from-sky-400 via-violet-400 to-emerald-400"
          animate={{
            boxShadow: [
              "0 0 0px 0px rgba(56,189,248,0)",
              "0 0 10px 1px rgba(56,189,248,0.45)",
              "0 0 0px 0px rgba(56,189,248,0)",
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
}
