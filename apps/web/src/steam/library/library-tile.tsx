import { cn } from "@/lib/utils";
import {
  steamLibraryCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { Link } from "@tanstack/react-router";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useState } from "react";

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

export function LibraryTile({ game }: { game: SteamOwnedGame }) {
  // Library art priority mirrors Steam's own client: prefer the dedicated
  // 600×900 portrait capsule, fall back to a synthetic composition of the
  // wide hero + logo overlay when the capsule is missing (common for
  // recently-released titles that haven't had the portrait asset uploaded
  // yet — Steam composes this at render time too).
  const [capsuleFailed, setCapsuleFailed] = useState(false);
  const [capsuleLoaded, setCapsuleLoaded] = useState(false);

  const lifetime =
    game.playtimeForeverMinutes > 0 ? formatPlaytime(game.playtimeForeverMinutes) : null;
  const twoWeeks =
    game.playtime2WeeksMinutes !== null && game.playtime2WeeksMinutes > 0
      ? formatPlaytime(game.playtime2WeeksMinutes)
      : null;

  return (
    <li className="group/tile">
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(game.appid) }}
        className="flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted">
          {capsuleFailed ? (
            <HeroFallback game={game} />
          ) : (
            <img
              src={steamLibraryCapsuleUrl(
                game.appid,
                game.libraryCapsulePath,
                game.assetTimestamp
              )}
              alt=""
              loading="lazy"
              onLoad={() => setCapsuleLoaded(true)}
              onError={() => setCapsuleFailed(true)}
              style={{ opacity: capsuleLoaded ? 1 : 0 }}
              className="h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover/tile:scale-105"
            />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium underline-offset-2 group-hover/tile:underline">
            {game.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {lifetime ? `${lifetime} lifetime` : "Never launched"}
            {twoWeeks ? ` · ${twoWeeks} last two weeks` : ""}
          </span>
        </div>
      </Link>
    </li>
  );
}

// Steam-client-style synthetic tile: hero (wide 1920×620, object-cover into
// the portrait box center-crops horizontally) + logo overlay near the bottom,
// with a gradient mask underneath for legibility. Falls through to a plain
// text overlay if the hero itself is unavailable (true artless titles like
// the older MW2 dedicated-launcher entries).
function HeroFallback({ game }: { game: SteamOwnedGame }) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  if (heroFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-card p-3 text-center">
        <span className="line-clamp-4 text-sm font-medium">{game.name}</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={steamLibraryHeroUrl(
          game.appid,
          game.libraryHeroPath,
          game.assetTimestamp,
          600
        )}
        alt=""
        loading="lazy"
        onLoad={() => setHeroLoaded(true)}
        onError={() => setHeroFailed(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out",
          heroLoaded ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent" />
      {logoFailed ? (
        <span className="absolute right-3 bottom-3 left-3 line-clamp-2 text-sm font-bold text-white drop-shadow-lg">
          {game.name}
        </span>
      ) : (
        <img
          src={steamLibraryLogoUrl(game.appid, 360)}
          alt={game.name}
          loading="lazy"
          onLoad={() => setLogoLoaded(true)}
          onError={() => setLogoFailed(true)}
          className={cn(
            "absolute right-3 bottom-3 left-3 max-h-1/3 object-contain object-bottom drop-shadow-lg transition-opacity duration-500 ease-out",
            logoLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </>
  );
}
