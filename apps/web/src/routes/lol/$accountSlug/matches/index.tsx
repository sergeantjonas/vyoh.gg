import { Button } from "@/components/ui/button";
import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { MatchList } from "@/lol/match-list";
import { MatchListSkeleton } from "@/lol/match-list-skeleton";
import { useMatches } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/")({
  component: MatchesPage,
});

function MatchesPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const matches = useMatches(account);

  return (
    <div className="flex flex-col gap-4">
      {matches.isPending && account && <MatchListSkeleton />}
      {matches.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{matches.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => matches.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {matches.data && <MatchList matches={matches.data} accountSlug={accountSlug} />}
    </div>
  );
}
