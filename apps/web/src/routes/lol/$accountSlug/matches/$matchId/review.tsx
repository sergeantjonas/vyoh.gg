import { ChartBoundary } from "@/components/error-boundary";
import { routeMeta } from "@/lib/route-meta";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { matchOgImage } from "@/lol/matches/match-og";
import { MatchReviewView } from "@/lol/matches/match-review-view";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import { useCachedMatchSummary } from "@/lol/matches/use-matches";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/review")({
  component: MatchReviewRoute,
  head: ({ params }) =>
    routeMeta({
      title: `Match review · ${params.accountSlug} · vyoh.gg`,
      description: `Phase-by-phase review of ${params.accountSlug}'s match on vyoh.gg`,
      ogImage: matchOgImage(params.accountSlug, params.matchId),
      ogType: "article",
    }),
});

function MatchReviewRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  const account = useAccountFromSlug(accountSlug);
  const timeline = useMatchTimeline(matchId);
  const summary = useCachedMatchSummary(matchId);
  if (!props) return null;
  return (
    <ChartBoundary>
      <MatchReviewView
        account={account}
        detail={props.detail}
        myPuuid={props.myPuuid}
        summary={summary}
        timeline={timeline.data}
      />
    </ChartBoundary>
  );
}
