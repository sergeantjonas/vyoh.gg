import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { AbilityChangeList } from "@/lol/patches/ability-change-list";
import { useCurrentPatchChanges } from "@/lol/patches/use-current-patch-changes";
import { Separator } from "@/components/ui/separator";
import type { MatchSummary } from "@vyoh/shared";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TOP_N = 5;
const MAX_LINES_PER_CHAMPION = 6;
const STORAGE_PREFIX = "vyoh:patch-notice-dismissed:";

// Pick the user's most-played wiki champion names from the current match
// window. Riot's internal aliases (e.g. "MonkeyKing", "LeeSin") are
// resolved to the wiki display name ("Wukong", "Lee Sin") so the API can
// match against `ChampionPatchChange.championKey` verbatim.
function topWikiChampions(
  matches: MatchSummary[],
  resolve: (alias: string) => string
): string[] {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.remake) continue;
    counts.set(m.champion, (counts.get(m.champion) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([alias]) => resolve(alias));
}

function isDismissed(patchVersion: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${patchVersion}`) === "1";
  } catch {
    return false;
  }
}

function markDismissed(patchVersion: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${patchVersion}`, "1");
  } catch {
    // localStorage may be blocked (private mode, quota); silently ignore —
    // the user will see the callout again next mount.
  }
}

export function ProfilePatchNotice({
  accountSlug,
}: { accountSlug: string }) {
  const { matches } = useMatchWindow();
  const championName = useChampionName();
  // Server returns wiki names ("Wukong"); the icon proxy expects Riot
  // aliases ("MonkeyKing"). Reverse-map via the same CDragon data so the
  // round-trip stays consistent.
  const championAliasFromName = useChampionAliasFromName();
  // Gate on the CDragon champion map being loaded — pre-load, `championName`
  // falls back to the raw Riot alias (e.g. "MonkeyKing") which won't match
  // the wiki-name keys stored on the API side ("Wukong").
  const championsReady = useChampions().isSuccess;

  const topChampions = useMemo(() => {
    if (!matches || !championsReady) return [] as string[];
    return topWikiChampions(matches, championName);
  }, [matches, championsReady, championName]);

  const { data } = useCurrentPatchChanges(topChampions);

  const patchVersion = data?.patchVersion ?? null;
  const [dismissed, setDismissed] = useState(false);
  // Per-champion expanded set, reset whenever the patch flips so a fresh
  // patch starts collapsed again.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setDismissed(patchVersion ? isDismissed(patchVersion) : false);
    setExpanded(new Set());
  }, [patchVersion]);

  if (!data || !patchVersion || dismissed) return null;
  if (data.changes.length === 0) return null;

  const onDismiss = () => {
    markDismissed(patchVersion);
    setDismissed(true);
  };

  const toggleExpanded = (champion: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(champion)) next.delete(champion);
      else next.add(champion);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <Link
          to="/lol/$accountSlug/patches"
          params={{ accountSlug }}
          className="text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Patch {patchVersion} · changes for your champions →
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss patch notice"
          className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-0">
        {data.changes.map((group, idx) => {
          const isExpanded = expanded.has(group.champion);
          const visibleCount = isExpanded
            ? group.changes.length
            : Math.min(MAX_LINES_PER_CHAMPION, group.changes.length);
          const hiddenCount = group.changes.length - visibleCount;
          return (
            <div key={group.champion}>
              {data.changes.length > 1 && idx > 0 && (
                <Separator className="my-3 bg-border/50" />
              )}
              <div className="flex gap-3">
                <ChampionSquareIcon
                  championName={championAliasFromName(group.champion)}
                  alt={group.champion}
                  className="size-9 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{group.champion}</div>
                  <AbilityChangeList
                    changes={group.changes.slice(0, visibleCount)}
                    className="mt-0.5"
                  />
                  {hiddenCount > 0 || isExpanded ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(group.champion)}
                      className="mt-1 cursor-pointer text-xs text-muted-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      {isExpanded
                        ? "Show less"
                        : `+${hiddenCount} more ${hiddenCount === 1 ? "change" : "changes"}`}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
