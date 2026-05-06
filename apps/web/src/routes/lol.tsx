import { Button } from "@/components/ui/button";
import { useMe } from "@/identity/use-me";
import { MatchList } from "@/lol/match-list";
import { MatchListSkeleton } from "@/lol/match-list-skeleton";
import { useMatches } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol")({
  component: LolPage,
});

function LolPage() {
  const me = useMe();
  const account = me.data?.lol[0];
  const matches = useMatches(account);

  return (
    <div className="flex flex-col gap-6">
      {me.isError && <p className="text-sm text-destructive">{me.error.message}</p>}

      {account && (
        <section className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            {account.gameName}
            <span className="text-muted-foreground">#{account.tagLine}</span>
          </h2>
          <span className="text-sm uppercase text-muted-foreground">
            {account.region}
          </span>
        </section>
      )}

      {matches.isPending && account && <MatchListSkeleton />}
      {matches.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{matches.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => matches.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {matches.data && <MatchList matches={matches.data} />}
    </div>
  );
}
