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
        "relative h-32 overflow-hidden rounded-lg border border-border/40 bg-card/50 transition-colors hover:border-border sm:h-36",
        className
      )}
    >
      {/* Bottom layer: blurred copy of the same hero asset fills the
          entire row, giving the left content column visual texture
          instead of a dead dark rectangle. Shares its src with the
          foreground hero below, so the browser fetches the asset once.
          Not a morph anchor — the foreground hero handles that. */}
      {!heroFailed && (
        <img
          src={steamLibraryHeroUrl(appid, assetTimestamp)}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 size-full object-cover blur-md saturate-150"
        />
      )}
      {/* Dark wash over the whole row, plus a left-anchored gradient that
          deepens the area under the logo + meta column. Without the second
          layer, light hero art (Monster Hunter's sky, Batman's white bg)
          washes out the wordmark even with a drop-shadow. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-y-0 left-0 w-3/4 bg-linear-to-r from-black/80 via-black/40 to-transparent" />

      {/* Hero art on the right ~55% of the row. mask-image feathers the
          left edge into the backdrop so there's no vertical seam between
          the hero strip and the content area. The hero rect is sized close
          to the asset's 3:1 native aspect, which keeps subjects (heads,
          weapons, focal poses) in frame without aggressive top/bottom
          cropping. */}
      {!heroFailed && (
        <img
          ref={heroRef}
          src={steamLibraryHeroUrl(appid, assetTimestamp)}
          alt=""
          aria-hidden
          loading="lazy"
          onLoad={heroHandlers.onLoad}
          onError={heroHandlers.onError}
          className={cn(
            "absolute inset-y-0 right-0 h-full w-3/5 object-cover transition-opacity duration-500 ease-out",
            "[mask-image:linear-gradient(to_right,transparent_0%,black_45%)] [mask-repeat:no-repeat] [mask-size:100%_100%]",
            heroLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

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
              onLoad={handleLogoLoad}
              onError={() => setLogoFailed(true)}
              className={cn(
                // Stacked drop-shadow approximates an outline — keeps the
                // wordmark legible against any hero color (bright skies,
                // white poster backgrounds) where a single shadow washes out.
                "h-9 max-w-full object-contain object-left transition-opacity duration-500 ease-out sm:h-10",
                "[filter:drop-shadow(0_0_6px_rgba(0,0,0,0.85))_drop-shadow(0_2px_3px_rgba(0,0,0,0.9))]",
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
