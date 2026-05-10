import { cn } from "@/lib/utils";
import { filterToSerious, useSeriousQueues } from "@/lol/_shared/serious-queues";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useMemo } from "react";
import { groupByPatch } from "../_shared/patch-version";

// Wide enough to cover the strip's 6-patch tail at any realistic play rate
// (heavy grinders ~1500 matches over 6 patches; Riot caps history at ~1000
// per puuid anyway). Decoupled from the user's match-list count selector so
// patch history isn't compressed when they're browsing 20 matches at a time.
const PATCH_HISTORY_FETCH_COUNT = 2000;

interface PatchStat {
  patch: string;
  wins: number;
  losses: number;
  winRate: number;
}

function buildPatchStats(matches: readonly MatchSummary[]): PatchStat[] {
  const realMatches = matches.filter((m) => !m.remake);
  const buckets = groupByPatch(realMatches, (m) => m.gameVersion);
  return buckets.map((b) => {
    const wins = b.items.filter((m) => m.win).length;
    const losses = b.items.length - wins;
    return {
      patch: b.patch,
      wins,
      losses,
      winRate: b.items.length === 0 ? 0 : wins / b.items.length,
    };
  });
}

function patchVerdict(stats: readonly PatchStat[]): string | null {
  if (stats.length === 0) return null;
  const current = stats[stats.length - 1];
  if (!current) return null;
  const games = current.wins + current.losses;
  if (stats.length === 1) {
    return `This patch (${current.patch}): ${current.wins}-${current.losses} (${Math.round(current.winRate * 100)}% WR over ${games} games).`;
  }
  const previous = stats[stats.length - 2];
  if (!previous) return null;
  const delta = current.winRate - previous.winRate;
  const direction =
    Math.abs(delta) < 0.05
      ? "matching last patch"
      : `${delta > 0 ? "+" : "−"}${Math.round(Math.abs(delta) * 100)}% from ${previous.patch}`;
  return `This patch (${current.patch}): ${current.wins}-${current.losses}, ${direction}.`;
}

export function ChampionPatchHistory({
  accountSlug,
  championAlias,
}: {
  accountSlug: string;
  championAlias: string;
}) {
  // Self-fetches a wide window so the strip can show ~6 patches of history
  // regardless of how many matches the matches-list count selector is set
  // to. Filters to the user's serious queues so the patch verdict matches
  // the rest of the Champion detail page's posture.
  const account = useAccountFromSlug(accountSlug);
  const { ids } = useSeriousQueues();
  const { data } = useCachedMatchesWindow(account, PATCH_HISTORY_FETCH_COUNT);
  const matches = useMemo<readonly MatchSummary[]>(() => {
    if (!data) return [];
    return filterToSerious(data.matches, ids).filter((m) => m.champion === championAlias);
  }, [data, ids, championAlias]);

  const stats = useMemo(() => buildPatchStats(matches), [matches]);
  const verdict = useMemo(() => patchVerdict(stats), [stats]);

  if (stats.length === 0) return null;

  // Show the most recent 6 patches max — older patches truncate from the left.
  // Players think in recent meta; older patches are noise on a champion-detail page.
  const visible = stats.slice(-6);
  const currentPatch = visible[visible.length - 1]?.patch;

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.07 }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Per-patch
        </div>
        {verdict && (
          <div className="truncate text-xs text-muted-foreground">{verdict}</div>
        )}
      </div>
      <div className="flex gap-1.5">
        {visible.map((p) => {
          const games = p.wins + p.losses;
          const isCurrent = p.patch === currentPatch;
          const wrText = `${Math.round(p.winRate * 100)}%`;
          return (
            <TooltipPrimitive.Root key={p.patch} delayDuration={150}>
              <TooltipPrimitive.Trigger asChild>
                <div
                  className={cn(
                    "flex flex-1 cursor-default flex-col gap-1 rounded-lg border bg-card/50 px-3 py-2 transition-colors",
                    isCurrent && "border-foreground/25 bg-card"
                  )}
                  aria-label={`Patch ${p.patch}: ${p.wins}-${p.losses} (${wrText} WR)`}
                >
                  <div
                    className={cn(
                      "text-xs tabular-nums",
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {p.patch}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      p.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {wrText}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {p.wins}W {p.losses}L
                  </div>
                </div>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={6}
                  collisionPadding={8}
                  className="pointer-events-none z-50 rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
                >
                  Patch {p.patch} on {championAlias}: {games}{" "}
                  {games === 1 ? "game" : "games"} · {wrText} WR
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          );
        })}
      </div>
    </m.div>
  );
}
