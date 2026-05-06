import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useMe } from "@/identity/use-me";
import { MatchList } from "@/lol/match-list";
import { MatchListSkeleton } from "@/lol/match-list-skeleton";
import { useMatches } from "@/lol/use-matches";

export const Route = createFileRoute("/lol/matches/")({
  component: MatchesPage,
});

function MatchesPage() {
  const me = useMe();
  const account = me.data?.lol[0];
  const matches = useMatches(account);

  return (
    <div className="flex flex-col gap-4">
      {matches.isPending && account && <MatchListSkeleton />}
      {matches.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{matches.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => matches.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
      {matches.data && <MatchList matches={matches.data} />}
    </div>
  );
}
