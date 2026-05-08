import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { useMatchDetail } from "@/identity/use-match-detail";
import { MatchDetailSkeleton } from "@/lol/match-detail-skeleton";
import { MatchDetailView } from "@/lol/match-detail-view";
import { MatchHero } from "@/lol/match-hero";
import { useChampionName } from "@/lol/use-champions";
import { useCachedMatchSummary } from "@/lol/use-matches";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { AnimatePresence, m } from "motion/react";
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

  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setBodyReady(true), MORPH_SETTLE_MS);
    return () => window.clearTimeout(id);
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

  const crumbLabel = heroSummary
    ? `${new Date(heroSummary.playedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} — ${championName(heroSummary.champion)}`
    : "Match";

  return (
    <div className="flex flex-col gap-6">
      <m.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to="/lol/$accountSlug/matches"
                  params={{ accountSlug }}
                  search={(prev) => prev}
                >
                  Matches
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={crumbLabel}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="inline-block"
                  >
                    {crumbLabel}
                  </m.span>
                </AnimatePresence>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </m.div>
      {heroSummary && <MatchHero summary={heroSummary} />}
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
