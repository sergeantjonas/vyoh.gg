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
import { type ShareableChapter, shareChapterCard } from "@/home/recap/share-chapter-card";
import { useMe } from "@/identity/use-me";
import { clearMatchHighlights, paintMatchHighlights } from "@/lib/highlight-matches";
import { useAudio } from "@/lib/use-audio";
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
  type SteamWishlist,
  type WishlistPaletteTarget,
  excludeRemakes,
  nameMatchesQuery,
  parseMatchQuery,
  parsePaletteVerb,
  parseSteamLibraryQuery,
  parseWishlistQuery,
  queueLabel,
} from "@vyoh/shared";
import {
  CalendarClock,
  Crown,
  Fingerprint,
  Gamepad2,
  History,
  Home,
  Library,
  ListChecks,
  Loader2,
  ScrollText,
  Share2,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

// The two destinations `parseWishlistQuery` resolves. Keyed by its `target` so a
// keyword and the bare-head "offer both" case read the same descriptor, and the
// `value` strings keep the pre-split phrasing the palette taught (`wishlist
// upcoming`) even though it now routes elsewhere.
const WISHLIST_DESTINATIONS = {
  wishlist: {
    value: "wishlist all",
    label: "Wishlist",
    path: "/steam/wishlist",
    icon: <ListChecks className="size-4" />,
  },
  upcoming: {
    value: "wishlist upcoming",
    label: "Upcoming releases",
    path: "/steam/upcoming",
    icon: <CalendarClock className="size-4" />,
  },
} as const satisfies Record<
  WishlistPaletteTarget,
  { value: string; label: string; path: string; icon: ReactNode }
>;

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
  const audio = useAudio();
  const [allMatches, setAllMatches] = useState<MatchSummary[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [input, setInput] = useState("");
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
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
  // plenty of scroll room left. Deferred to rAF so cmdk's own write has
  // landed first. Reads the selected row's rect against the list's and
  // sets scrollTop directly when out of bounds, with a small headroom
  // so the row doesn't sit flush against the viewport edge.
  useLayoutEffect(() => {
    if (!open || !highlighted) return;
    const id = requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>("[cmdk-list]");
      const row = document.querySelector<HTMLElement>(
        '[cmdk-item][aria-selected="true"]'
      );
      if (!list || !row) return;
      const listRect = list.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const headroom = 8;
      if (rowRect.top < listRect.top + headroom) {
        list.scrollTop -= listRect.top + headroom - rowRect.top;
      } else if (rowRect.bottom > listRect.bottom - headroom) {
        list.scrollTop += rowRect.bottom + headroom - listRect.bottom;
      }
    });
    return () => cancelAnimationFrame(id);
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
  // Steam wishlist grammar (`wishlist`, `wishlist upcoming|all`, `wishlist
  // <name>`) — a separate navigation/name-search verb. Like `/patches` it
  // routes rather than match-filters, so it collapses the other groups below.
  const wishlistQuery = useMemo(() => parseWishlistQuery(input), [input]);

  const filteredMatches = useMemo(
    () => (allMatches ? allMatches.filter((m) => matchesQuery(m, parsed)) : null),
    [allMatches, parsed]
  );

  // C2 — tint matched substrings in result rows via the CSS Custom Highlight
  // API (see lib/highlight-matches.ts). The needle is the free-text residual
  // (`passesFreeText` matches the same lowercased substring), so structured
  // verbs like `win`/`with:Jax` don't paint stray highlights. Recompute when
  // the needle changes; a MutationObserver catches async row arrival
  // (infinite-loaded matches, champion/steam data) while the needle is stable.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const needle = parsed.freeText ?? "";
    paintMatchHighlights(list, needle);
    const observer = new MutationObserver(() => paintMatchHighlights(list, needle));
    observer.observe(list, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearMatchHighlights();
    };
  }, [open, parsed.freeText]);

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
    audio.play("palette.select");
    onOpenChange(false);
    // No cast needed: `to` widens to string for a non-literal argument, and
    // no route-union type could apply here anyway. Palette paths arrive
    // already resolved, some carry query strings, and some come back out of
    // localStorage via loadRecents().
    navigate({ to: item.path });
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
      label: `${acc.gameName}#${acc.tagLine} — matches`,
      kind: "account",
    });
  }

  // When a global verb (`/patches …`, `/share …`, `wishlist …`) is parsed,
  // all other groups — including the Matches list — collapse so the palette
  // reads as a single resolved intent. The chip / match-filter groups would
  // be visual noise relative to that intent.
  const showVerbDestinationsOnly = paletteVerb !== null || wishlistQuery !== null;

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
  // Scoped to the patches verb specifically — the wishlist verb and the
  // `/share` kind below must not surface the Patches entry.
  const showGlobalLol =
    paletteVerb?.kind === "patches" ||
    (showNonMatchGroups && passesFreeText("patches global lol"));

  // `/share …` is an action verb, not a navigation one: selecting an entry
  // hands the chapter's OG card to the share ladder instead of routing. The
  // card titles mirror what the chapter mastheads pass to ChapterShareButton.
  const ownerGameName = me.data?.lol?.[0]?.gameName ?? null;
  const shareTargets: {
    chapter: ShareableChapter;
    value: string;
    label: string;
    title: string;
  }[] = [
    {
      chapter: "champion",
      value: "share ahri chapter card",
      label: "Ahri chapter card",
      title: ownerGameName ? `${ownerGameName}'s Ahri` : "Ahri chapter",
    },
    {
      chapter: "conclusion",
      value: "share player portrait card",
      label: "Player portrait card",
      title: ownerGameName ? `${ownerGameName}'s portrait` : "Player portrait",
    },
  ];
  const shareVerb = paletteVerb?.kind === "share" ? paletteVerb : null;
  const visibleShareTargets = shareVerb
    ? shareTargets.filter(
        (t) => shareVerb.chapter === null || t.chapter === shareVerb.chapter
      )
    : shareTargets.filter((t) => passesFreeText(t.value));
  const showShare =
    shareVerb !== null || (showNonMatchGroups && visibleShareTargets.length > 0);

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
    !showVerbDestinationsOnly &&
    (hasSteamStructuredVerbs || (parsed.freeText.length > 0 && steamGames.length > 0));

  // Wishlist navigation entries: a bare `wishlist` offers both routes; a keyword
  // resolves the single destination. These work from any scope (pure navigation,
  // like `/patches`) — no cache needed.
  const wishlistNavEntries =
    wishlistQuery && !wishlistQuery.query
      ? (wishlistQuery.target
          ? [wishlistQuery.target]
          : (["upcoming", "wishlist"] as const)
        ).map((target) => WISHLIST_DESTINATIONS[target])
      : [];

  // Wishlist name search: read the wishlist query cache directly per the
  // cache-hit-before-fetch invariant. The cache is warm under /steam (the
  // profile chip fetches it); an empty list is the natural cold-cache state,
  // so no Load affordance is surfaced. Each hit deep-links to the list route
  // with `?appid`, which scrolls to and highlights that row.
  const wishlistMatches = useMemo(() => {
    if (!wishlistQuery || !wishlistQuery.query) return [];
    const cached = queryClient.getQueryData<SteamWishlist>(["steam", "wishlist"]);
    if (!cached) return [];
    const needle = wishlistQuery.query;
    return cached.items
      .filter((it) => (it.name ?? "").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [wishlistQuery, queryClient]);

  const showWishlist =
    wishlistQuery !== null &&
    (wishlistNavEntries.length > 0 || wishlistMatches.length > 0);

  const steamAppid = isSteamScope
    ? (pathname.match(/^\/steam\/library\/([^/]+)/)?.[1] ?? null)
    : null;
  const steamGameTitle = steamAppid
    ? (queryClient
        .getQueryData<SteamOwnedGames>(["steam", "owned-games"])
        ?.games.find((g) => String(g.appid) === steamAppid)?.name ?? null)
    : null;

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
    : isSteamScope
      ? [
          {
            // "genres" and "backlog" because the page is more often looked for
            // by what it says than by its name.
            value: "steam portrait genres backlog anti-portrait",
            icon: <Fingerprint />,
            label: "Portrait",
            path: "/steam/portrait",
          },
          {
            value: "steam library games",
            icon: <Library />,
            label: "Library",
            path: "/steam/library",
          },
          {
            value: "steam wishlist",
            icon: <ListChecks />,
            label: "Wishlist",
            path: "/steam/wishlist",
          },
          {
            // "releases" and "calendar" because the page is looked for by what
            // it shows at least as often as by its name.
            value: "steam upcoming releases calendar pre-orders",
            icon: <CalendarClock />,
            label: "Upcoming",
            path: "/steam/upcoming",
          },
          {
            value: "steam achievements trophies",
            icon: <Trophy />,
            label: "Achievements",
            path: "/steam/achievements",
          },
          ...(steamAppid
            ? [
                {
                  value: `steam game ${steamAppid} ${steamGameTitle ?? ""}`.trim(),
                  icon: <Gamepad2 />,
                  label: steamGameTitle ? `Game: ${steamGameTitle}` : "Game",
                  path: `/steam/library/${steamAppid}`,
                },
              ]
            : []),
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
      <CommandList ref={listRef}>
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

        {showNonMatchGroups && currentTabs.length > 0 && (
          <CommandGroup heading={currentSlug ? "Current account" : "Current section"}>
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

        {showNonMatchGroups && passesFreeText("toggle sound audio mute") && (
          <CommandGroup heading="Actions">
            <CommandItem
              value="toggle sound audio mute"
              onSelect={() => {
                const next = !audio.enabled;
                audio.setEnabled(next);
                if (next) audio.play("palette.select");
                onOpenChange(false);
              }}
            >
              {audio.enabled ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
              <span>{audio.enabled ? "Disable sound" : "Enable sound"}</span>
              <CommandShortcut>⇧ M</CommandShortcut>
            </CommandItem>
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
                    path: `/steam/library/${g.appid}`,
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

        {showWishlist && (
          <CommandGroup heading="Steam wishlist">
            {wishlistNavEntries.map((e) => (
              <CommandItem
                key={e.path}
                value={e.value}
                onSelect={() => go({ path: e.path, label: e.label, kind: "tab" })}
              >
                {e.icon}
                <span>{e.label}</span>
              </CommandItem>
            ))}
            {wishlistMatches.map((it) => (
              <CommandItem
                key={it.appid}
                value={`wishlist-game:${it.appid} ${(it.name ?? "").toLowerCase()} ${it.appid}`}
                onSelect={() =>
                  go({
                    path: `/steam/wishlist?appid=${it.appid}`,
                    label: it.name ?? `Wishlisted app ${it.appid}`,
                    kind: "page",
                  })
                }
              >
                <SteamIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {it.name ?? `Unknown title (app ${it.appid})`}
                </span>
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

        {showShare && (
          <CommandGroup heading="Share">
            {visibleShareTargets.map((t) => (
              <CommandItem
                key={t.chapter}
                value={t.value}
                onSelect={() => {
                  audio.play("palette.select");
                  onOpenChange(false);
                  // The outcome surfaces in OS chrome (share sheet, download
                  // bar); nothing to await from the palette's side.
                  void shareChapterCard(t.chapter, t.title);
                }}
              >
                <Share2 className="size-4" />
                <span>{t.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {currentAccount &&
          !showVerbDestinationsOnly &&
          !hasSteamStructuredVerbs &&
          (parsed.freeText ||
            hasStructuredVerbs ||
            (allMatches && allMatches.length > 0)) && (
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
                    value={`match:${match.matchId} ${match.champion.toLowerCase()} ${match.win ? "wins" : "losses"} ${queueLabel(match.queueId).toLowerCase()} ${match.matchId}`}
                    onSelect={() =>
                      go({
                        path: `/lol/${currentSlug}/matches/${match.matchId}`,
                        label: `${championName(match.champion)} ${match.kills}/${match.deaths}/${match.assists} ${queueLabel(match.queueId)}`,
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
                      <span>{queueLabel(match.queueId)}</span>
                      <span>{relativeTime(match.playedAt)}</span>
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}
      </CommandList>
      <CommandPalettePreview value={highlighted} matches={allMatches} />
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
