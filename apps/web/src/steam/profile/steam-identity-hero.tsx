import { cn } from "@/lib/utils";
import { steamLibraryHeroUrl } from "@/steam/_shared/steam-image";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { useSteamPlayerState } from "@/steam/use-player-state";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { formatTimeAgo } from "@vyoh/shared";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { type PointerEvent, useState } from "react";

// Persona-state → presence label + dot colour. "Online status only" presence
// line (owner decision): no most-played echo here — that lives in the stat band.
const PRESENCE: Record<string, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-emerald-400" },
  busy: { label: "Busy", dot: "bg-rose-400" },
  away: { label: "Away", dot: "bg-amber-400" },
  snooze: { label: "Snoozing", dot: "bg-amber-400" },
  "looking-to-trade": { label: "Looking to trade", dot: "bg-sky-400" },
  "looking-to-play": { label: "Looking to play", dot: "bg-sky-400" },
  offline: { label: "Offline", dot: "bg-muted-foreground" },
};

function memberSinceYear(unix: number): number {
  return new Date(unix * 1000).getUTCFullYear();
}

// Cinematic Steam identity hero for the profile landing — the parallel of the
// LoL hero. The backdrop is the currently-played game's hero art when in-game
// (live), else the most-played game's hero art (a stable "defining game"); the
// art carries a slow pointer parallax that collapses under reduced motion. The
// identity headline mirrors LoL's rank line with Steam's honest equivalent:
// "Member since {year} · Level {n} · top {p}%". Coexists with the section-wide
// SteamProfileBackdrop (ambient blur) — this is the focused, contained banner.
export function SteamIdentityHero() {
  const { data: summary } = useSteamSummary();
  const { data: playerState } = useSteamPlayerState();
  const { data: owned } = useSteamOwnedGames();
  const reduced = useReducedMotion();

  // Backdrop subject: live current game wins; else the most-played owned title
  // (owned games arrive sorted by lifetime playtime descending, so [0] is the
  // defining game). Null until either resolves — the hero renders on the
  // ambient backdrop alone in the meantime.
  const liveGame = playerState?.currentGame ?? null;
  const topGame = owned?.games?.[0] ?? null;
  const heroAppId = liveGame?.appid ?? topGame?.appid ?? null;
  // assetTimestamp only known for owned titles; the live game may not be owned
  // (free weekend, family share) — fall back to 0, which the proxy tolerates.
  const heroAssetTs =
    liveGame && topGame && liveGame.appid === topGame.appid
      ? topGame.assetTimestamp
      : liveGame
        ? null
        : topGame?.assetTimestamp;
  const heroUrl = heroAppId ? steamLibraryHeroUrl(heroAppId, heroAssetTs) : null;
  const [heroLoaded, setHeroLoaded] = useState(false);

  const presence = summary ? PRESENCE[summary.personaState] : null;
  const inGame = !!liveGame;
  // Poller staleness, folded in from the deleted NowPlayingChip — its one bit
  // of non-duplicated info. The player-state poller runs every ~2 min, so this
  // tells the viewer how fresh the presence read is.
  const lastChecked = playerState?.lastPolledAt
    ? formatTimeAgo(playerState.lastPolledAt)
    : null;

  // Pointer parallax — same treatment as the LoL hero; springs smooth the raw
  // pointer signal and the transform sits on a wrapper distinct from the
  // Ken-Burns element so the two compose cleanly.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18 });
  const sy = useSpring(py, { stiffness: 120, damping: 18 });
  const tx = useTransform(sx, [-1, 1], [12, -12]);
  const ty = useTransform(sy, [-1, 1], [10, -10]);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const resetPointer = () => {
    px.set(0);
    py.set(0);
  };

  const avatarSrc =
    summary?.animatedAvatarUrl && !reduced
      ? summary.animatedAvatarUrl
      : summary?.avatarUrl;

  return (
    <section
      onPointerMove={onPointerMove}
      onPointerLeave={resetPointer}
      className="relative isolate overflow-hidden rounded-2xl border border-border/40"
    >
      {heroUrl && (
        <div aria-hidden className="-z-10 absolute inset-0">
          <m.div className="absolute inset-0" style={{ x: tx, y: ty }}>
            <div className="lol-hero-drift absolute -inset-[7%]">
              <img
                src={heroUrl}
                alt=""
                loading="eager"
                decoding="async"
                onLoad={() => setHeroLoaded(true)}
                className={cn(
                  "size-full object-cover object-[60%_30%] transition-opacity duration-700",
                  heroLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </m.div>
          {/* Legibility scrim — left-to-right darkens the text column, bottom
              fade dissolves the hero into the page (mirrors the LoL hero). */}
          <div className="absolute inset-0 bg-gradient-to-r from-background from-5% via-background/55 via-45% to-transparent to-80%" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
        </div>
      )}

      <div className="relative flex min-h-[220px] items-end gap-4 p-6 sm:min-h-[280px]">
        <div className="relative shrink-0">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="size-20 rounded-full object-cover ring-2 ring-white/15 sm:size-24"
            />
          ) : (
            <div className="size-20 animate-pulse rounded-full bg-muted ring-2 ring-white/15 sm:size-24" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {summary ? (
            <h2 className="truncate font-semibold text-3xl tracking-tight drop-shadow-sm sm:text-4xl">
              {summary.personaName}
            </h2>
          ) : (
            <div className="h-9 w-56 animate-pulse rounded bg-muted" />
          )}

          {/* Identity headline — the rank-parallel line. Each segment is
              independently optional (privacy-locked accounts may omit any). */}
          {summary && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-muted-foreground text-sm">
              {summary.memberSinceUnix !== undefined && (
                <span>Member since {memberSinceYear(summary.memberSinceUnix)}</span>
              )}
              {summary.steamLevel !== undefined && (
                <>
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                  <span className="font-semibold text-foreground/90">
                    Level {summary.steamLevel}
                  </span>
                </>
              )}
              {summary.steamLevelPercentile !== undefined && (
                <span className="text-muted-foreground/80">
                  top {Math.max(1, Math.round(100 - summary.steamLevelPercentile))}%
                </span>
              )}
            </p>
          )}

          {/* Presence line — online status only, with the poller staleness
              folded in (absorbed from the now-deleted NowPlayingChip; the chip
              duplicated the game art + presence the hero already owns, leaving
              only "last checked" as unique). In-game gets a live emerald
              treatment with the game name; otherwise the persona-state dot. */}
          {inGame ? (
            <p className="flex items-center gap-1.5 text-emerald-300 text-xs">
              <span className="relative flex size-2">
                {!reduced && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Now playing {liveGame.name}
              {lastChecked && (
                <span className="text-emerald-300/60">· checked {lastChecked}</span>
              )}
            </p>
          ) : (
            presence && (
              <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span className={cn("inline-flex size-2 rounded-full", presence.dot)} />
                {presence.label}
                {lastChecked && (
                  <span className="text-muted-foreground/60">· checked {lastChecked}</span>
                )}
              </p>
            )
          )}
        </div>
      </div>
    </section>
  );
}
