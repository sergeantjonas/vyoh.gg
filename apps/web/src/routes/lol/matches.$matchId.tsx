import { Button } from "@/components/ui/button";
import { useMatchDetail } from "@/identity/use-match-detail";
import { MatchDetailView } from "@/lol/match-detail-view";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/matches/$matchId")({
  component: MatchDetailPage,
});

function MatchDetailPage() {
  const { matchId } = Route.useParams();
  const detail = useMatchDetail(matchId);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/lol/matches"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to matches
      </Link>

      {detail.isPending && (
        <p className="text-sm text-muted-foreground">Loading match…</p>
      )}
      {detail.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{detail.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {detail.data && <MatchDetailView detail={detail.data} />}
    </div>
  );
}
