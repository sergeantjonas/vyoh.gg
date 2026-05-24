import { cn } from "@/lib/utils";
import {
  makeHeroFallbackHandlers,
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
        "relative isolate h-32 overflow-hidden rounded-lg border border-border/40 bg-card/50 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-[colors,box-shadow,transform] duration-500 ease-out sm:h-36",
        "group-hover/row:border-border group-hover/row:shadow-[0_18px_28px_-10px_rgba(0,0,0,0.7),0_10px_20px_-8px_rgba(255,255,255,0.1)] group-hover/row:transform-[perspective(900px)_rotateX(2deg)_rotateY(-1.5deg)_scale(1.005)]",
        className
      )}
    >
      {/* Bottom layer: same hero asset fills the entire row, giving the
          left content column visual texture instead of a dead dark
          rectangle. Shares its src with the foreground hero below, so
          the browser fetches the asset once. Not a morph anchor — the
          foreground hero handles that.
          No `filter:` here (was `blur-md saturate-150`) — any CSS
          filter forces this layer onto its own composite layer, and
          Safari's compositor merged 20 of them per library-row paint.
          The dark wash + gradient above already mute the image to
          background-texture levels without runtime filter cost. */}
      {!heroFailed && (
        <img
          src={steamLibraryHeroUrl(appid, assetTimestamp)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {/* Dark wash over the whole row, plus a left-anchored gradient that
          deepens the area under the logo + meta column. Without the second
          layer, light hero art (Monster Hunter's sky, Batman's white bg)
          washes out the wordmark even with a drop-shadow. The gradient
          carries through with extra darkness past the midpoint so dark
          logos (Firewatch maroon-on-orange-sunset) still sit over a
          mostly-black canvas where the wordmark can read. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-y-0 left-0 w-3/4 bg-linear-to-r from-black/85 via-black/60 to-transparent" />

      {/* Hero art on the right ~55% of the row. mask-image feathers the
          left edge into the backdrop so there's no vertical seam between
          the hero strip and the content area. The hero rect is sized close
          to the asset's 3:1 native aspect, which keeps subjects (heads,
          weapons, focal poses) in frame without aggressive top/bottom
          cropping. On hover, scale + brightness + saturate is applied
          only to this layer (not the whole card) so the overlaid logo +
          meta text don't shift or brighten. */}
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
            // `filter` dropped from the transition list so the
            // brightness/saturate hover change snaps rather than
            // interpolating — same Safari composite-layer reasoning as
            // the tile's transition list (see library-tile.tsx).
            "absolute inset-y-0 right-0 h-full w-3/5 object-cover transition-[opacity,transform] duration-600 ease-out",
            "[mask-image:linear-gradient(to_right,transparent_0%,black_45%)] [mask-repeat:no-repeat] [mask-size:100%_100%]",
            "group-hover/row:scale-105 group-hover/row:brightness-110 group-hover/row:saturate-110",
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
                // Cap both height AND width so wordmark logos with wildly
                // different natural aspect ratios read as comparable
                // presence: wide wordmarks (Dark Souls III ~6:1) hit the
                // width cap and shrink to fit; compact stacked designs
                // (PUBG, Hollow Knight) hit the height cap and grow up
                // to it. No explicit h/w → browser preserves intrinsic
                // aspect inside the bbox automatically. Stacked
                // drop-shadow approximates an outline so the wordmark
                // stays legible against bright art. The tight WHITE
                // halo handles the reverse case — dark wordmarks
                // (Firewatch maroon) against dark gradients — without
                // affecting light logos (white-on-white blends imperceptibly).
                "max-h-12 max-w-56 object-contain object-left transition-opacity duration-500 ease-out sm:max-h-14",
                "[filter:drop-shadow(0_0_6px_rgba(0,0,0,0.9))_drop-shadow(0_2px_3px_rgba(0,0,0,0.9))_drop-shadow(0_0_4px_rgba(255,255,255,0.55))]",
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
