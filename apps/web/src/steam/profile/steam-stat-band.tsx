import { steamLibraryLogoUrl } from "@/steam/_shared/steam-image";
import { useSteamLibrarySummary } from "@/steam/use-library-summary";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { formatPlaytime } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

// A plain count cell: big value + small uppercase label.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate font-semibold text-foreground/90 text-lg tracking-tight tabular-nums">
        {value}
      </span>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </span>
    </div>
  );
}

// Most-played cell — shows the game's wordmark logo instead of a truncated
// name (logos read instantly and never clip awkwardly), falling back to the
// name text on a 404. Hours sit in the label.
function MostPlayedCell({
  appid,
  name,
  assetTimestamp,
  hours,
}: {
  appid: number;
  name: string;
  assetTimestamp: number | null;
  hours: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex h-7 items-center">
        {logoFailed ? (
          <span className="truncate font-semibold text-foreground/90 text-lg tracking-tight">
            {name}
          </span>
        ) : (
          <img
            src={steamLibraryLogoUrl(appid, assetTimestamp)}
            alt={name}
            loading="eager"
            onError={() => setLogoFailed(true)}
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
            }}
            className="max-h-7 max-w-full object-contain object-left drop-shadow-sm"
          />
        )}
      </div>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        Most played · {hours}
      </span>
    </div>
  );
}

// Library-played cell — a two-tone progress bar (played fill vs backlog track)
// with the played/owned count above and the percentage + backlog count below.
// The bar fill animates in on mount (collapses to static under reduced motion).
function LibraryPlayedCell({
  played,
  owned,
}: {
  played: number;
  owned: number;
}) {
  const reduced = useReducedMotion();
  const pct = owned > 0 ? Math.round((played / owned) * 100) : 0;
  const backlog = Math.max(0, owned - played);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-semibold text-foreground/90 text-lg tracking-tight tabular-nums">
        {played} / {owned}
        <span className="ml-1.5 font-medium text-muted-foreground text-xs">played</span>
      </span>
      {/* Decorative — the played/owned count and "{pct}% · {backlog} in
          backlog" text below carry the value for screen readers, so the bar
          itself is aria-hidden rather than a focusable progressbar widget. */}
      <div
        aria-hidden
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
      >
        <m.div
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full bg-foreground/85"
        />
      </div>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        {pct}% · {backlog.toLocaleString("en-US")} in backlog
      </span>
    </div>
  );
}

// Library/activity stat band — the Steam parallel of the LoL hero's glass rank
// strip. Steam has no rank, so the substance is the library identity: how big
// the collection is, how much time is in it, the defining game (wordmark logo),
// and the backlog share (the "collector vs completionist" signal, as a bar).
// All from data already fetched (library-summary counts + owned-games
// playtime), no new requests. Frosted glass over the hero backdrop.
export function SteamStatBand() {
  const { data: lib } = useSteamLibrarySummary();
  const { data: owned } = useSteamOwnedGames();

  const totalMinutes = useMemo(
    () => owned?.games?.reduce((sum, g) => sum + g.playtimeForeverMinutes, 0) ?? null,
    [owned]
  );
  const topGame = owned?.games?.[0] ?? null;

  return (
    <div className="relative grid grid-cols-2 items-end gap-x-6 gap-y-4 border-white/10 border-t bg-background/25 px-6 py-4 backdrop-blur-sm sm:grid-cols-4">
      <Stat
        value={lib ? lib.ownedCount.toLocaleString("en-US") : "—"}
        label="Games owned"
      />
      <Stat
        value={totalMinutes != null ? formatPlaytime(totalMinutes) : "—"}
        label="Total playtime"
      />
      {topGame ? (
        <MostPlayedCell
          appid={topGame.appid}
          name={topGame.name}
          assetTimestamp={topGame.assetTimestamp}
          hours={formatPlaytime(topGame.playtimeForeverMinutes)}
        />
      ) : (
        <Stat value="—" label="Most played" />
      )}
      {lib ? (
        <LibraryPlayedCell played={lib.everLaunchedCount} owned={lib.ownedCount} />
      ) : (
        <Stat value="—" label="Library played" />
      )}
    </div>
  );
}
