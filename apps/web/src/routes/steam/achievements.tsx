import { useRecentUnlocks } from "@/steam/use-recent-unlocks";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SteamRecentUnlock } from "@vyoh/shared";

export const Route = createFileRoute("/steam/achievements")({
  component: AchievementsPage,
});

// MVP scope: recent-unlocks feed across the whole library, grouped by month.
// Cross-game rarest, completionist axis, and the 100%'d hall extend this page
// in S7.C — keep this lean so they have room to grow.
const FEED_LIMIT = 100;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function monthKey(iso: string): string {
  return monthFormatter.format(new Date(iso));
}

function formatRowDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function AchievementsPage() {
  const { data, isPending, isError } = useRecentUnlocks(FEED_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          A running feed of recent unlocks across the library. Rarity-weighted signature,
          completionist axis, and the 100%'d hall land next.
        </p>
      </div>
      <FeedBody unlocks={data?.unlocks ?? []} isPending={isPending} isError={isError} />
    </div>
  );
}

interface FeedBodyProps {
  unlocks: SteamRecentUnlock[];
  isPending: boolean;
  isError: boolean;
}

function FeedBody({ unlocks, isPending, isError }: FeedBodyProps) {
  if (isPending) {
    return (
      <p className="rounded-lg border bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
        Loading recent unlocks…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg border bg-card/30 px-6 py-12 text-center text-sm text-destructive">
        Recent unlocks are unavailable right now.
      </p>
    );
  }

  if (unlocks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
        No achievements unlocked yet.
      </p>
    );
  }

  const uniqueGames = new Set(unlocks.map((u) => u.appid)).size;
  const groups = groupByMonth(unlocks);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground/90">{unlocks.length}</span> unlock
        {unlocks.length === 1 ? "" : "s"} across{" "}
        <span className="font-medium text-foreground/90">{uniqueGames}</span> game
        {uniqueGames === 1 ? "" : "s"}.
      </p>
      <div className="flex flex-col gap-8">
        {groups.map(({ label, rows }) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
              <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
                {rows.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((u) => (
                <li key={`${u.appid}-${u.apiName}`}>
                  <Link
                    to="/steam/game/$appid"
                    params={{ appid: String(u.appid) }}
                    search={{ ach: u.apiName }}
                    className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card/80"
                  >
                    <img
                      src={u.iconUrl}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-md"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-base font-medium text-foreground/90">
                        {u.displayName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {u.gameName}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                      {formatRowDate(u.unlockedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

interface MonthGroup {
  label: string;
  rows: SteamRecentUnlock[];
}

// Server returns rows sorted by unlockedAt desc, so preserving insertion order
// gives newest-month-first and newest-row-first within each group without an
// extra sort. Map keys keep insertion order in JS, so this falls out for free.
function groupByMonth(unlocks: SteamRecentUnlock[]): MonthGroup[] {
  const buckets = new Map<string, SteamRecentUnlock[]>();
  for (const u of unlocks) {
    const key = monthKey(u.unlockedAt);
    const existing = buckets.get(key);
    if (existing) existing.push(u);
    else buckets.set(key, [u]);
  }
  return Array.from(buckets.entries()).map(([label, rows]) => ({ label, rows }));
}
