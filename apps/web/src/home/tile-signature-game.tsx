import { useMatches } from "@/lol/matches/use-matches";
import { RecapSignatureGame } from "@/lol/recap/recap-signature-game";
import type { LolAccount } from "@vyoh/shared";
import { useMemo } from "react";

function EmptyShell({ verdict }: { verdict: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Signature game
      </h3>
      <p className="text-base font-semibold leading-snug text-muted-foreground/70">
        {verdict}
      </p>
    </div>
  );
}

export function TileSignatureGame({ account }: { account: LolAccount | undefined }) {
  const query = useMatches(account);
  const matches = useMemo(
    () => (query.data ? query.data.pages.flat() : undefined),
    [query.data]
  );

  if (!account) return <EmptyShell verdict="No account connected yet." />;
  if (query.isPending && !matches) return <EmptyShell verdict="Loading recent play…" />;

  return <RecapSignatureGame matches={matches} accountSlug={account.slug} />;
}
