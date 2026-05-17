import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { ItemIcon } from "@/lol/_shared/assets/item-icon";
import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { AbilityChangeList } from "@/lol/patches/ability-change-list";
import { ChangeKindGlyph } from "@/lol/patches/change-kind-glyph";
import { usePatchChanges } from "@/lol/patches/use-patch-changes";
import { usePatchList } from "@/lol/patches/use-patch-list";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import type {
  ChampionPatchChangeGroup,
  MatchSummary,
  PatchEntryChangeGroup,
} from "@vyoh/shared";
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

  const patchDateLabel = useMemo(() => {
    const iso = patchList?.find((p) => p.version === selectedVersion)?.patchDate;
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [patchList, selectedVersion]);

  const [myOnly, setMyOnly] = useState(false);

  const sortedChampions = useMemo(() => {
    if (!patchChanges?.champions) return [];
    // My champions float to the top in play-count order; everything else
    // falls into alpha order. localeCompare gives a stable display order
    // patch-over-patch even when champion names have accents.
    return [...patchChanges.champions].sort((a, b) => {
      const aCount = playCountByWikiName.get(a.champion) ?? 0;
      const bCount = playCountByWikiName.get(b.champion) ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.champion.localeCompare(b.champion);
    });
  }, [patchChanges, playCountByWikiName]);

  const visibleChampions = useMemo(() => {
    if (!myOnly) return sortedChampions;
    return sortedChampions.filter((g) => myChampions.has(g.champion));
  }, [myOnly, sortedChampions, myChampions]);

  const items = patchChanges?.items ?? [];
  const runes = patchChanges?.runes ?? [];

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
            {patchDateLabel ? ` · ${patchDateLabel}` : ""}
          </p>
          {patchList && patchList.length > 1 ? (
            <div className="flex items-center gap-2">
              {selectedVersion === newestVersion ? (
                <span className="text-xs text-muted-foreground/70">current</span>
              ) : null}
              <Select value={selectedVersion} onValueChange={onSelectVersion}>
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {patchList.map((p) => (
                    <SelectItem key={p.version} value={p.version}>
                      {p.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold leading-tight">Champion changes</h1>
        <p className="text-sm text-muted-foreground/80">
          {sortedChampions.length} champion{sortedChampions.length === 1 ? "" : "s"}{" "}
          changed this patch. Yours are ringed and sorted to the top.
        </p>
      </header>

      <div className="flex items-center justify-between border-y py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {visibleChampions.length} shown
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

      {visibleChampions.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {myOnly
            ? "None of your most-played champions were changed this patch."
            : "No champion changes for this patch."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleChampions.map((group) => (
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

      {items.length > 0 ? (
        <PatchEntrySection title="Item changes" groups={items} iconShape="square" />
      ) : null}
      {runes.length > 0 ? (
        <PatchEntrySection title="Rune changes" groups={runes} iconShape="circle" />
      ) : null}
    </div>
  );
}

function PatchEntrySection({
  title,
  groups,
  iconShape,
}: {
  title: string;
  groups: PatchEntryChangeGroup[];
  iconShape: "square" | "circle";
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border bg-card/30">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 p-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            "inline-block text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        >
          ›
        </span>
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {groups.length}
        </span>
      </button>
      {open ? (
        <ul className="divide-y border-t">
          {groups.map((group) => {
            return (
              <li key={group.name} className="flex gap-3 p-3">
                {group.iconUrl ? (
                  <ItemIcon
                    iconUrl={group.iconUrl}
                    alt={group.name}
                    className={cn(
                      "size-9 shrink-0",
                      iconShape === "circle" ? "rounded-full" : "rounded-md"
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "size-9 shrink-0 bg-muted/40",
                      iconShape === "circle" ? "rounded-full" : "rounded-md"
                    )}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{group.name}</h3>
                  <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {group.changes.map((line, i) => (
                      <li key={`${group.name}-${i}`} className="flex items-start gap-1.5">
                        <ChangeKindGlyph kind={line.changeType} />
                        <span className="min-w-0">{line.changeText}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
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
        <AbilityChangeList changes={group.changes} className="mt-1" />
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
