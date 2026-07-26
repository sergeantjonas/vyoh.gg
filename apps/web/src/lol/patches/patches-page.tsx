import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { itemIconUrl, runeIconUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { ItemIcon } from "@/lol/_shared/assets/item-icon";
import { useSplashChampion } from "@/lol/_shared/assets/splash-backdrop";
import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { AbilityChangeList } from "@/lol/patches/ability-change-list";
import { ChangeKindGlyph } from "@/lol/patches/change-kind-glyph";
import { usePatchChanges } from "@/lol/patches/use-patch-changes";
import { usePatchList } from "@/lol/patches/use-patch-list";
import { useNavigate } from "@tanstack/react-router";
import type {
  ChampionPatchChangeGroup,
  MatchSummary,
  PatchEntryChangeGroup,
} from "@vyoh/shared";
import { excludeRemakes } from "@vyoh/shared";
import { type CSSProperties, useMemo, useState } from "react";

// Default count for the personalized play-count window. Mirrors the account
// layout's DEFAULT_COUNT — we just need a stable recent window to derive
// "your most-played champions" for the play-count sort, not the full history.
const PERSONALIZED_MATCH_COUNT = 20;

export function PatchesPage({
  versionParam,
  asSlug,
}: {
  versionParam: string | undefined;
  asSlug: string | undefined;
}) {
  // Personalized mode is gated on `asSlug` being present. When absent, the
  // page renders neutrally: no match fetch, no play-count sort, no toggle.
  const account = useAccountFromSlug(asSlug ?? "");
  const matchesQuery = useCachedMatchesWindow(
    asSlug ? account : undefined,
    PERSONALIZED_MATCH_COUNT
  );
  const matches: MatchSummary[] | undefined = asSlug
    ? matchesQuery.data?.matches
    : undefined;
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
  const newestVersion = patchList?.[0]?.version ?? null;
  // Path segment overrides; absent → newest. Selecting the newest patch
  // navigates back to the unversioned route so shareable URLs stay clean.
  const selectedVersion = versionParam ?? newestVersion;
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

  // Page-wide splash claim keyed to the headline champion — the owner's
  // most-played changed champion under the `?as=` lens, else the alpha-first
  // change. One backdrop layer through the existing SplashProvider crossfade,
  // so the cost is O(1) regardless of how many champions a patch touches.
  // Gated on championsReady: pre-load, aliasFromName falls back to the wiki
  // display name, which isn't a valid splash asset key.
  const headlineChampion = sortedChampions[0]?.champion ?? null;
  useSplashChampion(
    championsReady && headlineChampion ? championAliasFromName(headlineChampion) : null
  );

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

  const resolvedPatch: string = patchChanges.patchVersion;

  const onSelectVersion = (next: string) => {
    // Preserve `?as=` across version navigation so the personalized lens
    // survives picking a different patch. Newest patch routes to the bare
    // index for shareable URLs ("the current patch").
    const search = asSlug ? { as: asSlug } : {};
    if (next === newestVersion) {
      navigate({ to: "/lol/patches", search });
    } else {
      navigate({
        to: "/lol/patches/$version",
        params: { version: next },
        search,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-12">
      {/* Mount cascade: header text fades in via the shared stagger-in
          (opacity is safe on bare text), the three frosted cards below ride
          the frost-safe translate-only variant on the same `--i` clock. */}
      <header className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between gap-3"
          data-mount-stagger=""
          style={{ "--i": 0 } as CSSProperties}
        >
          <p
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60"
            style={{ viewTransitionName: "patches-header" }}
          >
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
        <h1
          className="text-2xl font-semibold leading-tight"
          data-mount-stagger=""
          style={{ "--i": 1 } as CSSProperties}
        >
          Champion changes
        </h1>
        <p
          className="text-sm text-muted-foreground/80"
          data-mount-stagger=""
          style={{ "--i": 2 } as CSSProperties}
        >
          {sortedChampions.length} champion{sortedChampions.length === 1 ? "" : "s"}{" "}
          changed this patch
          {asSlug ? ". Yours are ringed and sorted to the top." : "."}
        </p>
      </header>

      {/* One frosted card carries the whole champion list: a single
          backdrop-blur layer regardless of how many champions the patch
          touches (a 26.3-sized patch has 41). Rows inside are bare divide-y
          rows — frosting each row would scale blur-layer count with patch
          size, and nesting bordered rows inside a chromed wrapper violates
          the chrome-composition rule. The toolbar persists as the card's
          header strip even when the filter empties the list, so the
          "My champions only" toggle stays reachable to untoggle. */}
      <section
        className="overflow-hidden rounded-lg border bg-card/60 backdrop-blur-sm"
        data-mount-stagger-frosted=""
        style={{ "--i": 3 } as CSSProperties}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {visibleChampions.length} shown
          </span>
          {asSlug ? (
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
          ) : null}
        </div>

        {visibleChampions.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            {myOnly
              ? "None of your most-played champions were changed this patch."
              : "No champion changes for this patch."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {visibleChampions.map((group) => {
              const alias = championAliasFromName(group.champion);
              return (
                <li
                  key={group.champion}
                  // CV-gate row content so a 40-champion patch doesn't paint
                  // every ability changelist up front — same pattern as
                  // champion-table rows. The intrinsic-size estimate matches
                  // a typical two-change row; CV only uses it while the row
                  // is off-screen, so drift is invisible.
                  className="[content-visibility:auto] [contain-intrinsic-size:auto_96px]"
                  style={{ viewTransitionName: `patches-champion-${alias}` }}
                >
                  <ChampionRow
                    group={group}
                    aliasFromName={championAliasFromName}
                    isMyChampion={myChampions.has(group.champion)}
                    patch={resolvedPatch}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {items.length > 0 ? (
        <PatchEntrySection
          title="Item changes"
          groups={items}
          iconShape="square"
          patch={resolvedPatch}
          kind="item"
          staggerIndex={4}
        />
      ) : null}
      {runes.length > 0 ? (
        <PatchEntrySection
          title="Rune changes"
          groups={runes}
          iconShape="circle"
          patch={resolvedPatch}
          kind="rune"
          staggerIndex={5}
        />
      ) : null}
    </div>
  );
}

function PatchEntrySection({
  title,
  groups,
  iconShape,
  patch,
  kind,
  staggerIndex,
}: {
  title: string;
  groups: PatchEntryChangeGroup[];
  iconShape: "square" | "circle";
  patch: string;
  kind: "item" | "rune";
  // Slot in the page mount cascade (frost-safe translate-only variant).
  staggerIndex: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    // Frosted: the collapsible faces the page-wide splash directly. Content
    // is default-closed, so the blur region is one header strip until opened.
    <section
      className="overflow-hidden rounded-lg border bg-card/60 backdrop-blur-sm"
      data-mount-stagger-frosted=""
      style={{ "--i": staggerIndex } as CSSProperties}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 p-3 text-left transition-colors hover:bg-card/50"
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
            const iconUrl =
              group.entityId !== null
                ? kind === "item"
                  ? itemIconUrl(group.entityId, patch)
                  : runeIconUrl(group.entityId, patch)
                : null;
            return (
              <li key={group.name} className="flex gap-3 p-3">
                {iconUrl ? (
                  <ItemIcon
                    iconUrl={iconUrl}
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
  patch,
}: {
  group: ChampionPatchChangeGroup;
  aliasFromName: (n: string) => string;
  isMyChampion: boolean;
  patch: string;
}) {
  return (
    // Hover is a scan aid for long changelists, not a click affordance —
    // rows aren't interactive, so no cursor-pointer and no lift. The tint
    // stays in the glass family (heavier glass over the /60 card), same
    // emphasis idiom as champion-patch-history's current-patch tile.
    <div className="flex gap-3 p-3 transition-colors hover:bg-card/40">
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
        <AbilityChangeList
          changes={group.changes}
          championId={group.championId}
          patch={patch}
          className="mt-1"
        />
      </div>
    </div>
  );
}

function PatchesLoading() {
  return (
    // Mirrors the loaded layout: header block, one tall champion-list card,
    // two collapsed entry-section bars (items / runes).
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-12">
      <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-64 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-11 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-11 animate-pulse rounded-lg bg-muted/30" />
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
  for (const m of excludeRemakes(matches)) {
    const wikiName = resolve(m.champion);
    counts.set(wikiName, (counts.get(wikiName) ?? 0) + 1);
  }
  return counts;
}
