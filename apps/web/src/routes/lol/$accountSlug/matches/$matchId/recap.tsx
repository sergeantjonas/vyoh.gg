import { MatchRecapTab } from "@/lol/matches/match-detail-view";
import { useMatchTabProps } from "@/lol/matches/use-match-tab-props";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/recap")({
  component: MatchRecapRoute,
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
