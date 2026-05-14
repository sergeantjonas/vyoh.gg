import { EmptyMatchesIllustration, EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { useHoverChampion } from "@/lol/_shared/hover-champion-context";
import {
  ROLE_LABEL,
  ROLE_ORDER,
  RoleIcon,
  type RolePosition,
  isRolePosition,
} from "@/lol/_shared/role-icon";
import { filterToSerious, useSeriousQueues } from "@/lol/_shared/serious-queues";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { ChampionPoolDrift } from "@/lol/champions/champion-pool-drift";
import {
  CHAMPION_SORT_OPTIONS,
  type ChampionSortOption,
  ChampionSortSelector,
} from "@/lol/champions/champion-sort-selector";
import { aggregateChampionStats } from "@/lol/champions/champion-stats";
import { ChampionTable } from "@/lol/champions/champion-table";
import { ChampionsSkeleton } from "@/lol/champions/champions-skeleton";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

interface ChampionsSearch {
  role?: RolePosition;
}

export const Route = createFileRoute("/lol/$accountSlug/champions/")({
  component: ChampionsPage,
  validateSearch: (search: Record<string, unknown>): ChampionsSearch => {
    const raw = search.role;
    return {
      role: typeof raw === "string" && isRolePosition(raw) ? raw : undefined,
    };
  },
});

// Match the Champion detail page's window so navigating list → detail doesn't
// switch dataset under the user (the count selector used to live here, but
// detail pages can't share that scope and the totals drifted as a result).
const CHAMPIONS_FETCH_COUNT = 2000;

function RoleChipStrip({
  value,
  onChange,
}: {
  value: RolePosition | undefined;
  onChange: (next: RolePosition | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {ROLE_ORDER.map((role) => {
        const active = value === role;
        return (
          <TooltipPrimitive.Root key={role}>
            <TooltipPrimitive.Trigger asChild>
              <button
                type="button"
                onClick={() => onChange(active ? undefined : role)}
                aria-pressed={active}
                aria-label={ROLE_LABEL[role]}
                className={cn(
                  "cursor-pointer rounded-md p-1 transition-opacity",
                  active ? "bg-muted opacity-100" : "opacity-50 hover:opacity-100"
                )}
              >
                <RoleIcon position={role} className="size-4" />
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={4}
                className={TOOLTIP_CONTENT_CLASS}
              >
                {ROLE_LABEL[role]}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        );
      })}
    </div>
  );
}

function ChampionsPage() {
  const { accountSlug } = Route.useParams();
  // Champion stats only count serious play — KDA in ARAM is meaningless and
  // would inflate the table.
  const account = useAccountFromSlug(accountSlug);
  const { ids } = useSeriousQueues();
  const { role } = useSearch({ from: Route.fullPath });
  const navigate = useNavigate();
  const { data, isPending } = useCachedMatchesWindow(account, CHAMPIONS_FETCH_COUNT);

  const matches = useMemo(() => {
    if (!data) return undefined;
    const serious = filterToSerious(data.matches, ids);
    return role ? serious.filter((m) => m.teamPosition === role) : serious;
  }, [data, ids, role]);

  // Aggregation is O(matches) and was previously called inline in JSX, so any
  // parent-driven re-render of ChampionsPage rebuilt the stats array and
  // invalidated the ChampionTable's sort memo. Memoising on `matches` lets the
  // table keep its sorted output stable when nothing about the underlying
  // window has changed (e.g. unrelated context churn).
  const stats = useMemo(
    () => (matches ? aggregateChampionStats(matches) : undefined),
    [matches]
  );
  const [sort, setSort] = useState<ChampionSortOption>(CHAMPION_SORT_OPTIONS[0].value);
  const setHoveredChampion = useHoverChampion();

  const setRole = (next: RolePosition | undefined) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, role: next }) });

  return (
    <div className="flex flex-col gap-3">
      {matches && matches.length > 0 && (
        <ChampionPoolDrift matches={matches} role={role} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {matches
            ? `Aggregated over your last ${matches.length} games`
            : "Loading champion stats…"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <RoleChipStrip value={role} onChange={setRole} />
          <ChampionSortSelector
            value={sort}
            onChange={setSort}
            layoutId="champions-sort-indicator"
          />
        </div>
      </div>

      {isPending && !matches ? (
        <ChampionsSkeleton />
      ) : !matches || matches.length === 0 || !stats ? (
        <EmptyState
          illustration={<EmptyMatchesIllustration />}
          title="No matches yet to aggregate"
          hint="Play a few games and your champion pool will appear here once data lands."
        />
      ) : (
        <ChampionTable
          stats={stats}
          sort={sort}
          accountSlug={accountSlug}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
