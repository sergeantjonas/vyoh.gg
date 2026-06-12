import { routeMeta } from "@/lib/route-meta";
import { MatchRecapTab } from "@/lol/matches/match-detail-view";
import { matchOgImage } from "@/lol/matches/match-og";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/recap")({
  component: MatchRecapRoute,
  head: ({ params }) =>
    routeMeta({
      title: `Match recap · ${params.accountSlug} · vyoh.gg`,
      description: `Scoreboard and team recap for ${params.accountSlug}'s match on vyoh.gg`,
      ogImage: matchOgImage(params.accountSlug, params.matchId),
      ogType: "article",
    }),
});

function MatchRecapRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  if (!props) return null;
  return (
    <MatchRecapTab
      detail={props.detail}
      myPuuid={props.myPuuid}
      accountSlug={accountSlug}
    />
  );
}
