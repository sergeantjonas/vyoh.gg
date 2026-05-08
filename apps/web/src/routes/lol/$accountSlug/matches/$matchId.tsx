import { Button } from "@/components/ui/button";
import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { championIconUrl } from "@/lol/_shared/champion-icon";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { championCardStyle } from "@/lol/champions/champion-card";
import { useChampionName } from "@/lol/champions/use-champions";
import { MatchDetailSkeleton } from "@/lol/matches/match-detail-skeleton";
import { MatchDetailView } from "@/lol/matches/match-detail-view";
import { MatchHero } from "@/lol/matches/match-hero";
import { useMatchDetail } from "@/lol/matches/use-match-detail";
import { useCachedMatchSummary } from "@/lol/matches/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setBodyReady(true), MORPH_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  const heroRef = useRef<HTMLDivElement>(null);
  const [heroScrolledPast, setHeroScrolledPast] = useState(false);
  const [stripTop, setStripTop] = useState(96);
  const [stripRight, setStripRight] = useState(0);

  useLayoutEffect(() => {
    const headerEl = document.querySelector(
      "[data-account-header]"
    ) as HTMLElement | null;
    if (headerEl) setStripTop(headerEl.getBoundingClientRect().bottom);
    const mainEl = mainScrollRef.current;
    if (mainEl) setStripRight(mainEl.offsetWidth - mainEl.clientWidth);
  }, []);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!heroRef.current) return;
      const headerEl = document.querySelector(
        "[data-account-header]"
      ) as HTMLElement | null;
      const headerBottom = headerEl?.getBoundingClientRect().bottom ?? 96;
      setStripTop(headerBottom);
      setStripRight(el.offsetWidth - el.clientWidth);
      const heroTop = heroRef.current.getBoundingClientRect().top;
      setHeroScrolledPast(heroTop < headerBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
        }
      : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div ref={heroRef}>
        {heroSummary && (
          <AnimatePresence initial={false}>
            {heroScrolledPast ? (
              <div key="spacer" className="h-28" />
            ) : (
              <m.div
                key="hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <MatchHero summary={heroSummary} />
              </m.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <AnimatePresence>
        {heroScrolledPast && heroSummary && (
          <m.div
            key="champion-strip"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            style={{
              ...championCardStyle(heroSummary.champion),
              top: stripTop,
              right: stripRight,
            }}
            className="fixed left-0 z-30 border-b border-border/50 bg-background/50 backdrop-blur-md"
          >
            <div className="mx-auto max-w-4xl px-6 py-2">
              <div className="flex items-center gap-3">
                <img
                  src={championIconUrl(heroSummary.champion)}
                  alt=""
                  className="size-6 rounded-sm object-cover"
                />
                <span className="text-sm font-medium">
                  {championName(heroSummary.champion)}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    heroSummary.win ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {heroSummary.win ? "Win" : "Loss"}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  <span className="text-emerald-400">{heroSummary.kills}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-red-400">{heroSummary.deaths}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-amber-400">{heroSummary.assists}</span>
                </span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
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
