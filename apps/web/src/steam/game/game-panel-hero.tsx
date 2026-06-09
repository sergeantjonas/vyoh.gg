import { cn } from "@/lib/utils";
import {
  makeHeroFallbackHandlers,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { GameHeroTrailerPill } from "@/steam/game/game-hero-trailer-pill";
import type { GameOrigin } from "@/steam/library/active-game-context";
import { useActiveGame } from "@/steam/library/active-game-context";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useReducedMotion } from "motion/react";
import { type SyntheticEvent, useLayoutEffect, useRef, useState } from "react";

// Panel hero block for `/steam/library/$appid`. Carries the hero img
// (1920×620), dark gradient, logo wordmark (or text fallback), and the
// microtrailer quick-preview pill. Owns its own load-state machinery for
// hero + logo + and the row→panel FLIP morph.
//
// LoL parity: mirrors `MatchHero` — a self-contained child component with
// its own `useRef` + `useLayoutEffect([])` driving the FLIP. The mount
// effect runs at THIS component's commit time, after Radix Dialog's
// internal Presence cycle has placed the panel content into the DOM.
// Putting the same effect on the panel route's parent component fires
// before Radix mounts, leaving the ref null and the morph dead. See
// docs/working-notes/cross-cutting/2.3-steam-panel-handover.md if
// reverting.
//
// FLIP forward fallback for engines without View Transitions (Firefox,
// Safari): library-row's onPointerDown captures the row chrome rect into
// `originRectRef` with direction "forward"; we FLIP-animate from that
// rect to the natural panel-hero rect on mount. The VT path (Chromium)
// runs independently via per-element `view-transition-name`s and skips
// rect capture entirely because library-row's onPointerDown early-returns
// when VT is supported. Tile clicks don't capture an origin (the 2:3 →
// 3:1 aspect mismatch reads as distortion under a chrome FLIP), so tile
// → panel snaps in.
export function GamePanelHero({
  appid,
  appidParam,
  game,
  logoFailed,
  setLogoFailed,
}: {
  appid: number;
  appidParam: string;
  game: SteamOwnedGame | undefined;
  logoFailed: boolean;
  setLogoFailed: (v: boolean) => void;
}) {
  const { originRectRef, setOriginRect } = useActiveGame();
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  // StrictMode-resilient: capture the origin once on first mount so the
  // dev-mode double-mount can't lose it before the surviving instance
  // consumes it via the RAF below.
  const savedOrigin = useRef<GameOrigin | null>(null);

  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  const heroHandlers = makeHeroFallbackHandlers({
    appid,
    assetTimestamp: game?.assetTimestamp ?? null,
    onSuccess: () => setHeroLoaded(true),
    onMissing: () => setHeroFailed(true),
  });
  // wsrv.nl forwards upstream 404s as `200 OK` with empty bytes, so a
  // missing logo fires `onLoad` instead of `onError`. Promote zero-width
  // loads to the failed branch so the text fallback renders.
  const handleLogoLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (!o || o.appid !== appid || o.direction !== "forward") return;
      savedOrigin.current = o;
    }
    const origin = savedOrigin.current;
    if (!origin || !heroRef.current) return;
    if (reduced) return;
    const el = heroRef.current;
    // Hide until the RAF fires so React's first paint at the destination
    // position doesn't flash before the animation starts.
    el.style.visibility = "hidden";
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      setOriginRect(null);
      el.style.visibility = "";
      const dr = el.getBoundingClientRect();
      const dx = origin.heroRect.left - dr.left;
      const dy = origin.heroRect.top - dr.top;
      const sx = origin.heroRect.width / dr.width;
      const sy = origin.heroRect.height / dr.height;
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      el.style.visibility = "";
    };
  }, []);

  return (
    // `view-transition-name` lives on this wrapper rather than the `<img>`
    // so the snapshot captures both the hero and the dark gradient layered
    // over it. With the name on the img alone, the gradient renders into
    // the root group and pops in at the end of the morph; naming the
    // wrapper folds it into the same snapshot pair.
    <div
      ref={heroRef}
      data-steam-game-hero={appid}
      style={{ viewTransitionName: `steam-game-${appid}-hero` }}
      className="relative aspect-1920/620 w-full overflow-hidden rounded-lg border bg-linear-to-br from-muted via-card to-muted"
    >
      {!heroFailed && (
        <img
          src={steamLibraryHeroUrl(appid, game?.assetTimestamp, game?.flipHero)}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={heroHandlers.onLoad}
          onError={heroHandlers.onError}
          className={cn(
            // Flip is baked into the URL — see `steamLibraryHeroUrl`.
            // CSS-only `transform: scaleX(-1)` survives in the static DOM
            // but is stripped from view-transition snapshot pixels, so
            // the morph would animate between un-flipped frames.
            "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
            heroLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
      {logoFailed ? (
        <h2 className="absolute bottom-4 left-4 max-w-[55%] text-xl font-bold text-white drop-shadow-lg sm:bottom-6 sm:left-6 sm:text-2xl">
          {game?.name ?? `App ${appidParam}`}
        </h2>
      ) : (
        <img
          src={steamLibraryLogoUrl(appid, game?.assetTimestamp)}
          alt={game?.name ?? `App ${appidParam}`}
          loading="eager"
          onLoad={handleLogoLoad}
          onError={() => setLogoFailed(true)}
          data-steam-game-logo={appid}
          style={{ viewTransitionName: `steam-game-${appid}-logo` }}
          className={cn(
            "absolute bottom-4 left-4 h-1/3 max-w-[55%] object-contain object-bottom-left drop-shadow-lg transition-opacity duration-500 ease-out sm:bottom-6 sm:left-6",
            logoLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      {game && (
        <GameHeroTrailerPill
          microtrailerWebm={game.microtrailerWebm}
          microtrailerMp4={game.microtrailerMp4}
          microtrailerPoster={game.microtrailerPoster}
          microtrailerName={game.microtrailerName}
        />
      )}
    </div>
  );
}
