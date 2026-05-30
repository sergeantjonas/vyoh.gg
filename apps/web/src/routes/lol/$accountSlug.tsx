import type { SectionLiveTab, SectionTab } from "@/_shared/section-layout/section-nav";
import { SectionShell } from "@/_shared/section-layout/section-shell";
import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { NotFound } from "@/components/not-found";
import { useMe } from "@/identity/use-me";
import { toastMessage } from "@/lib/toast";
import { useScrollResetOnNav } from "@/lib/use-scroll-reset-on-nav";
import { cn } from "@/lib/utils";
import { RefreshAccountButton } from "@/lol/_shared/account/refresh-account-button";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import championAssets from "@/lol/_shared/assets/champion-assets.json";
import { useSplashChampion } from "@/lol/_shared/assets/splash-backdrop";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { SeriousQueuesProvider } from "@/lol/_shared/serious-queues/serious-queues";
import { SeriousQueuesSettings } from "@/lol/_shared/serious-queues/serious-queues-settings";
import { type AccountSearch, validateAccountSearch } from "@/lol/account/account-search";
import {
  isInChampionsSubtree as isInChampionsSubtreeFn,
  isInMatchesSubtree as isInMatchesSubtreeFn,
  isMatchDetail as isMatchDetailFn,
  isTabActive,
  matchIdFromPath,
} from "@/lol/account/account-tab-helpers";
import {
  ActiveChampionProvider,
  useActiveChampion,
} from "@/lol/champions/active-champion-context";
import { ActiveMatchProvider, useActiveMatch } from "@/lol/matches/active-match-context";
import {
  activeMatchDetailTab,
  buildMatchDetailSectionTabs,
} from "@/lol/matches/match-detail-tabs";
import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import { useLiveGame, useLiveGameEvents } from "@/lol/matches/use-live-match";
import {
  useCachedMatchesWindow,
  useMatchEventsSubscription,
} from "@/lol/matches/use-matches";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { selectChampionOfYear } from "@/lol/recap/recap-champion";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ChevronLeft, Crown, History, LayoutDashboard, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHAMPION_KEYS = Object.keys(championAssets.champions as Record<string, unknown>);

const TABS = [
  { to: "/lol/$accountSlug", label: "Profile", Icon: LayoutDashboard, exact: true },
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History, exact: false },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp, exact: false },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown, exact: false },
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

function ChampionListReturnReset({ inSubtree }: { inSubtree: boolean }) {
  const { clearListScroll, setActiveChampion, setActivePosition } = useActiveChampion();
  useEffect(() => {
    if (inSubtree) return;
    clearListScroll();
    setActiveChampion(null);
    setActivePosition(null);
  }, [inSubtree, clearListScroll, setActiveChampion, setActivePosition]);
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
  const isInChampionsSubtree = isInChampionsSubtreeFn(pathname, accountSlug);

  // TanStack Router's built-in scrollRestoration was disabled to let
  // MatchList drive its own restore on detail → list back-nav. The side
  // effect: every other route transition inherits whatever scroll position
  // we left behind — so clicking Trends from a deep position in /matches
  // dumps you partway down the (much shorter) Trends page. Scroll to top
  // on every transition except the one MatchList still owns.
  const championsPath = `/lol/${accountSlug}/champions`;
  const championsPathPrefix = `${championsPath}/`;
  useScrollResetOnNav(pathname, [
    { fromPrefix: matchesPathPrefix, toExact: matchesPath },
    { fromPrefix: championsPathPrefix, toExact: championsPath },
  ]);

  // Splash claim for the LoL section: top-played champion in the windowed
  // match set (same selector as Recap so the splash backdrop and Recap's
  // "champion of the year" tile always agree). Pinned once per account
  // slug so the splash doesn't reshuffle as the SSE backfill streams in
  // and shifts the leader. Sub-routes that care about a more specific
  // champion (Live → playing champion, match-detail → match hero, etc.)
  // make their own useSplashChampion call which wins over this one.
  const [splashChampion, setSplashChampion] = useState<string | null>(null);
  const initializedSlugRef = useRef<string | null>(null);
  useEffect(() => {
    if (!matches) return;
    if (initializedSlugRef.current === accountSlug) return;
    const top = selectChampionOfYear(matches);
    if (top) {
      setSplashChampion(top.champion);
    } else if (matches.length === 0) {
      const key = CHAMPION_KEYS[Math.floor(Math.random() * CHAMPION_KEYS.length)];
      if (key) setSplashChampion(key);
    }
    initializedSlugRef.current = accountSlug;
  }, [matches, accountSlug]);
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

  const lolSectionTabs: SectionTab[] = TABS.map(({ to, label, Icon, exact }) => ({
    to,
    params: { accountSlug },
    preserveSearch: true,
    label,
    Icon,
    active: isTabActive({ to, exact }, pathname, accountSlug),
  }));
  const lolLive: SectionLiveTab | undefined = liveData
    ? {
        to: "/lol/$accountSlug/live",
        params: { accountSlug },
        preserveSearch: true,
        active: pathname === `/lol/${accountSlug}/live`,
      }
    : undefined;

  // Model 3: on a match-detail page the always-on section strip swaps its tab
  // row from the section tabs (Profile/Matches/…) to the detail's own sub-tabs
  // (Recap/Your game/Review/Timeline), and section scope collapses to a
  // `‹ Matches` breadcrumb in the strip's leading slot — the standard
  // master→detail idiom, so we never stack a second nav bar below this one.
  const detailMatchId = isMatchDetail ? matchIdFromPath(pathname, accountSlug) : null;
  const detailTabs: SectionTab[] = detailMatchId
    ? buildMatchDetailSectionTabs({
        accountSlug,
        matchId: detailMatchId,
        activeTabId: activeMatchDetailTab(pathname, detailMatchId),
      })
    : [];

  if (!me.isPending && !me.isError && !account) {
    return <NotFound />;
  }

  return (
    <ActiveMatchProvider>
      <ActiveChampionProvider>
        <MatchListReturnReset inSubtree={isInMatchesSubtree} />
        <ChampionListReturnReset inSubtree={isInChampionsSubtree} />
        <SeriousQueuesProvider>
          <MatchWindowProvider value={matchWindowValue}>
            <SectionShell
              headerRef={setHeaderEl}
              onHeaderRect={onHeaderRect}
              identity={
                <LolIdentity
                  account={account}
                  iconId={iconId}
                  level={level}
                  ddVersion={ddVersion}
                  avatarOnly={isMatchDetail}
                />
              }
              leading={
                detailMatchId ? (
                  <MatchesBreadcrumb accountSlug={accountSlug} matchId={detailMatchId} />
                ) : undefined
              }
              actions={
                isMatchDetail ? undefined : (
                  <div className="flex items-center gap-2">
                    {/* The Matches subtree shows every queue (it's a browse
                        surface), so the serious-queues preference has no
                        effect there — hide the icon to avoid implying it does. */}
                    {!isInMatchesSubtree && <SeriousQueuesSettings />}
                    <RefreshAccountButton account={account} />
                  </div>
                )
              }
              tabs={isMatchDetail ? detailTabs : lolSectionTabs}
              tabIndicatorId={
                isMatchDetail ? "match-detail-tab-indicator" : "lol-tab-indicator"
              }
              live={lolLive}
            >
              <Outlet />
            </SectionShell>
          </MatchWindowProvider>
        </SeriousQueuesProvider>
      </ActiveChampionProvider>
    </ActiveMatchProvider>
  );
}

// The section strip's leading slot on a match-detail page (Model 3). Stands in
// for section scope where the Matches tab used to be, and seeds the card-morph
// back-nav by capturing the origin match card's rect before navigating — same
// `setOriginRect` the match cards do on the way in, so the return reverses it.
function MatchesBreadcrumb({
  accountSlug,
  matchId,
}: { accountSlug: string; matchId: string }) {
  const { setOriginRect } = useActiveMatch();
  return (
    <Link
      to="/lol/$accountSlug/matches"
      params={{ accountSlug }}
      search={(prev: { queue?: number; count?: number }) => prev}
      onClick={() => {
        const heroEl = document.querySelector(`[data-match-card="${matchId}"]`);
        if (heroEl instanceof HTMLElement) {
          setOriginRect({
            matchId,
            rect: heroEl.getBoundingClientRect(),
            direction: "backward",
          });
        }
      }}
      className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      Matches
    </Link>
  );
}

function LolIdentity({
  account,
  iconId,
  level,
  ddVersion,
  avatarOnly = false,
}: {
  account: ReturnType<typeof useAccountFromSlug>;
  iconId: number | null | undefined;
  level: number | null | undefined;
  ddVersion: ReturnType<typeof useDDragonVersion>;
  // Match-detail trims identity to the avatar so the strip's tab row has room
  // for the detail sub-tabs; the `‹ Matches` breadcrumb + champion caption
  // carry the "whose match" context the name would otherwise supply.
  avatarOnly?: boolean;
}) {
  const { compact } = useSectionShellState();
  return (
    <section className="flex items-center gap-3">
      {iconId != null ? (
        <div className="relative shrink-0">
          <img
            src={profileIconUrl(iconId, ddVersion)}
            alt=""
            className={cn(
              "rounded-full object-cover ring-1 ring-border transition-all",
              compact ? "size-10" : "size-12"
            )}
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
      {avatarOnly ? null : account ? (
        // Account switching lives in the top-nav LoL picker (richer rows with
        // rank emblems); the section identity is a static header. Region is
        // omitted — single-region by design, and it'd only float between the
        // name and the tab row.
        <h2 className="text-xl font-semibold">
          {account.gameName}
          <span className="text-muted-foreground">#{account.tagLine}</span>
        </h2>
      ) : (
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      )}
    </section>
  );
}
