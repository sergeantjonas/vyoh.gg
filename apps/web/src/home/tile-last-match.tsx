import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useMatches } from "@/lol/matches/use-matches";
import { Link } from "@tanstack/react-router";
import type { LolAccount } from "@vyoh/shared";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EmptyShell({ verdict }: { verdict: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Last match
      </h3>
      <p className="text-base font-semibold leading-snug text-muted-foreground/70">
        {verdict}
      </p>
    </div>
  );
}

export function TileLastMatch({ account }: { account: LolAccount | undefined }) {
  const query = useMatches(account);
  const championName = useChampionName();

  if (!account) return <EmptyShell verdict="No account connected yet." />;
  if (query.isPending) return <EmptyShell verdict="Loading recent play…" />;

  const latest = query.data?.pages[0]?.find((m) => !m.remake);
  if (!latest) return <EmptyShell verdict="No recent games tracked." />;

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Last match
      </h3>
      <Link
        to="/lol/$accountSlug/matches/$matchId"
        params={{ accountSlug: account.slug, matchId: latest.matchId }}
        className="group flex items-center gap-3"
      >
        <ChampionSquareIcon
          championName={latest.champion}
          alt={championName(latest.champion)}
          className="size-10 shrink-0 rounded-md ring-1 ring-border/60"
        />
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-base font-semibold leading-snug text-foreground/90 group-hover:text-foreground">
            {latest.win ? "Win" : "Loss"} on {championName(latest.champion)}
          </p>
          <p className="text-xs text-muted-foreground">
            {latest.kills}/{latest.deaths}/{latest.assists} ·{" "}
            {formatRelative(latest.playedAt)}
          </p>
        </div>
      </Link>
    </div>
  );
}
