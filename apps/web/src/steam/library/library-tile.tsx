import { cn } from "@/lib/utils";
import {
  steamCapsuleUrl,
  steamLibraryCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { Link } from "@tanstack/react-router";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useState } from "react";
import { LibraryTileHovercardContent } from "./library-tile-hovercard";

const HOVERCARD_CONTENT_CLASS =
  "z-50 w-64 overflow-hidden rounded-md border bg-popover/90 text-popover-foreground shadow-xl backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

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
      <HoverCardPrimitive.Root openDelay={200} closeDelay={100}>
        <HoverCardPrimitive.Trigger asChild>
          <Link
            to="/steam/game/$appid"
            params={{ appid: String(game.appid) }}
            className="flex flex-col gap-5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="relative isolate aspect-2/3 origin-top overflow-hidden rounded-lg bg-muted shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-[filter,box-shadow,transform] duration-500 ease-out transform-[perspective(700px)_rotateX(0deg)_rotateY(0deg)_scale(1)] group-hover/tile:shadow-[0_24px_38px_-10px_rgba(0,0,0,0.7),0_12px_24px_-8px_rgba(255,255,255,0.15)] group-hover/tile:brightness-[1.1] group-hover/tile:saturate-[1.1] group-hover/tile:transform-[perspective(700px)_rotateX(7deg)_rotateY(-9deg)_scale(1.02)]">
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
                  className="h-full w-full object-cover transition-[opacity,transform] duration-600 ease-out group-hover/tile:scale-110"
                />
              )}
              {/* Steam-style anchored sheen — gradient stays pinned at the
                  top-right corner (gradient direction 225° puts the bright stop
                  at the upper-right) and the transparent end-stop animates via
                  the registered --sheen-extent variable (see index.css). At
                  rest the falloff reaches 25% of the diagonal — a tight gloss
                  at the corner only. On hover it extends to 75%, growing
                  inward toward the middle without translating any hard edge
                  across the card. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.12)_calc(var(--sheen-extent)-6%),rgba(255,255,255,0)_var(--sheen-extent))] opacity-20 transition-[--sheen-extent,opacity] duration-900 ease-out [--sheen-extent:25%] group-hover/tile:opacity-100 group-hover/tile:[--sheen-extent:42%]"
              />
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
        </HoverCardPrimitive.Trigger>
        <HoverCardPrimitive.Portal>
          <HoverCardPrimitive.Content
            side="right"
            align="start"
            sideOffset={16}
            collisionPadding={16}
            className={HOVERCARD_CONTENT_CLASS}
          >
            <LibraryTileHovercardContent game={game} />
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCardPrimitive.Root>
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

  // wsrv.nl forwards upstream 404s as `200 OK` with an empty body, so a
  // missing asset fires `onLoad` rather than `onError`. Promote the missing-
  // image case to the failed branch via `naturalWidth === 0` — required for
  // titles like CoD MW2 MP / MGSV GZ where the logo simply doesn't exist
  // and we want the text fallback to render in its place.
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setHeroFailed(true);
    else setHeroLoaded(true);
  };
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  if (heroFailed) {
    // Truly artless titles (e.g. Deus Ex: HR — predates the library_hero
    // spec) get a blurred header.jpg backdrop behind the wordmark. header.jpg
    // is the most universally-available Steam asset; if it's also missing,
    // the backdrop sits on `bg-muted` from the outer tile div.
    return (
      <>
        <img
          src={steamCapsuleUrl(game.appid, game.headerPath, game.assetTimestamp, 600)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full scale-110 object-cover blur-sm"
        />
        <div className="absolute inset-0 bg-card/50" />
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center">
          <span className="line-clamp-4 text-sm font-medium text-white drop-shadow-lg">
            {game.name}
          </span>
        </div>
      </>
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
        onLoad={handleHeroLoad}
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
          src={steamLibraryLogoUrl(game.appid, game.logoPath, 360)}
          alt={game.name}
          loading="lazy"
          onLoad={handleLogoLoad}
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
