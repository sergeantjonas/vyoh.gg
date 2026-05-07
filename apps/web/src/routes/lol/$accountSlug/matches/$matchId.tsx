import { Button } from "@/components/ui/button";
import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { useMatchDetail } from "@/identity/use-match-detail";
import { MatchDetailSkeleton } from "@/lol/match-detail-skeleton";
import { MatchDetailView } from "@/lol/match-detail-view";
import { createFileRoute } from "@tanstack/react-router";

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

  const myParticipant =
    detail.data && account
      ? detail.data.participants.find(
          (p) =>
            p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
            p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
        )
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      {detail.isPending && <MatchDetailSkeleton />}
      {detail.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{detail.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {detail.data && (
        <MatchDetailView
          detail={detail.data}
          currentChampion={myParticipant?.championName}
          myPuuid={myParticipant?.puuid}
        />
      )}
    </div>
  );
}
