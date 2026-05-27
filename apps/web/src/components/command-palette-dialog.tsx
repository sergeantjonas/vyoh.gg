import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import { buildChips, buildSteamChips } from "@/components/command-palette-chips";
import { matchesQuery } from "@/components/command-palette-matcher";
import { CommandPalettePreview } from "@/components/command-palette-preview";
import {
  type RecentItem,
  type RecentKind,
  deriveRecentsScope,
  loadRecents,
  recordRecent,
} from "@/components/command-palette-recents";
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
  type SteamOwnedGames,
  excludeRemakes,
  nameMatchesQuery,
  parseMatchQuery,
  parsePaletteVerb,
  parseSteamLibraryQuery,
} from "@vyoh/shared";
import {
  Crown,
  History,
  Home,
  Loader2,
  ScrollText,
  Swords,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { type KeyboardEvent, useLayoutEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Module-scope platform check mirrors the `nav.tsx` shortcut-label pattern
// so the chord hint reads `⌘↵` on macOS, `Ctrl ↵` elsewhere.
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const chordHint = isMac ? "⌘↵" : "Ctrl ↵";

// Sentinel prefix on Account row `value` strings — lets the chord handler
// distinguish a highlighted Account row from any other group's row without
// reverse-mapping the value back to a slug. The same `<type>:<id> ...`
// shape is used by champion/match/steam-game rows so
// `parsePaletteValue` (see command-palette-preview-value.ts) can dispatch
// the focused row to the matching preview content component.
const ACCOUNT_VALUE_PREFIX = "account:";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function recentIcon(kind: RecentKind) {
  switch (kind) {
    case "page":
      return <Home className="size-4" />;
    case "account":
      return <User className="size-4" />;
    case "tab":
      return <History className="size-4" />;
    case "champion":
      return <Crown className="size-4" />;
    case "match":
      return <Swords className="size-4" />;
  }
}

export default function CommandPaletteDialog({ open, onOpenChange }: Props) {
  const me = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentSlug = pathname.match(/^\/lol\/([^/]+)/)?.[1];
  // Steam grammar is only meaningful under the Steam subtree. The dialog
  // dispatches by route scope (per the F-chunk pattern) — outside `/steam`
  // the Steam parser short-circuits to an empty result.
  const isSteamScope = pathname.startsWith("/steam");
  const queryClient = useQueryClient();

  const currentAccount = me.data?.lol.find(
    (a) => a.slug.toLowerCase() === currentSlug?.toLowerCase()
  );

  const championName = useChampionName();
  const champions = useChampions();
  const [allMatches, setAllMatches] = useState<MatchSummary[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [input, setInput] = useState("");
  const [recents, setRecents] = useState<RecentItem[]>([]);
  // Highlighted item value, lifted out of cmdk so the chord handler on the
  // input can branch on which row Enter would have selected. cmdk normalises
  // this to the first existing item when the prior value disappears, so we
  // never need to clear it manually as the filtered list shifts.
  const [highlighted, setHighlighted] = useState("");

  const recentsScope = deriveRecentsScope(pathname);

  useLayoutEffect(() => {
    if (!open) return;
    setRecents(loadRecents(recentsScope));
  }, [open, recentsScope]);

  // Corrective scroll pass. cmdk's built-in scrollIntoView lands short on
  // both Blink and WebKit in this DOM topology — the selected row's
  // bottom edge ends up below the cmdk-list viewport even when there's
  // plenty of scroll room left. Runs after cmdk's own effect (we're the
  // parent component) and compares the selected row's rect against the
  // list's; if the row is out of bounds, set scrollTop directly.
  useLayoutEffect(() => {
    if (!open || !highlighted) return;
    const list = document.querySelector<HTMLElement>("[cmdk-list]");
    const row = document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]');
    if (!list || !row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < listRect.top) {
      list.scrollTop -= listRect.top - rowRect.top;
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTop += rowRect.bottom - listRect.bottom;
    }
  }, [open, highlighted]);

  const parsed = useMemo(() => parseMatchQuery(input), [input]);
  const steamParsed = useMemo(() => parseSteamLibraryQuery(input), [input]);
  const chips = useMemo(
    () => [
      ...buildChips(input, parsed),
      ...(isSteamScope ? buildSteamChips(steamParsed) : []),
    ],
    [input, parsed, steamParsed, isSteamScope]
  );
  // Navigation verbs (`/patches …`) are a separate grammar from the
  // match-filter verbs above — they drive cross-page routing, not match
  // filtering, so they don't feed chips and they short-circuit the
  // result-list display below.
  const paletteVerb = useMemo(() => parsePaletteVerb(input), [input]);

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

  const hasSteamStructuredVerbs =
    isSteamScope &&
    (steamParsed.devs.length > 0 ||
      steamParsed.pubs.length > 0 ||
      steamParsed.franchises.length > 0);

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

  function go(item: RecentItem) {
    recordRecent(recentsScope, item);
    onOpenChange(false);
    // biome-ignore lint/suspicious/noExplicitAny: palette navigates by raw path
    navigate({ to: item.path as any });
  }

  // ⌘↵ / Ctrl↵ on a highlighted Account row → jump into that account's
  // matches. cmdk's `onSelect` doesn't expose the original event, so the
  // chord has to ride the input's keydown.
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    if (!event.metaKey && !event.ctrlKey) return;
    if (!highlighted.startsWith(ACCOUNT_VALUE_PREFIX)) return;
    const slug = highlighted.slice(ACCOUNT_VALUE_PREFIX.length).split(" ")[0];
    const acc = (me.data?.lol ?? []).find((a) => a.slug === slug);
    if (!acc) return;
    event.preventDefault();
    go({
      path: `/lol/${acc.slug}/matches`,
      label: `Search matches in ${acc.gameName}#${acc.tagLine}`,
      kind: "tab",
    });
  }

  // When a navigation verb (`/patches …`) is parsed, all other groups —
  // including the Matches list — collapse so the palette reads as a single
  // routed destination. The chip / match-filter groups would be visual
  // noise relative to that intent.
  const showVerbDestinationsOnly = paletteVerb !== null;

  // Non-Matches groups are hidden once any structured verb is in play —
  // `with:nidalee` should not surface Pages/Accounts, only Matches — and
  // also when a navigation verb is in play. Steam grammar (`dev:`, `pub:`,
  // `franchise:`) collapses the same chrome under `/steam`.
  const showNonMatchGroups =
    !hasStructuredVerbs && !hasSteamStructuredVerbs && !showVerbDestinationsOnly;

  // Default slug for verbs that omit `@<slug>`: the first known LoL
  // account on `useMe()`. Mirrors the nav-dropdown fallback in Chunk 2 so
  // the palette and the dropdown agree on "my default account."
  const defaultAccountSlug = me.data?.lol?.[0]?.slug ?? null;
  const patchesAsSlug =
    (paletteVerb?.kind === "patches" ? paletteVerb.asSlug : null) ?? defaultAccountSlug;
  const patchesBase =
    paletteVerb?.kind === "patches" && paletteVerb.version
      ? `/lol/patches/${paletteVerb.version}`
      : "/lol/patches";
  const patchesPath = patchesAsSlug ? `${patchesBase}?as=${patchesAsSlug}` : patchesBase;
  const patchesLabel =
    paletteVerb?.kind === "patches" && paletteVerb.version
      ? `Patches · ${paletteVerb.version}`
      : "Patches";
  const showGlobalLol =
    showVerbDestinationsOnly ||
    (showNonMatchGroups && passesFreeText("patches global lol"));

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

  // Steam library group: read the owned-games query cache directly per the
  // cache-hit-before-fetch invariant (architecture note in command-palette.md).
  // Empty list is the natural "library not loaded yet" state — the palette
  // doesn't surface a load affordance for Steam because the library lands on
  // first /steam route mount and stale-time keeps it warm.
  const steamGames = useMemo(() => {
    if (!isSteamScope) return [];
    const cached = queryClient.getQueryData<SteamOwnedGames>(["steam", "owned-games"]);
    if (!cached) return [];
    const filtered = cached.games.filter((g) => {
      for (const dev of steamParsed.devs) {
        if (!nameMatchesQuery(g.developerNames, dev)) return false;
      }
      for (const pub of steamParsed.pubs) {
        if (!nameMatchesQuery(g.publisherNames, pub)) return false;
      }
      for (const fr of steamParsed.franchises) {
        if (!nameMatchesQuery(g.franchiseNames, fr)) return false;
      }
      if (steamParsed.freeText) {
        const hay =
          `${g.name} ${g.developerNames.join(" ")} ${g.publisherNames.join(" ")} ${g.franchiseNames.join(" ")}`.toLowerCase();
        if (!hay.includes(steamParsed.freeText)) return false;
      }
      return true;
    });
    return filtered.slice(0, 8);
  }, [isSteamScope, queryClient, steamParsed]);

  const showSteamGames =
    isSteamScope &&
    (hasSteamStructuredVerbs || (parsed.freeText.length > 0 && steamGames.length > 0));

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
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      value={highlighted}
      onValueChange={setHighlighted}
    >
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <CommandInput
        placeholder="Type a command or search…"
        value={input}
        onValueChange={setInput}
        onKeyDown={handleInputKeyDown}
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

        {!input.trim() && recents.length > 0 && (
          <CommandGroup heading="Recent">
            {recents.map((r) => (
              <CommandItem
                key={r.path}
                value={`${r.kind} ${r.path}`}
                onSelect={() => go(r)}
              >
                {recentIcon(r.kind)}
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showNonMatchGroups && pages.length > 0 && (
          <CommandGroup heading="Pages">
            {pages.map((p) => (
              <CommandItem
                key={p.value}
                value={p.value}
                onSelect={() => go({ path: p.path, label: p.label, kind: "page" })}
              >
                {p.icon} {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showNonMatchGroups && accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {accounts.flatMap((acc) => {
              const items = [
                <CommandItem
                  key={acc.slug}
                  value={`${ACCOUNT_VALUE_PREFIX}${acc.slug} ${acc.gameName} ${acc.tagLine}`}
                  onSelect={() =>
                    go({
                      path: `/lol/${acc.slug}`,
                      label: `${acc.gameName}#${acc.tagLine}`,
                      kind: "account",
                    })
                  }
                >
                  <User />
                  <span>
                    {acc.gameName}
                    <span className="text-muted-foreground">#{acc.tagLine}</span>
                  </span>
                  <CommandShortcut>{chordHint} matches</CommandShortcut>
                </CommandItem>,
              ];
              // Companion "Search matches in <id>" row is kept only when
              // freeText is non-empty — at idle the chord+hint chip is the
              // discoverable path. On touch / no-keyboard, typing the
              // account name surfaces the companion so the scope-switch flow
              // stays reachable without a chord.
              if (parsed.freeText.length > 0) {
                items.push(
                  <CommandItem
                    key={`${acc.slug}-search`}
                    value={`search matches in ${acc.gameName} ${acc.tagLine} ${acc.slug}`}
                    onSelect={() =>
                      go({
                        path: `/lol/${acc.slug}/matches`,
                        label: `Search matches in ${acc.gameName}#${acc.tagLine}`,
                        kind: "tab",
                      })
                    }
                  >
                    <Swords className="size-4" />
                    <span className="text-muted-foreground">Search matches in</span>
                    <span>
                      {acc.gameName}
                      <span className="text-muted-foreground">#{acc.tagLine}</span>
                    </span>
                  </CommandItem>
                );
              }
              return items;
            })}
          </CommandGroup>
        )}

        {showNonMatchGroups && currentTabs.length > 0 && (
          <CommandGroup heading="Current account">
            {currentTabs.map((t) => (
              <CommandItem
                key={t.value}
                value={t.value}
                onSelect={() => go({ path: t.path, label: t.label, kind: "tab" })}
              >
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
                  value={`champion:${c.alias} ${c.alias} ${c.name.toLowerCase()}`}
                  onSelect={() =>
                    go({
                      path: `/lol/${currentSlug}/champions/${c.alias}`,
                      label: c.name,
                      kind: "champion",
                    })
                  }
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

        {showSteamGames && steamGames.length > 0 && (
          <CommandGroup heading="Steam library">
            {steamGames.map((g) => (
              <CommandItem
                key={g.appid}
                value={`steam-game:${g.appid} steam ${g.name.toLowerCase()} ${g.appid}`}
                onSelect={() =>
                  go({
                    path: `/steam/game/${g.appid}`,
                    label: g.name,
                    kind: "page",
                  })
                }
              >
                <SteamIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.developerNames[0] && (
                  <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">
                    {g.developerNames[0]}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showGlobalLol && (
          <CommandGroup heading="Global LoL">
            <CommandItem
              value={`patches global lol ${patchesLabel.toLowerCase()}`}
              onSelect={() =>
                go({ path: patchesPath, label: patchesLabel, kind: "page" })
              }
            >
              <ScrollText className="size-4" />
              <span>{patchesLabel}</span>
            </CommandItem>
          </CommandGroup>
        )}

        {currentAccount && !showVerbDestinationsOnly && !hasSteamStructuredVerbs && (
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
                  value={`match:${match.matchId} ${match.champion.toLowerCase()} ${match.win ? "wins" : "losses"} ${match.queueType.toLowerCase()} ${match.matchId}`}
                  onSelect={() =>
                    go({
                      path: `/lol/${currentSlug}/matches/${match.matchId}`,
                      label: `${championName(match.champion)} ${match.kills}/${match.deaths}/${match.assists} ${match.queueType}`,
                      kind: "match",
                    })
                  }
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
      <CommandPalettePreview value={highlighted} />
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
