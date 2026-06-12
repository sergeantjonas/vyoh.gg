import { routeMeta } from "@/lib/route-meta";
import { MatchYourGameTab } from "@/lol/matches/match-detail-view";
import { matchOgImage } from "@/lol/matches/match-og";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/your-game")({
  component: MatchYourGameRoute,
  head: ({ params }) =>
    routeMeta({
      title: `Your game · ${params.accountSlug} · vyoh.gg`,
      description: `Personal performance breakdown for ${params.accountSlug}'s match on vyoh.gg`,
      ogImage: matchOgImage(params.accountSlug, params.matchId),
      ogType: "article",
    }),
});

function MatchYourGameRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  if (!props) return null;
  return <MatchYourGameTab detail={props.detail} myPuuid={props.myPuuid} />;
}
