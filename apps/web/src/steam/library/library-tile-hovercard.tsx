import { cn } from "@/lib/utils";
import { steamCapsuleUrl, steamLibraryHeroUrl } from "@/steam/_shared/steam-image";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useEffect, useState } from "react";
import { useGameMedia } from "./use-game-media";

const SCREENSHOT_ROTATION_MS = 2_500;
const DAY_MS = 86_400_000;
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

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

function relativeTimeAgo(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return relativeTime.format(months, "month");
  const years = Math.round(days / 365);
  return relativeTime.format(years, "year");
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

  // Component only mounts while the popover is open (Radix unmounts on close),
  // so `enabled: true` here is the lazy-fetch trigger. The hook gates the
  // request server-side via the SteamScreenshotService SWR layer; the first
  // hover of a given game blocks on appdetails, subsequent hovers within the
  // 30-day TTL serve from cache.
  const { data: media } = useGameMedia(game.appid, true);
  const screenshots = media?.screenshots ?? [];
  const [index, setIndex] = useState(0);
  // Gate the first screenshot's appearance on a separate render tick so it
  // animates *in* rather than popping in on top of the hero. Without this,
  // layer 0 mounts at opacity-100 immediately when the query resolves —
  // there's no prior opacity-0 state for the transition to interpolate from,
  // so the eye reads a hard cut. Component unmounts on popover close (Radix
  // Portal), so this resets per-hover automatically.
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (screenshots.length === 0) return;
    const handle = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(handle);
  }, [screenshots.length]);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    // Reset to the first frame each time the screenshot set changes so the
    // first paint of a freshly-loaded game starts at index 0.
    setIndex(0);
    const handle = setInterval(() => {
      // Pause cycling while the tab is backgrounded — the popover may still
      // technically be "open" from Radix's perspective if focus left the
      // window mid-hover. Cheap defensive skip rather than an interval clear.
      if (document.visibilityState === "hidden") return;
      setIndex((i) => (i + 1) % screenshots.length);
    }, SCREENSHOT_ROTATION_MS);
    return () => clearInterval(handle);
  }, [screenshots.length]);

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
        {screenshots.length > 0 && (
          <>
            {/* Black scrim sits *between* hero and screenshots. Fades in with
                the first screenshot, then stays at full opacity for the rest
                of the popover lifetime. The screenshot layers above stagger
                outgoing fade-out + delayed fade-in so during each inter-frame
                gap both are at opacity 0 — this scrim shows through, producing
                a brief blink-to-black. */}
            <div
              className={cn(
                "absolute inset-0 bg-black transition-opacity duration-300 ease-in-out",
                hasEntered ? "opacity-100" : "opacity-0"
              )}
            />
            <div className="absolute inset-0">
              {screenshots.map((s, i) => {
                const isActive = hasEntered && i === index;
                return (
                  <img
                    key={s.thumbUrl}
                    src={s.thumbUrl}
                    alt=""
                    loading="lazy"
                    className={cn(
                      // Outgoing: ease-in so the tail finishes quickly rather
                      // than lingering near opacity 0. Incoming: ease-out so
                      // it enters fast off the black, also clearing the near-0
                      // region quickly. Combined with delay-300, the black
                      // window perceived between frames stays a flicker
                      // (~50–100ms) instead of a hold.
                      "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                      isActive
                        ? "opacity-100 delay-300 ease-out"
                        : "opacity-0 delay-0 ease-in"
                    )}
                  />
                );
              })}
            </div>
          </>
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
          {game.rtimeLastPlayedAt !== null && (
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">Last played</span>
              <span>{relativeTimeAgo(game.rtimeLastPlayedAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
