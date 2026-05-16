import { steamLibraryCapsuleUrl } from "@/steam/_shared/steam-image";
import { useLibraryCompletion } from "@/steam/use-library-completion";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { Link } from "@tanstack/react-router";
import type { SteamGameCompletion, SteamOwnedGame } from "@vyoh/shared";
import { useMemo } from "react";

interface HallEntry {
  appid: number;
  name: string;
  total: number;
  lastUnlockedAt: string | null;
  capsuleUrl: string;
  libraryCapsulePath: string | null;
  assetTimestamp: number | null;
}

function joinEntries(stats: SteamGameCompletion[], owned: SteamOwnedGame[]): HallEntry[] {
  const gameById = new Map(owned.map((g) => [g.appid, g]));
  const entries: HallEntry[] = [];
  for (const s of stats) {
    if (s.total === 0 || s.unlocked !== s.total) continue;
    const game = gameById.get(s.appid);
    if (!game) continue;
    entries.push({
      appid: s.appid,
      name: game.name,
      total: s.total,
      lastUnlockedAt: s.lastUnlockedAt,
      capsuleUrl: steamLibraryCapsuleUrl(s.appid, game.assetTimestamp),
      libraryCapsulePath: game.libraryCapsulePath,
      assetTimestamp: game.assetTimestamp,
    });
  }
  // Newest 100% first; missing dates fall to the bottom in original order.
  entries.sort((a, b) => {
    if (a.lastUnlockedAt && b.lastUnlockedAt) {
      return b.lastUnlockedAt.localeCompare(a.lastUnlockedAt);
    }
    if (a.lastUnlockedAt) return -1;
    if (b.lastUnlockedAt) return 1;
    return 0;
  });
  return entries;
}

export function HundredPercentHall() {
  const completion = useLibraryCompletion();
  const owned = useSteamOwnedGames();

  const entries = useMemo<HallEntry[]>(() => {
    if (!completion.data || !owned.data) return [];
    return joinEntries(completion.data.stats, owned.data.games);
  }, [completion.data, owned.data]);

  if (completion.isPending || owned.isPending) return null;
  if (completion.isError || owned.isError) return null;
  // Pre-completion state — fully reasonable; collapse silently rather than
  // render a "nothing to see here" block above the recent feed.
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          100%'d
          <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
            {entries.length}
          </span>
        </h2>
        <p className="text-xs text-muted-foreground/70">Every achievement, every game</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map((e) => (
          <li key={e.appid}>
            <Link
              to="/steam/game/$appid"
              params={{ appid: String(e.appid) }}
              className="group block overflow-hidden rounded-lg border border-border/40 bg-card/50 transition-colors hover:border-border hover:bg-card/80"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted/30">
                <img
                  src={e.capsuleUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col gap-0.5 px-2.5 py-2">
                <p className="truncate text-sm font-medium text-foreground/90">
                  {e.name}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {e.total} achievement{e.total === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
