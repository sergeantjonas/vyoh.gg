import { cn } from "@/lib/utils";
import {
  makeHeroFallbackHandlers,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { type ReactNode, type RefObject, useState } from "react";

// Reusable Steam-native row shell. Composition mirrors Steam's own "Recent
// Activity" tiles: the hero art covers the row full-bleed with a per-asset
// `(subjectXPercent, subjectYPercent)` anchor steering `object-position` so
// the focal subject stays in frame regardless of where it sits in the
// source `library_hero.jpg`. Saliency-derived anchors are computed at
// enrichment (smartcrop-sharp; see SteamSubjectAnchorService). Null
// anchors render as a centered crop. A left-side dim gradient over the
// art carries text legibility for the wordmark logo + meta line.
//
// View-transition morph anchors: `heroRef` attaches to the cover hero img
// (named `steam-game-${appid}-hero` on the destination), `logoRef` to the
// wordmark (named `-logo`). Pair names lock these two landmarks across
// the route swap. See library-tile.tsx and
// docs/working-notes/cross-cutting/view-transitions-rollout.md.

export interface SteamGameRowShellProps {
  appid: number;
  assetTimestamp?: number | bigint | null;
  // Used as the logo's alt text and as the visible wordmark fallback when
  // the logo asset is missing. Pass the game's display name, not the appid.
  name: string;
  meta?: ReactNode;
  // Saliency-derived anchor for the hero's `object-position`. Null/undefined
  // renders as 50/50 (centered crop). See SteamSubjectAnchorService for how
  // these are derived from `library_hero.jpg` at enrichment time.
  subjectXPercent?: number | null;
  subjectYPercent?: number | null;
  // When true, the hero is rendered mirrored horizontally (`scaleX(-1)`)
  // so a face at the left of source lands on the right of the row, clear
  // of the wordmark. The X anchor is already inverted at enrichment time,
  // so this prop only drives the visual flip. The game-detail destination
  // hero must apply the same flip for the view-transition morph to stay
  // continuous across the route swap.
  flipHero?: boolean;
  // Right-aligned trailing slot. Render visual indicators only (icons,
  // badges); never put click targets here because the row wrapper is the
  // click target and nested interactives break accessibility.
  trailing?: ReactNode;
  // View-transition morph anchors. `heroRef` attaches to the cover hero
  // img, `logoRef` to the wordmark logo img — the caller applies
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
  subjectXPercent,
  subjectYPercent,
  flipHero,
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
    flipHero: flipHero ?? false,
    onSuccess: () => setHeroLoaded(true),
    onMissing: () => setHeroFailed(true),
  });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  const xPct = subjectXPercent ?? 50;
  const yPct = subjectYPercent ?? 50;

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
        "relative isolate h-36 overflow-hidden rounded-lg border border-border/40 bg-card shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-[colors,box-shadow,transform] duration-500 ease-out sm:h-40",
        "group-hover/row:border-border group-hover/row:shadow-[0_18px_28px_-10px_rgba(0,0,0,0.7),0_10px_20px_-8px_rgba(255,255,255,0.1)] group-hover/row:transform-[perspective(900px)_rotateX(2deg)_rotateY(-1.5deg)_scale(1.005)]",
        className
      )}
    >
      {/* Full-bleed cover hero — `object-position` steered by the
          saliency anchor so the focal subject stays in frame across the
          row's wide aspect (~8:1 container vs ~3:1 source). The source
          asset is the same `library_hero.jpg` used by the destination
          game page; one network fetch covers both via browser dedupe.
          Inline `style` rather than a Tailwind arbitrary class because
          the percentages are dynamic per-row. */}
      {!heroFailed && (
        <img
          ref={heroRef}
          src={steamLibraryHeroUrl(appid, assetTimestamp, flipHero)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          onLoad={heroHandlers.onLoad}
          onError={heroHandlers.onError}
          style={{ objectPosition: `${xPct}% ${yPct}%` }}
          className={cn(
            // The horizontal flip (when flipHero is true) is baked into
            // the URL — see `steamLibraryHeroUrl` — rather than applied
            // via CSS `transform: scaleX(-1)`. View-transition snapshots
            // strip CSS transforms from the captured pixels, so a
            // CSS-only flip would un-mirror during the morph animation
            // even though the static DOM still renders flipped.
            "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-600 ease-out",
            "group-hover/row:scale-105",
            heroLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Left-anchored dim for text legibility. The cover hero can be
          arbitrarily bright on the left side (Pragmata's white edge,
          Cyberpunk's yellow); this gradient ramps darkness over the
          leftmost ~55% so the wordmark + meta read against any source.
          Falls to transparent past the text zone so the right half of
          the art remains untouched. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-3/5 bg-[linear-gradient(to_right,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.55)_35%,rgba(0,0,0,0.2)_70%,rgba(0,0,0,0)_100%)]"
      />

      {/* Steam-style anchored sheen — same gradient pattern as the tile
          (see library-tile.tsx), anchored at the top-right corner. The
          `--sheen-extent` registered CSS variable animates the falloff
          on hover so the gloss grows inward without translating a hard
          edge across the row. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.12)_calc(var(--sheen-extent)-6%),rgba(255,255,255,0)_var(--sheen-extent))] opacity-20 transition-[--sheen-extent,opacity] duration-900 ease-out [--sheen-extent:25%] group-hover/row:opacity-100 group-hover/row:[--sheen-extent:42%]"
      />

      {/* Logo wordmark — anchored vertically centered in the card. The
          logo IS the title; the text fallback only renders when the
          asset is missing. With meta moved to the bottom strip, the
          logo gets the full vertical column to itself, so we can run
          the bbox larger (max-h up from 12/14 to 16/20) without
          colliding with anything. Width-capped at 60% so it never
          overlaps the hero focal region. */}
      <div className="absolute inset-0 flex items-center px-4 sm:px-5">
        <div className="flex min-w-0 max-w-[55%] items-center">
          {logoFailed ? (
            <span className="line-clamp-1 text-lg font-bold text-white drop-shadow-lg sm:text-xl">
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
                // Logos are now trimmed proxy-side (see steam-image.ts
                // LOGO_SCHEMA_VERSION v2), so their visible bboxes are
                // consistent across publishers. The bbox here is sized to
                // produce a roughly title-sized wordmark; drop-shadow
                // keeps light wordmarks legible against bright art that
                // the left-side dim doesn't fully tame (Pragmata, FC2).
                "max-h-16 max-w-64 object-contain object-left drop-shadow-lg transition-opacity duration-500 ease-out sm:max-h-20 sm:max-w-72",
                logoLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
        </div>
      </div>

      {/* Bottom-left meta strip. Pulled out of the logo column so the
          logo can claim the full vertical centre; the meta line still
          reads as a "status" subtitle attached to the card without
          competing for the wordmark's space. */}
      {meta ? (
        <div className="absolute bottom-2 left-4 max-w-[60%] sm:bottom-2.5 sm:left-5">
          <span className="line-clamp-1 text-xs font-medium text-white/85 drop-shadow-sm sm:text-sm">
            {meta}
          </span>
        </div>
      ) : null}

      {trailing ? (
        <div className="absolute top-2 right-3 flex items-center text-white/80 drop-shadow sm:top-3 sm:right-4">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
