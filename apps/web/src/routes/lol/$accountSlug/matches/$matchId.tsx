import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ChampionStickyStrip } from "@/lol/_shared/champion-sticky-strip";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useHeroScrolledPast } from "@/lol/_shared/use-hero-scrolled-past";
import { useChampionName } from "@/lol/champions/use-champions";
import { MatchDetailSkeleton } from "@/lol/matches/match-detail-skeleton";
import { MatchDetailView } from "@/lol/matches/match-detail-view";
import { MatchHero } from "@/lol/matches/match-hero";
import { useLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { useMatchDetail } from "@/lol/matches/use-match-detail";
import { useCachedMatchSummary } from "@/lol/matches/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useState } from "react";

// Roughly the time the hero's layout-spring (stiffness 170, damping 30)
// takes to settle. The body (skeleton, error, full detail view) renders
// immediately at a low opacity so the page never looks empty, then
// blooms to full once the morph is in place — prevents the mid-flight
// pop when cached data is available immediately while still hinting at
// what's coming.
const MORPH_SETTLE_MS = 700;
const BODY_HOLD_OPACITY = 0.6;

const API_URL = "http://localhost:2010";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId")({
  component: MatchDetailPage,
  head: ({ params }) => {
    const ogImage = `${API_URL}/og/match/${params.accountSlug}/${params.matchId}.png`;
    const title = `Match ${params.matchId} · vyoh.gg`;
    const description = `Match detail for ${params.accountSlug} on vyoh.gg`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "400" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
});

function MatchDetailPage() {
  const { accountSlug, matchId } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const detail = useMatchDetail(matchId);
  const championName = useChampionName();
  const cachedSummary = useCachedMatchSummary(matchId);
  const lpDeltaMap = useLpDeltaMap();
  const lpDelta = lpDeltaMap.get(matchId);

  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setBodyReady(true), MORPH_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  const [heroScrolledPast, heroRef] = useHeroScrolledPast();

  const myParticipant =
    detail.data && account
      ? detail.data.participants.find(
          (p) =>
            p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
            p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
        )
      : undefined;

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
          laneOpponent: null,
        }
      : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div ref={heroRef}>
        {heroSummary && (
          <m.div
            animate={{
              opacity: heroScrolledPast ? 0 : 1,
              y: heroScrolledPast ? -8 : 0,
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <MatchHero summary={heroSummary} lpDelta={lpDelta} />
          </m.div>
        )}
      </div>
      {heroSummary && (
        <ChampionStickyStrip
          visible={heroScrolledPast}
          top="var(--account-header-h)"
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
                {lpDelta > 0 ? "+" : ""}
                {lpDelta} LP
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
      )}
      <m.div
        initial={{ opacity: BODY_HOLD_OPACITY }}
        animate={{ opacity: bodyReady ? 1 : BODY_HOLD_OPACITY }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        {!bodyReady || detail.isPending ? (
          // Hold the skeleton until the morph is done even if the query
          // already has data cached — swapping to the full detail view
          // mid-flight is the visual hitch the gate exists to absorb.
          <MatchDetailSkeleton />
        ) : detail.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-destructive">{detail.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
              Try again
            </Button>
          </div>
        ) : detail.data ? (
          <MatchDetailView
            detail={detail.data}
            currentChampion={myParticipant?.championName}
            myPuuid={myParticipant?.puuid}
          />
        ) : null}
      </m.div>
    </div>
  );
}
