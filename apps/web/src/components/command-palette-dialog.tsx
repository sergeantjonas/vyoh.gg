import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import { buildChips } from "@/components/command-palette-chips";
import { matchesQuery } from "@/components/command-palette-matcher";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/identity/use-me";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName, useChampions } from "@/lol/champions/use-champions";
import { prefetchCachedMatches } from "@/lol/matches/use-matches";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  type CachedMatchesResult,
  type MatchSummary,
  excludeRemakes,
  parseMatchQuery,
} from "@vyoh/shared";
import { Crown, History, Home, Loader2, Swords, TrendingUp, User, X } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";

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
  const champions = useChampions();
  const [allMatches, setAllMatches] = useState<MatchSummary[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [input, setInput] = useState("");

  const parsed = useMemo(() => parseMatchQuery(input), [input]);
  const chips = useMemo(() => buildChips(input, parsed), [input, parsed]);

  const filteredMatches = useMemo(
    () => (allMatches ? allMatches.filter((m) => matchesQuery(m, parsed)) : null),
    [allMatches, parsed]
  );

  const hasStructuredVerbs =
    parsed.outcome !== null ||
    parsed.withChampions.length > 0 ||
    parsed.vsChampions.length > 0 ||
    parsed.queues.length > 0 ||
    parsed.roles.length > 0 ||
    parsed.patches.length > 0 ||
    parsed.duos.length > 0 ||
    parsed.since !== null ||
    parsed.until !== null ||
    parsed.kdaGt !== null ||
    parsed.kdaLt !== null;

  function passesFreeText(haystack: string): boolean {
    if (!parsed.freeText) return true;
    return haystack.toLowerCase().includes(parsed.freeText);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setInput("");
    onOpenChange(next);
  }

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
    setAllMatches(data ? excludeRemakes(data.pages.flatMap((p) => p.matches)) : null);
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
    setAllMatches(data ? excludeRemakes(data.pages.flatMap((p) => p.matches)) : null);
    setLoadingMatches(false);
  }

  function go(path: string) {
    onOpenChange(false);
    // biome-ignore lint/suspicious/noExplicitAny: palette navigates by raw path
    navigate({ to: path as any });
  }

  // Non-Matches groups are hidden once any structured verb is in play —
  // `with:nidalee` should not surface Pages/Accounts, only Matches.
  const showNonMatchGroups = !hasStructuredVerbs;

  const pages = [
    { value: "home", icon: <Home />, label: "Home", path: "/" },
    {
      value: "lol league",
      icon: <LeagueOfLegendsIcon className="size-4" />,
      label: "League of Legends",
      path: "/lol",
    },
    {
      value: "steam",
      icon: <SteamIcon className="size-4" />,
      label: "Steam",
      path: "/steam",
    },
  ].filter((p) => passesFreeText(p.value));

  const accounts = (me.data?.lol ?? []).filter((acc) =>
    passesFreeText(`${acc.gameName} ${acc.tagLine} ${acc.slug}`)
  );

  const championList =
    currentSlug && champions.data
      ? (() => {
          const entries: { alias: string; name: string; haystack: string }[] = [];
          for (const [alias, info] of champions.data) {
            entries.push({
              alias,
              name: info.name,
              haystack: `${info.name.toLowerCase()} ${alias}`,
            });
          }
          return entries
            .filter((c) => passesFreeText(c.haystack))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 6);
        })()
      : [];

  const currentTabs = currentSlug
    ? [
        {
          value: `${currentSlug} profile overview`,
          icon: <User />,
          label: "Profile",
          path: `/lol/${currentSlug}`,
        },
        {
          value: `${currentSlug} matches history`,
          icon: <History />,
          label: "Matches",
          path: `/lol/${currentSlug}/matches`,
        },
        {
          value: `${currentSlug} trends stats`,
          icon: <TrendingUp />,
          label: "Trends",
          path: `/lol/${currentSlug}/trends`,
        },
        {
          value: `${currentSlug} champions mastery`,
          icon: <Crown />,
          label: "Champions",
          path: `/lol/${currentSlug}/champions`,
        },
      ].filter((t) => passesFreeText(t.value))
    : [];

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <CommandInput
        placeholder="Type a command or search…"
        value={input}
        onValueChange={setInput}
      />
      {chips.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 border-b px-3 py-2"
          aria-label="Active filters"
        >
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setInput(chip.remove(input))}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>{chip.label}</span>
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {showNonMatchGroups && pages.length > 0 && (
          <CommandGroup heading="Pages">
            {pages.map((p) => (
              <CommandItem key={p.value} value={p.value} onSelect={() => go(p.path)}>
                {p.icon} {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showNonMatchGroups && accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {accounts.map((acc) => (
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

        {showNonMatchGroups && currentTabs.length > 0 && (
          <CommandGroup heading="Current account">
            {currentTabs.map((t) => (
              <CommandItem key={t.value} value={t.value} onSelect={() => go(t.path)}>
                {t.icon} {t.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showNonMatchGroups &&
          currentSlug &&
          parsed.freeText &&
          championList.length > 0 && (
            <CommandGroup heading="Champions">
              {championList.map((c) => (
                <CommandItem
                  key={c.alias}
                  value={`${c.alias} ${c.name.toLowerCase()}`}
                  onSelect={() => go(`/lol/${currentSlug}/champions/${c.alias}`)}
                >
                  <ChampionSquareIcon
                    championName={c.alias}
                    className="size-5 rounded-sm"
                  />
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

        {currentAccount && (
          <CommandGroup heading="Matches">
            {filteredMatches === null ? (
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
              filteredMatches.slice(0, 8).map((match) => (
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
