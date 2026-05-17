import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useMe } from "@/identity/use-me";
import { cn } from "@/lib/utils";
import { useChampionName } from "@/lol/champions/use-champions";
import { prefetchCachedMatches } from "@/lol/matches/use-matches";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { CachedMatchesResult, MatchSummary } from "@vyoh/shared";
import { Crown, History, Home, Loader2, Swords, TrendingUp, User } from "lucide-react";
import { useLayoutEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommandPaletteDialog({ open, onOpenChange }: Props) {
  const me = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentSlug = pathname.match(/^\/lol\/([^/]+)/)?.[1];
  const queryClient = useQueryClient();

  const currentAccount = me.data?.lol.find(
    (a) => a.slug.toLowerCase() === currentSlug?.toLowerCase()
  );

  const championName = useChampionName();
  const [allMatches, setAllMatches] = useState<MatchSummary[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useLayoutEffect(() => {
    if (!open || !currentAccount) {
      setAllMatches(null);
      return;
    }
    const data = queryClient.getQueryData<InfiniteData<CachedMatchesResult>>([
      "lol",
      "matches-cached-infinite",
      currentAccount.region,
      currentAccount.gameName,
      currentAccount.tagLine,
      undefined,
    ]);
    setAllMatches(
      data ? data.pages.flatMap((p) => p.matches).filter((m) => !m.remake) : null
    );
  }, [open, currentAccount, queryClient]);

  async function handleLoadMatches() {
    if (!currentAccount) return;
    setLoadingMatches(true);
    await prefetchCachedMatches(queryClient, currentAccount);
    const data = queryClient.getQueryData<InfiniteData<CachedMatchesResult>>([
      "lol",
      "matches-cached-infinite",
      currentAccount.region,
      currentAccount.gameName,
      currentAccount.tagLine,
      undefined,
    ]);
    setAllMatches(
      data ? data.pages.flatMap((p) => p.matches).filter((m) => !m.remake) : null
    );
    setLoadingMatches(false);
  }

  function go(path: string) {
    onOpenChange(false);
    // biome-ignore lint/suspicious/noExplicitAny: palette navigates by raw path
    navigate({ to: path as any });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem value="home" onSelect={() => go("/")}>
            <Home /> Home
          </CommandItem>
          <CommandItem value="lol league" onSelect={() => go("/lol")}>
            <LeagueOfLegendsIcon className="size-4" /> League of Legends
          </CommandItem>
          <CommandItem value="steam" onSelect={() => go("/steam")}>
            <SteamIcon className="size-4" /> Steam
          </CommandItem>
        </CommandGroup>

        {me.data?.lol && me.data.lol.length > 0 && (
          <CommandGroup heading="Accounts">
            {me.data.lol.map((acc) => (
              <CommandItem
                key={acc.slug}
                value={`${acc.gameName} ${acc.tagLine} ${acc.slug}`}
                onSelect={() => go(`/lol/${acc.slug}`)}
              >
                <User />
                <span>
                  {acc.gameName}
                  <span className="text-muted-foreground">#{acc.tagLine}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {currentSlug && (
          <CommandGroup heading="Current account">
            <CommandItem
              value={`${currentSlug} profile overview`}
              onSelect={() => go(`/lol/${currentSlug}`)}
            >
              <User /> Profile
            </CommandItem>
            <CommandItem
              value={`${currentSlug} matches history`}
              onSelect={() => go(`/lol/${currentSlug}/matches`)}
            >
              <History /> Matches
            </CommandItem>
            <CommandItem
              value={`${currentSlug} trends stats`}
              onSelect={() => go(`/lol/${currentSlug}/trends`)}
            >
              <TrendingUp /> Trends
            </CommandItem>
            <CommandItem
              value={`${currentSlug} champions mastery`}
              onSelect={() => go(`/lol/${currentSlug}/champions`)}
            >
              <Crown /> Champions
            </CommandItem>
          </CommandGroup>
        )}

        {currentAccount && (
          <CommandGroup heading="Matches">
            {allMatches === null ? (
              <>
                <CommandItem disabled value="matches-not-loaded">
                  <Swords className="size-4" />
                  <span className="text-muted-foreground">
                    Match history not loaded yet
                  </span>
                </CommandItem>
                <CommandItem
                  value="load matches history"
                  onSelect={handleLoadMatches}
                  disabled={loadingMatches}
                >
                  {loadingMatches ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <History className="size-4" />
                  )}
                  Load matches
                </CommandItem>
              </>
            ) : (
              allMatches.slice(0, 8).map((match) => (
                <CommandItem
                  key={match.matchId}
                  value={`${match.champion.toLowerCase()} ${match.win ? "wins" : "losses"} ${match.queueType.toLowerCase()} ${match.matchId}`}
                  onSelect={() => go(`/lol/${currentSlug}/matches/${match.matchId}`)}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      match.win ? "bg-emerald-400" : "bg-rose-400"
                    )}
                    aria-hidden
                  />
                  <Swords className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {championName(match.champion)}
                  </span>
                  <span className="ml-2 flex shrink-0 gap-3 text-xs text-muted-foreground">
                    <span>
                      {match.kills}/{match.deaths}/{match.assists}
                    </span>
                    <span>{match.queueType}</span>
                    <span>{relativeTime(match.playedAt)}</span>
                  </span>
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-end border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          Press{" "}
          <CommandShortcut className="ml-1 rounded border bg-muted/50 px-1.5 py-0.5">
            ⌘K
          </CommandShortcut>{" "}
          anywhere
        </span>
      </div>
    </CommandDialog>
  );
}
