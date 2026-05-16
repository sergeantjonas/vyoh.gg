import { steamCapsuleUrl, steamLibraryHeroUrl } from "@/steam/_shared/steam-image";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useState } from "react";

// Steam-client-style "TIME PLAYED" copy. Single-digit hours get a tenths
// precision ("3.4 hrs"); ≥10h rounds to whole hours; sub-hour shows minutes;
// zero gets "0 min" to mirror Steam's never-played fallback.
function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} hrs`;
  return `${Math.round(hours).toLocaleString("en-US")} hrs`;
}

export function LibraryTileHovercardContent({ game }: { game: SteamOwnedGame }) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);

  // wsrv.nl forwards upstream 404s as 200 OK with empty body — same trick the
  // outer tile uses to detect a missing library_hero.jpg. When it's missing,
  // fall through to header.jpg (the universally-available Steam asset).
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setHeroFailed(true);
    else setHeroLoaded(true);
  };

  const twoWeeks = game.playtime2WeeksMinutes ?? 0;
  const total = game.playtimeForeverMinutes;

  return (
    <div className="flex flex-col">
      <div className="relative aspect-[2/1] overflow-hidden bg-muted">
        {!heroFailed ? (
          <img
            src={steamLibraryHeroUrl(
              game.appid,
              game.libraryHeroPath,
              game.assetTimestamp,
              640
            )}
            alt=""
            onLoad={handleHeroLoad}
            onError={() => setHeroFailed(true)}
            style={{ opacity: heroLoaded ? 1 : 0 }}
            className="h-full w-full object-cover transition-opacity duration-300"
          />
        ) : (
          <img
            src={steamCapsuleUrl(game.appid, game.headerPath, game.assetTimestamp, 640)}
            alt=""
            className="h-full w-full scale-105 object-cover blur-[2px]"
          />
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <span className="line-clamp-2 text-sm font-semibold">{game.name}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
            Time played
          </span>
          <div className="flex justify-between text-xs tabular-nums">
            <span className="text-muted-foreground">Last two weeks</span>
            <span>{formatPlaytime(twoWeeks)}</span>
          </div>
          <div className="flex justify-between text-xs tabular-nums">
            <span className="text-muted-foreground">Total</span>
            <span>{formatPlaytime(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
