import { cn } from "@/lib/utils";
import {
  makeHeroFallbackHandlers,
  steamLibraryHeroPaletteUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { type ReactNode, type RefObject, useState } from "react";

// Reusable Steam-native row shell. Composition mirrors the Steam Library's
// "recent activity" tile: the landscape hero art sits on the right half of
// the row at near-natural aspect and is feathered into the card body via
// a CSS mask (no hard seam between art and text), with a blurred copy of
// the same hero filling the row beneath so the left side has visual
// texture instead of an empty dark rectangle. Same `steamLibraryHeroUrl`
// for both means one network fetch (the browser dedupes). The wordmark
// logo overlays the content column on the left as the "title"; meta + an
// optional trailing slot stack underneath.
//
// View-transition morph anchors: `heroRef` attaches to the sharp foreground
// hero img (named `steam-game-${appid}-hero` on the destination), `logoRef`
// to the wordmark (named `-logo`). Pair names lock these two landmarks
// across the route swap. See library-tile.tsx and
// docs/working-notes/cross-cutting/view-transitions-rollout.md.

export interface SteamGameRowShellProps {
  appid: number;
  assetTimestamp?: number | bigint | null;
  // Used as the logo's alt text and as the visible wordmark fallback when
  // the logo asset is missing. Pass the game's display name, not the appid.
  name: string;
  meta?: ReactNode;
  // Right-aligned trailing slot. Render visual indicators only (icons,
  // badges); never put click targets here because the row wrapper is the
  // click target and nested interactives break accessibility.
  trailing?: ReactNode;
  // View-transition morph anchors. `heroRef` attaches to the foreground
  // hero img, `logoRef` to the wordmark logo img — the caller applies
  // `view-transition-name` to each in onClick, pairing with matching names
  // on the destination game-detail page. Only the library row uses these;
  // the wishlist row leaves them undefined (external navigation has no
  // morph destination). When a layer has fallen back to a text/error
  // branch (heroFailed / logoFailed), the corresponding ref's .current is
  // null — callers must null-check before touching `.style`.
  heroRef?: RefObject<HTMLImageElement | null>;
  logoRef?: RefObject<HTMLImageElement | null>;
  className?: string;
}

export function SteamGameRowShell({
  appid,
  assetTimestamp,
  name,
  meta,
  trailing,
  heroRef,
  logoRef,
  className,
}: SteamGameRowShellProps) {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Hero img uses the shared hero → page-background fallback chain
  // (see makeHeroFallbackHandlers). Logo has no second URL — older
  // titles never shipped a wordmark image, so the failed branch goes
  // straight to the text fallback. wsrv.nl forwards upstream 404s as
  // `200 OK` with empty bytes, so `naturalWidth === 0` in onLoad is the
  // real failure signal (mirrors library-tile.tsx + game.$appid.tsx).
  const heroHandlers = makeHeroFallbackHandlers({
    appid,
    assetTimestamp,
    onSuccess: () => setHeroLoaded(true),
    onMissing: () => setHeroFailed(true),
  });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  return (
    <div
      className={cn(
        // Card chrome — mirrors library-tile.tsx's hover pattern (CSS-only
        // perspective tilt + shadow lift + sheen) with values dialed down
        // for the wider row aspect: less rotateY (heavy side-rotation
        // warps wide rects more than square tiles), barely-perceptible
        // scale. The consumer wraps this in a Link/<a> that carries the
        // `group/row` token, so all hover utilities fire from that token.
        // `perspective(...)` lives on :hover only — see comment on the
        // matching tile chrome in library-tile.tsx for the Safari
        // composite-layer rationale.
        "relative isolate h-32 overflow-hidden rounded-lg border border-border/40 bg-card shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-[colors,box-shadow,transform] duration-500 ease-out sm:h-36",
        "group-hover/row:border-border group-hover/row:shadow-[0_18px_28px_-10px_rgba(0,0,0,0.7),0_10px_20px_-8px_rgba(255,255,255,0.1)] group-hover/row:transform-[perspective(900px)_rotateX(2deg)_rotateY(-1.5deg)_scale(1.005)]",
        className
      )}
    >
      {/* Backdrop: edge-extended copy of the hero. The API samples the
          asset's leftmost 200px, horizontally averages each row to one
          pixel, then stretches to 1920px — every vertical position in
          the backdrop is the per-row-averaged tint of the asset's
          leftward content at that y. For Pragmata's white edge → white
          bg. For RE3's dark sky → dark sky bg. For Cyberpunk's yellow
          → yellow bg. The averaging step dissolves localized highlights
          (lanterns, sparks, dust) that would otherwise become hard
          horizontal streaks if we just stretched the leftmost column.

          `object-fill` (NOT cover) is intentional: the foreground hero
          uses `object-contain` which squashes the full 620px asset
          height into the row's 144px. `object-cover` on the backdrop
          would crop top+bottom and stretch only the vertical middle
          band, so at the seam the backdrop would show the asset's
          mid-edge color while the foreground shows top/bottom edge
          colors (RE3 sunset bg vs dark-sky foreground top). `fill`
          stretches y 1:1 with the foreground's contain mapping; every
          x is uniform color so non-uniform horizontal stretch adds no
          artifact.

          Horizontal mask fades the backdrop in over the left ~half so
          the streaky / averaged region only shows in the right half
          where it flanks the foreground hero — without the mask, the
          backdrop was reading as the dominant element of the card
          (especially on assets with non-trivial leftward content). The
          card's dark bg shows through on the left half, reframing the
          backdrop as "atmospheric extension flanking the hero" rather
          than "streaky bg with a hero pasted on the right." */}
      {!heroFailed && (
        <img
          src={steamLibraryHeroPaletteUrl(appid, assetTimestamp)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 size-full object-fill [mask-image:linear-gradient(to_right,transparent_0%,black_55%)] [mask-repeat:no-repeat] [mask-size:100%_100%]"
        />
      )}

      {/* Left-anchored dim for text legibility. The extended-edge bg
          carries the asset's actual edge color — sometimes bright
          (Pragmata white, Cyberpunk yellow) — so we need a soft
          darkening over the text zone for white text to read. The
          gradient fades to transparent before the hero starts so the
          bg's edge tones remain visible on the right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-3/5 bg-[linear-gradient(to_right,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.45)_40%,rgba(0,0,0,0.15)_75%,rgba(0,0,0,0)_100%)]"
      />

      {/* Sharp foreground hero — right-anchored at natural ~3:1 aspect.
          Left edge feathers into the extended-edge backdrop so the
          transition between "actual hero" and "edge-extension" is
          smooth. Since the backdrop's right edge color matches the
          hero's left edge color (same source pixels), the feather
          blends colors that are already tonally consistent. */}
      {!heroFailed && (
        <img
          ref={heroRef}
          src={steamLibraryHeroUrl(appid, assetTimestamp)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onLoad={heroHandlers.onLoad}
          onError={heroHandlers.onError}
          className={cn(
            "absolute inset-y-0 right-0 h-full w-auto max-w-full object-contain object-right transition-[opacity,transform] duration-600 ease-out",
            "[mask-image:linear-gradient(to_right,transparent_0%,black_30%)] [mask-repeat:no-repeat] [mask-size:100%_100%]",
            "group-hover/row:scale-105",
            heroLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Steam-style anchored sheen — same gradient pattern as the tile
          (see library-tile.tsx), anchored at the top-right corner. The
          `--sheen-extent` registered CSS variable animates the falloff
          on hover so the gloss grows inward without translating a hard
          edge across the row. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.12)_calc(var(--sheen-extent)-6%),rgba(255,255,255,0)_var(--sheen-extent))] opacity-20 transition-[--sheen-extent,opacity] duration-900 ease-out [--sheen-extent:25%] group-hover/row:opacity-100 group-hover/row:[--sheen-extent:42%]"
      />

      {/* Content overlay — anchored to the left. The logo wordmark IS the
          title; the text fallback only renders when the logo asset is
          missing. The container is width-capped so it never overlaps the
          hero focal region. */}
      <div className="absolute inset-0 flex items-center px-4 sm:px-5">
        <div className="flex min-w-0 max-w-[60%] flex-col gap-1.5">
          {logoFailed ? (
            <span className="line-clamp-1 text-base font-bold text-white drop-shadow-lg sm:text-lg">
              {name}
            </span>
          ) : (
            <img
              ref={logoRef}
              src={steamLibraryLogoUrl(appid, assetTimestamp)}
              alt={name}
              loading="lazy"
              decoding="async"
              onLoad={handleLogoLoad}
              onError={() => setLogoFailed(true)}
              className={cn(
                // Generous bbox so logos with built-in transparent
                // padding (RE Requiem, Cyberpunk) render at comparable
                // size to tightly-cropped ones (RE2). Logo sits on
                // solid card bg, so no drop-shadow is needed for
                // legibility.
                "max-h-12 max-w-56 object-contain object-left transition-opacity duration-500 ease-out sm:max-h-14",
                logoLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {meta ? (
            <span className="line-clamp-1 text-xs font-medium text-white/85 drop-shadow-sm sm:text-sm">
              {meta}
            </span>
          ) : null}
        </div>
      </div>

      {trailing ? (
        <div className="absolute top-2 right-3 flex items-center text-white/80 drop-shadow sm:top-3 sm:right-4">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
