import { routeMeta } from "@/lib/route-meta";
import { MatchTimelineTab } from "@/lol/matches/match-detail-view";
import { matchOgImage } from "@/lol/matches/match-og";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/timeline")({
  component: MatchTimelineRoute,
  head: ({ params }) =>
    routeMeta({
      title: `Match timeline · ${params.accountSlug} · vyoh.gg`,
      description: `Objective and event timeline for ${params.accountSlug}'s match on vyoh.gg`,
      ogImage: matchOgImage(params.accountSlug, params.matchId),
      ogType: "article",
    }),
});

function MatchTimelineRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  if (!props) return null;
  return <MatchTimelineTab detail={props.detail} myPuuid={props.myPuuid} />;
}
