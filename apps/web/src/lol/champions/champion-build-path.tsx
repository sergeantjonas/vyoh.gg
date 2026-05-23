import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ItemIcon } from "@/lol/_shared/assets/item-icon";
import { useChampionBuildFlow } from "@/lol/champions/use-champion-build-flow";
import { useItems } from "@/lol/matches/use-items";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ChampionBuildFlowEntry } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_ENTRIES = 5;
const MAX_STEPS = 3;
const MAX_PATHS = 5;
const MIN_PATH_GAMES = 2;
const LIFT_THRESHOLD = 0.05;

const WIN_COLOR = "rgb(52, 211, 153)";
const LOSS_COLOR = "rgb(244, 63, 94)";
const NEUTRAL_COLOR = "rgb(161, 161, 170)";

const TOOLTIP_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

interface BuildPath {
  items: number[];
  games: number;
  wins: number;
}

interface PathGroups {
  paths: BuildPath[];
  baselineWR: number;
  totalGames: number;
}

function groupPaths(entries: ChampionBuildFlowEntry[]): PathGroups {
  const map = new Map<string, BuildPath>();
  let totalGames = 0;
  let totalWins = 0;
  for (const entry of entries) {
    const items = entry.items.slice(0, MAX_STEPS);
    if (items.length === 0) continue;
    totalGames += 1;
    if (entry.win) totalWins += 1;
    const key = items.join(">");
    const existing = map.get(key);
    if (existing) {
      existing.games += 1;
      if (entry.win) existing.wins += 1;
    } else {
      map.set(key, { items, games: 1, wins: entry.win ? 1 : 0 });
    }
  }
  const paths = [...map.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
  const baselineWR = totalGames > 0 ? totalWins / totalGames : 0.5;
  return { paths, baselineWR, totalGames };
}

function colorForLift(linkWR: number, baselineWR: number): string {
  const lift = linkWR - baselineWR;
  if (lift > LIFT_THRESHOLD) return WIN_COLOR;
  if (lift < -LIFT_THRESHOLD) return LOSS_COLOR;
  return NEUTRAL_COLOR;
}

function PathRow({
  path,
  topGames,
  baselineWR,
  iconForItem,
  nameForItem,
}: {
  path: BuildPath;
  topGames: number;
  baselineWR: number;
  iconForItem: (id: number) => string | undefined;
  nameForItem: (id: number) => string;
}) {
  const wr = path.games === 0 ? 0.5 : path.wins / path.games;
  const color = colorForLift(wr, baselineWR);
  const delta = wr - baselineWR;
  // WR / delta on a single-game path are statistical noise (1/1 = 100%); only
  // surface them once a path has actually repeated. Same logic for the
  // frequency bar — if the top path is itself a one-off, every bar would be
  // the same length and convey nothing.
  const hasSignal = path.games >= MIN_PATH_GAMES;
  const showBar = topGames >= MIN_PATH_GAMES;
  const showDelta = hasSignal && Math.abs(delta) >= LIFT_THRESHOLD;
  const barWidth = topGames === 0 ? 0 : (path.games / topGames) * 100;

  const slots: Array<{ itemId: number | null }> = Array.from(
    { length: MAX_STEPS },
    (_, i) => ({
      itemId: path.items[i] ?? null,
    })
  );
  const labelText = path.items.map((id) => nameForItem(id)).join(" → ");

  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>
        <div className="relative flex cursor-default items-center gap-3 overflow-hidden rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2">
          {showBar ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 -z-0"
              style={{
                width: `${barWidth}%`,
                background: color,
                opacity: 0.12,
              }}
            />
          ) : null}
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {slots.map((slot, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-width slot grid
                key={i}
                className="flex items-center gap-1"
              >
                {i > 0 ? (
                  <span
                    aria-hidden="true"
                    className={
                      slot.itemId !== null
                        ? "text-muted-foreground/40 text-[10px]"
                        : "text-transparent text-[10px]"
                    }
                  >
                    →
                  </span>
                ) : null}
                {slot.itemId !== null ? (
                  <ItemIcon
                    iconUrl={iconForItem(slot.itemId) ?? ""}
                    alt={nameForItem(slot.itemId)}
                    className="size-8 rounded-sm"
                  />
                ) : (
                  <span className="inline-block size-8 shrink-0 rounded-sm border border-dashed border-white/5" />
                )}
              </div>
            ))}
          </div>
          <div className="relative z-10 min-w-0 flex-1 truncate text-xs text-foreground/80">
            {labelText}
          </div>
          <div className="relative z-10 flex shrink-0 items-baseline gap-2 font-mono text-[11px] tabular-nums">
            <span className="text-muted-foreground">
              {path.games}
              {path.games === 1 ? " game" : " games"}
            </span>
            {hasSignal ? (
              <>
                <span style={{ color }}>{Math.round(wr * 100)}%</span>
                {showDelta ? (
                  <span style={{ color }} className="text-[10px]">
                    {delta > 0 ? "+" : ""}
                    {Math.round(delta * 100)}%
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="top" sideOffset={6} className={TOOLTIP_CLASS}>
          <span className="font-semibold">{labelText}</span>
          <div className="mt-0.5 text-muted-foreground">
            {path.games} {path.games === 1 ? "game" : "games"} · {path.wins}W{" "}
            {path.games - path.wins}L{hasSignal ? ` · ${Math.round(wr * 100)}% WR` : ""}
          </div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function ChampionBuildPath({
  accountSlug,
  championKey,
}: {
  accountSlug: string;
  championKey: string;
}) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useChampionBuildFlow(account, championKey);
  const itemsData = useItems();

  const groups = useMemo(() => (data ? groupPaths(data) : null), [data]);

  if (isPending || !data) return null;

  if (!groups || groups.paths.length === 0 || data.length < MIN_ENTRIES) {
    return (
      <ConclusionCard
        title="Build path"
        sampleSize={data.length}
        verdict={`Need ${MIN_ENTRIES}+ matches with timeline data to map your build flow on this champion.`}
        empty
      />
    );
  }

  const nameForItem = (id: number) => itemsData.data?.get(id)?.name ?? `Item ${id}`;
  const iconForItem = (id: number) => itemsData.data?.get(id)?.iconUrl;

  const topPaths = groups.paths.slice(0, MAX_PATHS);
  const remaining = groups.paths.slice(MAX_PATHS);
  const remainingGames = remaining.reduce((sum, p) => sum + p.games, 0);
  const topGames = topPaths[0]?.games ?? 0;

  const top = topPaths[0];
  let verdict: string;
  if (top && top.games >= MIN_PATH_GAMES) {
    const path = top.items.map((id) => nameForItem(id));
    verdict = `Most-built path on ${path.length} ${
      path.length === 1 ? "item" : "items"
    }: ${path.join(" → ")} (${top.games} ${top.games === 1 ? "game" : "games"}).`;
  } else {
    verdict = `Builds vary — no item sequence has repeated across ${groups.totalGames} ${
      groups.totalGames === 1 ? "game" : "games"
    }.`;
  }

  return (
    <ConclusionCard
      title="Build path"
      sampleSize={data.length}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={
        <div className="flex flex-col gap-1.5">
          {topPaths.map((p) => (
            <PathRow
              key={p.items.join(">")}
              path={p}
              topGames={topGames}
              baselineWR={groups.baselineWR}
              iconForItem={iconForItem}
              nameForItem={nameForItem}
            />
          ))}
          {remaining.length > 0 ? (
            <div className="pt-1 text-[10px] text-muted-foreground/60">
              {remainingGames} {remainingGames === 1 ? "game" : "games"} across{" "}
              {remaining.length} other {remaining.length === 1 ? "build" : "builds"}.
            </div>
          ) : null}
        </div>
      }
    />
  );
}
