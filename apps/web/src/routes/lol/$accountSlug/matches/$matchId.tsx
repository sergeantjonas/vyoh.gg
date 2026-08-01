import { SectionTabRow } from "@/_shared/section-layout/section-nav";
import { SlidePanel } from "@/_shared/slide-panel";
import { Button } from "@/components/ui/button";
import { routeMeta } from "@/lib/route-meta";
import { toastError, toastSuccess } from "@/lib/toast";
import { useThemeColor } from "@/lib/use-theme-color";
import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useHeroScrolledPast } from "@/lol/_shared/analytics/use-hero-scrolled-past";
import { championHdSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { ChampionStickyStrip } from "@/lol/_shared/ui/champion-sticky-strip";
import { useChampionName } from "@/lol/champions/use-champions";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { MatchDetailSkeleton } from "@/lol/matches/match-detail-skeleton";
import {
  type MatchDetailTabId,
  activeMatchDetailTab,
  buildMatchDetailSectionTabs,
} from "@/lol/matches/match-detail-tabs";
import { MatchHero } from "@/lol/matches/match-hero";
import { matchOgImage } from "@/lol/matches/match-og";
import { useLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { matchDetailQueryOptions, useMatchDetail } from "@/lol/matches/use-match-detail";
import { useCachedMatchSummary } from "@/lol/matches/use-matches";
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type MatchSummary, formatLpDelta } from "@vyoh/shared";
import { Share2 } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Roughly the time the hero's layout-spring (stiffness 170, damping 30)
// takes to settle. The body gates on `bodyReady` (true immediately on
// VT browsers — the OLD snapshot covers the swap; false → flips at
// MORPH_SETTLE_MS on non-VT browsers, where the rect-morph fallback is
// running) so the skeleton holds across the morph window even when the
// query already has data cached, preventing a mid-flight content swap.
// No opacity wrapper around the body — see the comment at the body
// `<div className="flex flex-col gap-6">` below for the backdrop-filter
// reason.
const MORPH_SETTLE_MS = 700;

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId")({
  component: MatchDetailPanel,
  // Non-blocking on purpose — this fires the detail fetch during route
  // resolution (in parallel with the lazily-split component chunk) instead of
  // waiting for the component to mount and call `useMatchDetail`, but it does
  // not gate navigation on the response.
  //
  // `ensureQueryData` (awaited) is the textbook shape and is what the Start
  // migration's chunk 4 will need for server-priming, but it cannot land here
  // yet. Two things in this route break under a blocking loader:
  //
  //   1. `match-row.tsx` awaits `navigate()` *inside* `startViewTransition`, so
  //      the router holding navigation open until the fetch settles freezes the
  //      page under the VT snapshot for the whole request on Chrome/Safari.
  //   2. There is no `pendingComponent`/`errorComponent` on this route, so a
  //      blocking loader would skip `MatchDetailSkeleton` entirely (the query is
  //      no longer pending at mount) and a rejection would replace the whole
  //      SlidePanel subtree — tab strip, breadcrumb and close button included —
  //      with the router's bare catch-boundary text.
  //
  // Keeping it non-blocking preserves the progressive render (cached hero →
  // skeleton → content) and the in-component retry branch. Revisit when Start
  // chunk 4 lands, alongside the VT choreography in `match-row.tsx`.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(matchDetailQueryOptions(params.matchId));
  },
  // Static fallback drops the opaque matchId for a slug-scoped label; the
  // component enriches to `{Champion} {win|loss|remake} · {gameName#tagLine}`
  // once the match detail + account resolve.
  head: ({ params }) =>
    routeMeta({
      title: `Match · ${params.accountSlug} · vyoh.gg`,
      description: `Match detail for ${params.accountSlug} on vyoh.gg`,
      ogImage: matchOgImage(params.accountSlug, params.matchId),
      ogType: "article",
    }),
});

// The detail sub-tabs (Recap/Your game/Review/Timeline) and the `‹ Matches`
// breadcrumb now live in the always-on section strip (Model 3 — see
// $accountSlug.tsx); this layout only derives the active tab to pick the
// matching skeleton + caption.
function useActiveTab(matchId: string): MatchDetailTabId {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return activeMatchDetailTab(pathname, matchId);
}

function MatchDetailPanel() {
  const { accountSlug, matchId } = Route.useParams();
  const tab = useActiveTab(matchId);
  const account = useAccountFromSlug(accountSlug);
  const detail = useMatchDetail(matchId);
  const championName = useChampionName();
  const cachedSummary = useCachedMatchSummary(matchId);
  const lpDeltaMap = useLpDeltaMap();
  const lpDelta = lpDeltaMap.get(matchId);
  const navigate = useNavigate();
  const { activeMatch, setActiveMatch } = useActiveMatch();

  // Captured at first paint — if `activeMatch === matchId` at mount, the user
  // clicked this row from the list (handler set it pre-navigate). Cold
  // deep-link / refresh skips the slide so the panel just appears (per arc:
  // "the panel just *is*, in its open state").
  const skipSlideInRef = useRef(activeMatch !== matchId);

  // Cold arrival: write activeMatch from the URL so match-list's
  // scroll-to-row effect can fire. Idempotent — re-renders bail when
  // activeMatch already matches.
  useEffect(() => {
    if (activeMatch !== matchId) setActiveMatch(matchId);
  }, [activeMatch, matchId, setActiveMatch]);

  const [bodyReady, setBodyReady] = useState(() => supportsViewTransitions());
  useEffect(() => {
    if (supportsViewTransitions()) return;
    const id = window.setTimeout(() => setBodyReady(true), MORPH_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Captured below from SlidePanel.onScrollElReady so the hero-scroll
  // detection observes the panel's own scroll container — the hook runs in
  // this parent component, *above* SlidePanel's ScrollContainerProvider, so
  // the context fallback to <main> wouldn't fire correctly here.
  const [panelScrollEl, setPanelScrollEl] = useState<HTMLElement | null>(null);
  const [heroScrolledPast, heroRef] = useHeroScrolledPast(panelScrollEl);

  const myParticipant =
    detail.data && account
      ? detail.data.participants.find(
          (p) =>
            p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
            p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
        )
      : undefined;

  // Fall back to the row's cached champion (always present on warm row-click
  // navs) so the splash claim never momentarily resolves to `undefined`
  // while `detail` is loading. Without the fallback, the splash AnimatePresence
  // would briefly un-mount the previous champion's backdrop and re-mount it
  // again once detail.data resolves — reads as a 700ms flicker on top of
  // the panel-open transition.
  const splashChampion = myParticipant?.championName ?? cachedSummary?.champion;
  // SplashProvider splash claim intentionally NOT made from the panel — see
  // $championKey.tsx for the full rationale (SplashProvider's 700ms
  // multi-layer AnimatePresence crossfade is expensive enough that Chrome
  // visibly drops frames during the panel's open/close, and Firefox doesn't
  // because its compositor handles it). The panel's own `chromeBackdropUrl`
  // (below) carries the HD splash as a baked-in background image on the
  // panel chrome — no claim needed for that. Theme cascade is preserved via
  // `useThemeColor` directly so the global theme-color token follows the
  // panel's hero champion while the panel is open.
  useThemeColor(splashChampion ? championTheme(splashChampion).dominantHex : null);
  // Reuse the champion splash as the panel chrome backdrop so the panel
  // carries the same atmospheric energy as the global nav. Use the HD
  // variant (1920px wiki-served raw) rather than `backdrop` (smaller crop
  // sized for thumbnail / ambient washes): the panel chrome stretches the
  // image to ~900×full-viewport with no overlay blur to hide upsampling
  // artifacts, so the smaller asset would visibly soft-pixel.
  const ddVersion = useDDragonVersion();
  const chromeBackdropUrl = splashChampion
    ? championHdSplashUrl(splashChampion, ddVersion)
    : null;

  const heroSummary: MatchSummary | undefined =
    cachedSummary ??
    (detail.data && myParticipant
      ? {
          matchId: detail.data.matchId,
          queueId: detail.data.queueId,
          queueType: detail.data.queueType,
          champion: myParticipant.championName,
          kills: myParticipant.kills,
          deaths: myParticipant.deaths,
          assists: myParticipant.assists,
          win: myParticipant.win,
          durationSec: detail.data.durationSec,
          playedAt: detail.data.playedAt,
          remake: false,
          teamPosition: myParticipant.teamPosition,
          gameVersion: "",
          visionScore: myParticipant.visionScore,
          damageShare: myParticipant.damageShare,
          firstBloodKill: false,
          csAt10: 0,
          csAt15: 0,
          goldAt10: 0,
          goldAt15: 0,
          teamGoldDiffAt15: 0,
          teamGoldDiffSeries: [],
          deathTimings: [],
          deathXs: [],
          deathYs: [],
          killTimings: [],
          killXs: [],
          killYs: [],
          laneOpponent: null,
        }
      : undefined);

  useEffect(() => {
    if (!account || !heroSummary) return;
    const champion = championName(heroSummary.champion);
    const result = heroSummary.remake ? "remake" : heroSummary.win ? "win" : "loss";
    document.title = `${champion} ${result} · ${account.gameName}#${account.tagLine} · vyoh.gg`;
  }, [account, heroSummary, championName]);

  const panelTitle = heroSummary
    ? `${championName(heroSummary.champion)} ${heroSummary.remake ? "remake" : heroSummary.win ? "win" : "loss"}`
    : "Match detail";

  const handleShare = () => {
    const url = window.location.href;
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      toastError("Clipboard isn't available in this browser");
      return;
    }
    clipboard
      .writeText(url)
      .then(() => toastSuccess("Link copied to clipboard"))
      .catch(() => toastError("Couldn't copy link"));
  };

  const handleClose = () => {
    navigate({ to: "/lol/$accountSlug/matches", params: { accountSlug } });
  };

  const reduced = useReducedMotion();
  const detailTabs = buildMatchDetailSectionTabs({
    accountSlug,
    matchId,
    activeTabId: tab,
  });

  return (
    <SlidePanel
      open
      onClose={handleClose}
      title={panelTitle}
      skipSlideIn={skipSlideInRef.current}
      onScrollElReady={setPanelScrollEl}
      chromeBackdropUrl={chromeBackdropUrl}
      stickyBelowHeader={
        heroSummary ? (
          <ChampionStickyStrip
            visible={heroScrolledPast}
            championAlias={heroSummary.champion}
          >
            <div className="flex items-center gap-3">
              <ChampionSquareIcon
                championName={heroSummary.champion}
                className="size-6 rounded-sm"
              />
              <span className="text-sm font-medium">
                {championName(heroSummary.champion)}
              </span>
              {heroSummary.remake ? (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Remake
                </span>
              ) : (
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    heroSummary.win ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {heroSummary.win ? "Win" : "Loss"}
                </span>
              )}
              {!heroSummary.remake && lpDelta !== undefined && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    lpDelta > 0
                      ? "text-emerald-400"
                      : lpDelta < 0
                        ? "text-red-400"
                        : "text-muted-foreground"
                  )}
                >
                  {formatLpDelta(lpDelta)} LP
                </span>
              )}
              <span className="font-mono text-sm tabular-nums">
                <span className="text-emerald-400">{heroSummary.kills}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-red-400">{heroSummary.deaths}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-amber-400">{heroSummary.assists}</span>
              </span>
            </div>
          </ChampionStickyStrip>
        ) : undefined
      }
      header={
        <>
          <SectionTabRow
            tabs={detailTabs}
            indicatorId="match-detail-panel-tab-indicator"
            prefersReducedMotion={reduced}
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleShare}
            aria-label="Copy link to this match"
            className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 className="size-4" />
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-4">
        <div ref={heroRef}>
          {heroSummary && (
            <m.div
              animate={{
                opacity: heroScrolledPast ? 0 : 1,
                y: heroScrolledPast ? -8 : 0,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <MatchHero
                summary={heroSummary}
                lpDelta={lpDelta}
                accountSlug={accountSlug}
              />
            </m.div>
          )}
        </div>
        {/* Sub-tabs live in the panel header (see `header` slot above);
            this body just renders the active tab's content. `bodyReady`
            gates skeleton-vs-real so the morph window stays clean, but
            there is intentionally NO opacity wrapper here: any opacity < 1
            on an ancestor creates a group-opacity stacking context and
            flattens descendants into a single raster buffer, which kills
            every descendant `backdrop-filter` until the opacity reaches 1.
            That was the "transparent first, then suddenly frosted" pop the
            user reported. The skeleton swap below is enough visual cover
            for the rect-morph fallback window on non-VT browsers; the dim
            was redundant masking. */}
        <div className="flex flex-col gap-6">
          {!bodyReady || detail.isPending ? (
            // Hold the skeleton until the morph is done even if the query
            // already has data cached — swapping to the full detail view
            // mid-flight is the visual hitch the gate exists to absorb.
            <MatchDetailSkeleton tab={tab} />
          ) : detail.isError ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive">{detail.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
                Try again
              </Button>
            </div>
          ) : detail.data ? (
            // Keyed on `tab` so each sub-tab swap re-mounts and replays the
            // entrance. Transform-only (y, no opacity): the tab bodies carry
            // frosted tiles, and an opacity-animating ancestor would flatten
            // them into one buffer and kill their backdrop-filter mid-swap
            // (same group-opacity trap the body-wrapper comment above avoids).
            // A short slide settles the otherwise-instant content swap into
            // the panel's choreographed motion. AnimatePresence is deliberately
            // not used: <Outlet/> always renders the current route, so the
            // outgoing tab's subtree is already gone — there is nothing to
            // exit-animate. Entrance-only matches the app's mount-cascade idiom.
            <m.div
              key={tab}
              initial={reduced ? false : { y: 10 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            >
              <Outlet />
            </m.div>
          ) : null}
        </div>
      </div>
    </SlidePanel>
  );
}
