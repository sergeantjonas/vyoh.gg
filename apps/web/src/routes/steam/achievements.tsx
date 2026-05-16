import { RarityPercent } from "@/steam/_shared/rarity-percent";
import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import { useRecentUnlocks } from "@/steam/use-recent-unlocks";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SteamRecentUnlock } from "@vyoh/shared";

export const Route = createFileRoute("/steam/achievements")({
  component: AchievementsPage,
});

const FEED_LIMIT = 100;
const RAREST_LIMIT = 10;

// Matches the per-game RarestUnlockCard vocabulary so the cross-game and
// per-game surfaces read in the same register.
function rarityQualifier(pct: number): string {
  if (pct < 1) return "Very rare";
  if (pct < 5) return "Rare";
  if (pct < 25) return "Uncommon";
  return "Common";
}

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
  const rarest = useCrossGameRarest(RAREST_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          A running feed of recent unlocks across the library, plus the rarest pulls so
          far. Completionist axis and the 100%'d hall land next.
        </p>
      </div>
      <RarestSection
        unlocks={rarest.data?.unlocks ?? []}
        isPending={rarest.isPending}
        isError={rarest.isError}
      />
      <RecentSection
        unlocks={data?.unlocks ?? []}
        isPending={isPending}
        isError={isError}
      />
    </div>
  );
}

interface SectionProps {
  unlocks: SteamRecentUnlock[];
  isPending: boolean;
  isError: boolean;
}

function RarestSection({ unlocks, isPending, isError }: SectionProps) {
  // Quiet failure modes — the page leads with the recent feed, so a missing
  // rarest leaderboard collapses rather than putting a banner above the
  // primary content. A genuine error renders inline so the absence is
  // visible without screaming.
  if (isPending) return null;
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Rarest unlocks are unavailable right now.
      </p>
    );
  }
  // Pre-rarity-poll state (newly-added library, weekly poller hasn't run).
  // Collapse the section silently — the recent feed still renders.
  if (unlocks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rarest unlocks
          <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
            {unlocks.length}
          </span>
        </h2>
        <p className="text-xs text-muted-foreground/70">By global unlock rarity</p>
      </div>
      <ul className="flex flex-col gap-2">
        {unlocks.map((u) => (
          <RarestRow key={`${u.appid}-${u.apiName}`} unlock={u} />
        ))}
      </ul>
    </section>
  );
}

function RarestRow({ unlock }: { unlock: SteamRecentUnlock }) {
  // globalPercent is non-null by construction — the backend filters rows
  // without rarity before returning — but the DTO field type stays nullable
  // since it's shared with the recent feed.
  const pct = unlock.globalPercent ?? 0;
  const qualifier = rarityQualifier(pct);
  // Mirror the per-game RarestUnlockCard's amber treatment for sub-5%, plain
  // for the rest — the visual cue does the work, no need to color every row.
  const isAmber = pct < 5;

  return (
    <li>
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(unlock.appid) }}
        search={{ ach: unlock.apiName }}
        className={
          isAmber
            ? "flex items-center gap-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.04] p-4 ring-1 ring-amber-400/10 transition-colors hover:border-amber-400/50 hover:bg-amber-500/[0.07]"
            : "flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card/80"
        }
      >
        <img
          src={unlock.iconUrl}
          alt=""
          loading="lazy"
          className="size-16 shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-base font-medium text-foreground/90">
            {unlock.displayName}
          </p>
          <p className="truncate text-sm text-muted-foreground">{unlock.gameName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <RarityPercent
            percent={pct}
            className={
              isAmber
                ? "text-sm font-medium text-amber-300 decoration-amber-300/40"
                : "text-sm font-medium text-foreground/80"
            }
          />
          <span
            className={
              isAmber
                ? "text-[10px] font-medium uppercase tracking-wide text-amber-400/80"
                : "text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
            }
          >
            {qualifier}
          </span>
        </div>
      </Link>
    </li>
  );
}

function RecentSection({ unlocks, isPending, isError }: SectionProps) {
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
