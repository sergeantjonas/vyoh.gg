import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { ChangeKindGlyph } from "@/lol/patches/change-kind-glyph";
import { usePatchChanges } from "@/lol/patches/use-patch-changes";
import { usePatchList } from "@/lol/patches/use-patch-list";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import type { ChampionPatchChangeGroup, MatchSummary } from "@vyoh/shared";
import { useMemo, useState } from "react";

interface PatchesSearch {
  patch?: string;
}

export const Route = createFileRoute("/lol/$accountSlug/patches")({
  component: PatchesPage,
  validateSearch: (search: Record<string, unknown>): PatchesSearch => {
    const raw = search.patch;
    return {
      patch: typeof raw === "string" && raw.length > 0 ? raw : undefined,
    };
  },
});

function PatchesPage() {
  const { matches } = useMatchWindow();
  const championName = useChampionName();
  const championAliasFromName = useChampionAliasFromName();
  // Gate derivation on the CDragon champion map being loaded; pre-load,
  // `championName` returns the raw Riot alias which won't match the
  // wiki-name keys the API stores against. See `useChampions` for the
  // canonical name → wiki-name mapping.
  const championsReady = useChampions().isSuccess;

  const playCountByWikiName = useMemo(() => {
    if (!matches || !championsReady) return new Map<string, number>();
    return buildPlayCounts(matches, championName);
  }, [matches, championsReady, championName]);

  const myChampions = useMemo(
    () => new Set(playCountByWikiName.keys()),
    [playCountByWikiName]
  );

  const { data: patchList } = usePatchList();
  const navigate = useNavigate();
  const { patch: searchPatch } = useSearch({ from: "/lol/$accountSlug/patches" });
  const newestVersion = patchList?.[0]?.version ?? null;
  // `?patch=` overrides; absent → newest. We strip the param on selection
  // when the newest patch is picked so shareable URLs stay clean.
  const selectedVersion = searchPatch ?? newestVersion;
  const { data: patchChanges, isPending: changesPending } =
    usePatchChanges(selectedVersion);

  const [myOnly, setMyOnly] = useState(false);

  const sortedGroups = useMemo(() => {
    if (!patchChanges?.changes) return [];
    // My champions float to the top in play-count order; everything else
    // falls into alpha order. localeCompare gives a stable display order
    // patch-over-patch even when champion names have accents.
    return [...patchChanges.changes].sort((a, b) => {
      const aCount = playCountByWikiName.get(a.champion) ?? 0;
      const bCount = playCountByWikiName.get(b.champion) ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.champion.localeCompare(b.champion);
    });
  }, [patchChanges, playCountByWikiName]);

  const visibleGroups = useMemo(() => {
    if (!myOnly) return sortedGroups;
    return sortedGroups.filter((g) => myChampions.has(g.champion));
  }, [myOnly, sortedGroups, myChampions]);

  // Loading rhythm: patches haven't synced yet, list is in flight, or the
  // changes query for the selected version is in flight. A single skeleton
  // block keeps the tab from flashing empty before data lands.
  if (!patchChanges && (patchList === undefined || changesPending)) {
    return <PatchesLoading />;
  }

  if (!selectedVersion || !patchChanges?.patchVersion) {
    return <PatchesEmpty />;
  }

  const onSelectVersion = (next: string) => {
    // Newest = "current" — drop the param so the URL stays canonical.
    const nextPatch = next === newestVersion ? undefined : next;
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, patch: nextPatch }),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-12">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
            Patch {patchChanges.patchVersion}
          </p>
          {patchList && patchList.length > 1 ? (
            <Select value={selectedVersion} onValueChange={onSelectVersion}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {patchList.map((p, i) => (
                  <SelectItem key={p.version} value={p.version}>
                    {p.version}
                    {i === 0 ? " · current" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold leading-tight">Champion changes</h1>
        <p className="text-sm text-muted-foreground/80">
          {sortedGroups.length} champion{sortedGroups.length === 1 ? "" : "s"} changed
          this patch. Yours are ringed and sorted to the top.
        </p>
      </header>

      <div className="flex items-center justify-between border-y py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {visibleGroups.length} shown
        </span>
        <button
          type="button"
          onClick={() => setMyOnly((p) => !p)}
          aria-pressed={myOnly}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-xs transition-colors",
            myOnly
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          My champions only
        </button>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {myOnly
            ? "None of your most-played champions were changed this patch."
            : "No champion changes for this patch."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleGroups.map((group) => (
            <li key={group.champion}>
              <ChampionRow
                group={group}
                aliasFromName={championAliasFromName}
                isMyChampion={myChampions.has(group.champion)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampionRow({
  group,
  aliasFromName,
  isMyChampion,
}: {
  group: ChampionPatchChangeGroup;
  aliasFromName: (n: string) => string;
  isMyChampion: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card/30 p-3">
      <ChampionSquareIcon
        championName={aliasFromName(group.champion)}
        alt={group.champion}
        className={cn(
          "size-12 shrink-0 rounded-md",
          isMyChampion && "ring-2 ring-primary/60 ring-offset-2 ring-offset-card/30"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{group.champion}</h3>
          {isMyChampion ? (
            <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Yours
            </span>
          ) : null}
        </div>
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {group.changes.map((line, i) => (
            <li key={`${group.champion}-${i}`} className="flex items-start gap-1.5">
              <ChangeKindGlyph kind={line.changeType} />
              <span className="min-w-0">
                {line.ability ? (
                  <span className="text-foreground/80">{line.ability}: </span>
                ) : null}
                {line.changeText}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PatchesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-12">
      <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-32 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-32 animate-pulse rounded-lg bg-muted/30" />
    </div>
  );
}

function PatchesEmpty() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 py-24">
      <p className="text-sm text-muted-foreground">
        No patches synced yet. Check back after the next sync window.
      </p>
    </div>
  );
}

function buildPlayCounts(
  matches: MatchSummary[],
  resolve: (alias: string) => string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.remake) continue;
    const wikiName = resolve(m.champion);
    counts.set(wikiName, (counts.get(wikiName) ?? 0) + 1);
  }
  return counts;
}
