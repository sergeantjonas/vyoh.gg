import { MatchYourGameTab } from "@/lol/matches/match-detail-view";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/your-game")({
  component: MatchYourGameRoute,
});

function MatchYourGameRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  if (!props) return null;
  return <MatchYourGameTab detail={props.detail} myPuuid={props.myPuuid} />;
}
