import { steamLibraryLogoUrl } from "@/steam/_shared/steam-image";
import { useSteamLibrarySummary } from "@/steam/use-library-summary";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { formatPlaytime, formatTimeAgo } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

// Per-appid optical-center corrections for wordmark IMGs rendered in this
// band. The proxy trims transparent padding faithfully, which means
// publisher-authored asymmetric decorations (Nightreign's left-side wisp)
// shift the strong-ink centroid off the PNG's geometric center. The IMG
// stays centered in its flex container, but the *visible* wordmark sits
// off-axis from the sub-stat/label below. A small translateX nudges it
// back without distorting the source. Add an entry when a wordmark in
// the owner's top-played or recently-played slot reads visibly off-axis.
//   2622380 (Elden Ring Nightreign): −4px to compensate for the left wisp.
const WORDMARK_OFFSET_PX: Record<number, number> = {
  2622380: -4,
};

// A plain count cell: big value + small uppercase label. Used as a fallback
// when the richer cells below can't resolve their secondary signal (loading,
// or a fresh account with no playtime yet).
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <span className="truncate font-semibold text-foreground/90 text-lg tracking-tight tabular-nums">
        {value}
      </span>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </span>
    </div>
  );
}

// Recently-played cell — wordmark logo + time-ago sub-stat + label, in the
// 3-row rhythm shared with the data cells. The band picks a game distinct
// from MostPlayedCell when possible (see SteamStatBand below); this component
// is dumb about which game it gets.
function RecentlyPlayedCell({
  appid,
  name,
  assetTimestamp,
  lastPlayedAt,
}: {
  appid: number;
  name: string;
  assetTimestamp: number | null;
  lastPlayedAt: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const offsetPx = WORDMARK_OFFSET_PX[appid] ?? 0;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <div className="flex h-9 items-center justify-center">
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
            className="max-h-9 max-w-full object-contain object-center drop-shadow-sm"
            style={offsetPx ? { transform: `translateX(${offsetPx}px)` } : undefined}
          />
        )}
      </div>
      <span className="truncate font-medium text-foreground/60 text-xs">
        {formatTimeAgo(lastPlayedAt)}
      </span>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        Recently played
      </span>
    </div>
  );
}

// Total-playtime cell — lifetime total + 2-week rollup recency sub-line +
// label. Mirrors the recency rhythm of the games cell on a different axis
// (time spent vs games touched). Hidden when zero so a quiet fortnight reads
// as a clean two-line cell rather than "+0h past 2 weeks".
function TotalPlaytimeCell({
  totalMinutes,
  recentMinutes,
}: {
  totalMinutes: number;
  recentMinutes: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
      <span className="truncate font-semibold text-foreground/90 text-lg tracking-tight tabular-nums">
        {formatPlaytime(totalMinutes)}
      </span>
      {recentMinutes > 0 ? (
        <span className="truncate font-medium text-foreground/60 text-xs tabular-nums">
          +{formatPlaytime(recentMinutes)} past 2 weeks
        </span>
      ) : (
        <span aria-hidden className="h-4" />
      )}
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        Total playtime
      </span>
    </div>
  );
}

// Most-played cell — wordmark logo + lifetime-hours sub-stat + label, in the
// 3-row rhythm shared with the data cells. The wordmark falls back to the
// game name text on a 404.
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
  const offsetPx = WORDMARK_OFFSET_PX[appid] ?? 0;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <div className="flex h-9 items-center justify-center">
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
            className="max-h-9 max-w-full object-contain object-center drop-shadow-sm"
            style={offsetPx ? { transform: `translateX(${offsetPx}px)` } : undefined}
          />
        )}
      </div>
      <span className="truncate font-medium text-foreground/60 text-xs tabular-nums">
        {hours}
      </span>
      <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        Most played
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
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
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
//
// `compact` is the hero's scroll-collapse state. When the hero's identity is
// morphing up into the section strip, the stat band fades out; when the hero
// is restored on scroll-up, the cells fade back in with a small delay so they
// arrive AFTER the morph lands rather than sitting there while it runs.
// Mirrors HeroRankStrip's fade in apps/web/src/lol/profile/hero-rank-strip.tsx.
export function SteamStatBand({ compact = false }: { compact?: boolean }) {
  const { data: lib } = useSteamLibrarySummary();
  const { data: owned } = useSteamOwnedGames();
  const reduced = useReducedMotion();

  const totalMinutes = useMemo(
    () => owned?.games?.reduce((sum, g) => sum + g.playtimeForeverMinutes, 0) ?? null,
    [owned]
  );
  const recentMinutes = useMemo(
    () => owned?.games?.reduce((sum, g) => sum + (g.playtime2WeeksMinutes ?? 0), 0) ?? 0,
    [owned]
  );
  const topGame = owned?.games?.[0] ?? null;
  // Most recently launched game, preferring one distinct from topGame so the
  // two game cells in the band carry independent signals. Falls through to
  // the most-recent-overall if the only recently-played title is also the
  // top-played one (a single-game library or a heavily focused player).
  const recentGame = useMemo(() => {
    if (!owned?.games) return null;
    const played = owned.games
      .filter((g) => g.rtimeLastPlayedAt != null)
      .sort(
        (a, b) =>
          // biome-ignore lint/style/noNonNullAssertion: filtered above
          new Date(b.rtimeLastPlayedAt!).getTime() -
          // biome-ignore lint/style/noNonNullAssertion: filtered above
          new Date(a.rtimeLastPlayedAt!).getTime()
      );
    if (played.length === 0) return null;
    const distinct = played.find((g) => g.appid !== topGame?.appid);
    return distinct ?? played[0] ?? null;
  }, [owned, topGame]);

  return (
    <m.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: compact ? 0 : 1 }}
      transition={reduced ? { duration: 0 } : { delay: compact ? 0 : 0.3, duration: 0.3 }}
      className="relative grid grid-cols-2 items-center gap-x-6 gap-y-4 border-white/10 border-t bg-background/20 px-6 py-4 backdrop-blur-xs sm:grid-cols-4"
    >
      {recentGame?.rtimeLastPlayedAt ? (
        <RecentlyPlayedCell
          appid={recentGame.appid}
          name={recentGame.name}
          assetTimestamp={recentGame.assetTimestamp}
          lastPlayedAt={recentGame.rtimeLastPlayedAt}
        />
      ) : (
        <Stat value="—" label="Recently played" />
      )}
      {totalMinutes != null ? (
        <TotalPlaytimeCell totalMinutes={totalMinutes} recentMinutes={recentMinutes} />
      ) : (
        <Stat value="—" label="Total playtime" />
      )}
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
    </m.div>
  );
}
