import { cn } from "@/lib/utils";
import { useSteamLibrarySummary } from "@/steam/use-library-summary";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { formatPlaytime } from "@vyoh/shared";
import { useMemo } from "react";

// One stat cell in the band: big value + small label. `accent` lifts a value
// that carries the most character (the backlog %) so it reads as the headline
// of the four without a separate layout.
function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "truncate font-semibold text-lg tracking-tight tabular-nums",
          accent ? "text-foreground" : "text-foreground/90"
        )}
      >
        {value}
      </span>
      <span className="truncate font-medium text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// Library/activity stat band — the Steam parallel of the LoL hero's glass rank
// strip. Steam has no rank, so the substance is the library identity: how big
// the collection is, how much time is in it, the defining game, and the backlog
// share (the most characterful "collector vs completionist" signal). All four
// come from data we already fetch (library-summary counts + owned-games
// playtime), no new requests. Frosted glass over the hero backdrop, matching
// HeroRankStrip.
export function SteamStatBand() {
  const { data: lib } = useSteamLibrarySummary();
  const { data: owned } = useSteamOwnedGames();

  const totalMinutes = useMemo(
    () => owned?.games?.reduce((sum, g) => sum + g.playtimeForeverMinutes, 0) ?? null,
    [owned]
  );
  const topGame = owned?.games?.[0] ?? null;
  const playedPct =
    lib && lib.ownedCount > 0
      ? Math.round((lib.everLaunchedCount / lib.ownedCount) * 100)
      : null;

  return (
    <div className="relative grid grid-cols-2 gap-x-6 gap-y-4 border-white/10 border-t bg-background/25 px-6 py-4 backdrop-blur-sm sm:grid-cols-4">
      <Stat
        value={lib ? lib.ownedCount.toLocaleString("en-US") : "—"}
        label="Games owned"
      />
      <Stat
        value={totalMinutes != null ? formatPlaytime(totalMinutes) : "—"}
        label="Total playtime"
      />
      <Stat
        value={topGame ? formatPlaytime(topGame.playtimeForeverMinutes) : "—"}
        label={topGame ? `Most: ${topGame.name}` : "Most played"}
      />
      <Stat
        value={playedPct != null ? `${playedPct}%` : "—"}
        label="Library played"
        accent
      />
    </div>
  );
}
