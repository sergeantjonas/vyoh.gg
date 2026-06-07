import { SectionTabRow } from "@/_shared/section-layout/section-nav";
import { SlidePanel } from "@/_shared/slide-panel";
import { Button } from "@/components/ui/button";
import { routeMeta } from "@/lib/route-meta";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useHeroScrolledPast } from "@/lol/_shared/analytics/use-hero-scrolled-past";
import { championHdSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useSplashChampion } from "@/lol/_shared/assets/splash-backdrop";
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
import { useLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { useMatchDetail } from "@/lol/matches/use-match-detail";
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
// takes to settle. The body (skeleton, error, full detail view) renders
// immediately at a low opacity so the page never looks empty, then
// blooms to full once the morph is in place — prevents the mid-flight
// pop when cached data is available immediately while still hinting at
// what's coming. VT browsers skip the gate (OLD snapshot freezes the
// previous DOM until NEW is captured, so there's nothing to pop into);
// the rect-morph fallback still needs it.
const MORPH_SETTLE_MS = 700;
const BODY_HOLD_OPACITY = 0.6;

const API_URL = "http://localhost:2010";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId")({
  component: MatchDetailPanel,
  // Static fallback drops the opaque matchId for a slug-scoped label; the
  // component enriches to `{Champion} {win|loss|remake} · {gameName#tagLine}`
  // once the match detail + account resolve.
  head: ({ params }) =>
    routeMeta({
      title: `Match · ${params.accountSlug} · vyoh.gg`,
      description: `Match detail for ${params.accountSlug} on vyoh.gg`,
      ogImage: `${API_URL}/og/match/${params.accountSlug}/${params.matchId}.png`,
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
  useSplashChampion(splashChampion);
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
            this body just renders the active tab's content. */}
        {/* When `bodyReady` is true at first render (VT-supporting browsers,
            the common case), match `initial` to `animate` so Motion runs
            no transition. Animating opacity from 0.6→1 creates a stacking
            context that suppresses `backdrop-filter` painting in EVERY
            descendant for the duration — that's the visible "frosted
            components are transparent first, then suddenly blurred" pop.
            The rect-morph fallback path (Safari, etc.) still needs the
            settle gate, so we animate only when `bodyReady` starts false. */}
        <m.div
          initial={{ opacity: bodyReady ? 1 : BODY_HOLD_OPACITY }}
          animate={{ opacity: bodyReady ? 1 : BODY_HOLD_OPACITY }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col gap-6"
        >
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
            <Outlet />
          ) : null}
        </m.div>
      </div>
    </SlidePanel>
  );
}
