import { BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import {
  VIGNETTE_MASK,
  intensityToChromaMultiplier,
  layerToCssGradient,
} from "@/home/ambient-hero";
import { mainScrollRef } from "@/lib/scroll-container";
import { m, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AtmosphereClaim, AtmosphereClaimEntry } from "./use-atmosphere-claim";

// Viewport-intersection weight: 1.0 when the band fully covers the viewport
// (or vice-versa for short bands), proportional otherwise. The earlier
// triangle-proximity model peaked only when a band's center crossed the
// viewport center — that worked for short tiles but failed for pinned recap
// chapters: a 2-viewport-tall pin would only have its claim active for a
// brief moment at mid-pin instead of the whole pin window. Intersection
// peaks the moment the band fully overlaps the viewport and stays there
// throughout the pin.
//
// Caps by `min(rectHeight, containerHeight)`: a band shorter than the
// viewport can never cover more than its own height, a band taller than the
// viewport can never cover more than the visible area — both cases hit
// weight = 1 at full overlap.
function intersectionWeight({
  rectTop,
  rectHeight,
  containerTop,
  containerHeight,
}: {
  rectTop: number;
  rectHeight: number;
  containerTop: number;
  containerHeight: number;
}): number {
  if (containerHeight <= 0 || rectHeight <= 0) return 0;
  const overlapTop = Math.max(rectTop, containerTop);
  const overlapBottom = Math.min(rectTop + rectHeight, containerTop + containerHeight);
  const overlap = Math.max(0, overlapBottom - overlapTop);
  const maxOverlap = Math.min(rectHeight, containerHeight);
  return overlap / maxOverlap;
}

type ResolvedAtmosphere = {
  backgroundImage: string;
  imageUrl: string | null;
  imageAlpha: number;
  imageBlurPx: number;
  // Hue (oklch H, degrees) and intensity (0..1) published to consumers via
  // `--atmosphere-tint-h` / `--atmosphere-intensity`. The orb-mark halo reads
  // both for its "mood ring" behaviour (A-2a).
  tintH: number;
  intensity: number;
  // Optional asset-dominant accent (CSS color string). When set, the layer
  // publishes it as `--accent` on documentElement so per-chapter scrollbar /
  // focus rings / sparklines / theme-color follow the active chapter's hue.
  // `null` outside of subject chapters — falls back to the static neutral
  // token in index.css.
  accentHex: string | null;
  // CSS background-position for the image div. Defaults to "center" when no
  // claim provides a subject anchor; subject chapters with face-detected
  // anchors pass through "{x}% {y}%" so the focal point isn't sliced.
  imagePosition: string;
};

const DEFAULT_TINT_H = 240;
// Heavy-blur default preserves the original ambient claim look. Asset claims
// (recap arc subject chapters) override to ~4–8px for recognizable splash /
// hero art at the same surface.
const DEFAULT_BLUR_PX = 80;

function resolveAtmosphere(
  entries: Iterable<{ claim: AtmosphereClaim; weight: number }>
): ResolvedAtmosphere | null {
  let total = 0;
  let bestWeight = -1;
  let bestClaim: AtmosphereClaim | null = null;
  let blendedIntensity = 0;
  for (const { claim, weight } of entries) {
    if (weight <= 0) continue;
    total += weight;
    blendedIntensity += claim.intensity * weight;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestClaim = claim;
    }
  }
  if (!bestClaim || total === 0) return null;
  const intensity = blendedIntensity / total;
  // Palette interpolation between two claims is non-trivial (per-layer cx/cy/
  // radius/lch all differ). For A-1 we render the dominant claim's palette
  // at the blended intensity. Mixing palettes lands in a later chunk when a
  // second band claims and we can see how harsh the snap reads in practice.
  const backgroundImage = bestClaim.palette.layers
    .map((layer) => layerToCssGradient(layer, intensity))
    .join(", ");
  const imageUrl = bestClaim.image ?? null;
  // Image alpha scales with the dominant claim's contribution. A claim that's
  // half-weighted (band edges entering viewport) fades its image in to match.
  const imageAlpha = imageUrl ? Math.min(1, bestWeight) * intensity : 0;
  // Per-claim blur: heavy-blur ambient claims keep the default; asset chapters
  // pass a smaller value (~4–8px) to land recognizable splash / hero art.
  // `bloomBlurPx` (optional MotionValue) adds to the base each tick — drives
  // the splash-rotation blur-bloom beat without re-rendering on every frame.
  const baseBlurPx = bestClaim.blurPx ?? DEFAULT_BLUR_PX;
  const bloomBlurPx = bestClaim.bloomBlurPx?.get() ?? 0;
  const imageBlurPx = baseBlurPx + bloomBlurPx;
  // Take hue from the dominant claim's *second* layer — its "accent." Layer[0]
  // is the largest radial and dominates the bg colour-impression; if we tint
  // the orb halo with the same hue, the halo loses contrast against the
  // atmosphere bg (e.g. blue halo on blue day, purple halo on purple night).
  // Layer[1] carries the palette's secondary accent (warm sun next to a cool
  // sky, magenta tail next to a purple night) and reads as a complement — the
  // halo pops against the bg by carrying the *other* colour in the palette.
  const accentH = bestClaim.palette.layers[1]?.lch[2];
  const tintH = accentH ?? bestClaim.palette.layers[0]?.lch[2] ?? DEFAULT_TINT_H;
  const accentHex = bestClaim.accentHex ?? null;
  const imagePosition = bestClaim.subjectPosition ?? "center";
  return {
    backgroundImage,
    imageUrl,
    imageAlpha,
    imageBlurPx,
    tintH,
    intensity,
    accentHex,
    imagePosition,
  };
}

const LAYER_CLASS =
  "pointer-events-none fixed inset-0 -z-20 overflow-hidden bg-background";

type Props = { claims: Map<number, AtmosphereClaimEntry> };

/**
 * Renders the single shared atmosphere layer behind every band on `/`. Reads
 * active claims from `AtmosphereProvider`, weights each by viewport-rect
 * intersection, and writes the blend onto inline styles each scroll tick via
 * MotionValues — no React renders during scroll. Portaled to `document.body`
 * for parity with `BackdropPortal` (clean isolation from route content).
 *
 * With zero claims, the layer renders a transparent background-coloured
 * surface. Becomes the bg colour as the page scrolls past the last claim.
 */
export function AtmosphereLayer({ claims }: Props) {
  const backgroundImage = useMotionValue<string>("none");
  const imageOpacity = useMotionValue<number>(0);
  const imageFilter = useMotionValue<string>(`blur(${DEFAULT_BLUR_PX}px) saturate(1.1)`);
  // Two-layer image stack for URL crossfades (skin rotation, claim handoff).
  // The bottom layer is the *current* image — always rendered at opacity 1.
  // The top layer is the *incoming* image — opacity tweens 0 → 1 over the
  // crossfade, then commits into the bottom when the entrance completes.
  //
  // Why two layers instead of `<AnimatePresence>` with `initial/exit`
  // opacity: stacking two semi-transparent layers (exiting at α, entering
  // at 1-α) inside a wrapper at opacity 0.9 exposes ~32.5% of the palette
  // gradient mid-crossfade vs ~10% at rest — geometric composite math:
  // outerOpacity * (oldAlpha + newAlpha * (1 - oldAlpha)) + (1 - outerOpacity)
  // = 0.9 * (0.5 + 0.25) + 0.1 = 0.775, leaving 22.5% extra palette show-
  // through. That show-through reads as the hero / first-page time-of-day
  // palette flashing up between every rotation. The two-layer stack keeps
  // the bottom at opacity 1 throughout, so the palette is never exposed
  // beyond its at-rest ~10%.
  //
  // Each layer carries its own latched `background-position` so the outgoing
  // image's subject anchor doesn't snap to the incoming claim's anchor
  // mid-crossfade — that earlier read as the backdrop sliding under the fade.
  const [layers, setLayers] = useState<{
    bottom: { url: string; position: string } | null;
    top: { url: string; position: string } | null;
  }>({ bottom: null, top: null });
  const lastUrlRef = useRef<string | null>(null);
  const entries = useMemo(() => Array.from(claims.values()), [claims]);

  const compute = useMemo(() => {
    return () => {
      const container = mainScrollRef.current;
      const containerHeight = container?.clientHeight ?? window.innerHeight;
      if (containerHeight <= 0 || entries.length === 0) {
        return null;
      }
      const containerRect = container?.getBoundingClientRect();
      const containerTop = containerRect?.top ?? 0;
      const weighted = entries.map((entry) => {
        const el = entry.ref.current;
        if (!el) return { claim: entry.claim, weight: 0 };
        const rect = el.getBoundingClientRect();
        return {
          claim: entry.claim,
          weight: intersectionWeight({
            rectTop: rect.top,
            rectHeight: rect.height,
            containerTop,
            containerHeight,
          }),
        };
      });
      return resolveAtmosphere(weighted);
    };
  }, [entries]);

  const apply = useMemo(() => {
    return () => {
      const resolved = compute();
      const root = document.documentElement.style;
      if (!resolved) {
        imageOpacity.set(0);
        root.removeProperty("--atmosphere-tint-h");
        root.removeProperty("--atmosphere-intensity");
        root.removeProperty("--accent");
        if (lastUrlRef.current !== null) {
          lastUrlRef.current = null;
          setLayers({ bottom: null, top: null });
        }
        return;
      }
      backgroundImage.set(resolved.backgroundImage);
      imageOpacity.set(resolved.imageAlpha);
      imageFilter.set(`blur(${resolved.imageBlurPx}px) saturate(1.1)`);
      // Publish to consumers (orb-mark halo, future band chrome). Written to
      // `documentElement` so any descendant can `var(--atmosphere-tint-h)` —
      // no need for each consumer to drill a ref through context.
      root.setProperty("--atmosphere-tint-h", resolved.tintH.toFixed(2));
      root.setProperty("--atmosphere-intensity", resolved.intensity.toFixed(3));
      // `--accent` cascades from the dominant claim's asset color when
      // present, falling back to the static neutral token in index.css.
      // Tailwind's `--color-accent` chain (`bg-accent`, `text-accent`,
      // scrollbar / focus-ring tokens) inherits from this.
      if (resolved.accentHex) {
        root.setProperty("--accent", resolved.accentHex);
      } else {
        root.removeProperty("--accent");
      }
      // Crossfade-driven URL update — diff against a ref so we only setState
      // when the URL actually changes (skin rotation, claim handoff), not
      // on every scroll tick. Each new URL goes onto the top layer and
      // tweens 0 → 1; the entrance's `onAnimationComplete` then commits it
      // into the bottom. If a new URL arrives while a top layer is still
      // tweening in (unlikely at the rotation cadence, but possible at a
      // claim handoff), the in-flight top is promoted to bottom first so
      // the user never sees a snap back to the prior URL.
      if (resolved.imageUrl !== lastUrlRef.current) {
        lastUrlRef.current = resolved.imageUrl;
        if (!resolved.imageUrl) {
          setLayers({ bottom: null, top: null });
        } else {
          const next = {
            url: resolved.imageUrl,
            position: resolved.imagePosition,
          };
          setLayers((prev) => {
            if (prev.bottom === null) {
              // First image since the layer mounted (or since the last
              // null) — no crossfade, just paint it on the bottom.
              return { bottom: next, top: null };
            }
            // Standard rotation case: bottom stays put, new URL takes
            // the top slot. Promotes any in-flight top to bottom first.
            return { bottom: prev.top ?? prev.bottom, top: next };
          });
        }
      }
    };
  }, [compute, backgroundImage, imageOpacity, imageFilter]);

  // Manual scroll listener on `<main>` (the actual scroll container) instead
  // of motion/react's `useScroll({ container: mainScrollRef })` — `useScroll`
  // throws when the container ref isn't hydrated (early SSR / tests without
  // `<main>`), and we want the layer to mount cleanly in those cases. The
  // computed write still bypasses React's render cycle (MotionValue `.set`).
  useEffect(() => {
    apply();
    const container = mainScrollRef.current ?? window;
    const onScroll = () => apply();
    const onResize = () => apply();
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    // Subscribe to per-claim bloom MotionValue changes so the image filter
    // follows the bloom curve frame-by-frame even when the user isn't
    // scrolling. Without this, `apply()` only fires on scroll events — the
    // bloom MV animates internally but its value is never read, so the
    // filter "samples" the current bloom only when the user scrolls.
    const unsubscribes: Array<() => void> = [];
    for (const entry of entries) {
      const mv = entry.claim.bloomBlurPx;
      if (mv) unsubscribes.push(mv.on("change", apply));
    }
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      for (const u of unsubscribes) u();
      // Drop the published CSS vars when the layer unmounts so leaving `/`
      // doesn't leave a stale tint hue on documentElement for routes that
      // never claimed an atmosphere.
      const root = document.documentElement.style;
      root.removeProperty("--atmosphere-tint-h");
      root.removeProperty("--atmosphere-intensity");
      root.removeProperty("--accent");
    };
  }, [apply, entries]);

  return (
    <BackdropPortal>
      <div aria-hidden data-atmosphere-layer className={LAYER_CLASS}>
        <m.div
          data-atmosphere-palette
          className="absolute inset-0"
          style={{
            backgroundImage,
            backgroundBlendMode: "screen",
            maskImage: VIGNETTE_MASK,
            WebkitMaskImage: VIGNETTE_MASK,
          }}
        />
        <m.div
          data-atmosphere-image
          className="absolute inset-0"
          style={{ opacity: imageOpacity }}
        >
          {layers.bottom && (
            <m.div
              data-atmosphere-image-bottom
              className="absolute inset-0"
              style={{
                backgroundImage: `url("${layers.bottom.url}")`,
                backgroundSize: "cover",
                backgroundPosition: layers.bottom.position,
                filter: imageFilter,
              }}
            />
          )}
          {layers.top && (
            <m.div
              // Keyed by URL so a fresh mount fires the entrance tween for
              // each new URL — even if React would have otherwise reused
              // the same DOM node.
              key={layers.top.url}
              data-atmosphere-image-top
              className="absolute inset-0"
              style={{
                backgroundImage: `url("${layers.top.url}")`,
                backgroundSize: "cover",
                backgroundPosition: layers.top.position,
                filter: imageFilter,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              onAnimationComplete={() => {
                // Commit incoming → bottom. If a newer URL has already
                // arrived (rare), `prev.top` will differ and we leave it
                // alone — the next entrance complete will do this swap.
                setLayers((prev) =>
                  prev.top?.url === layers.top?.url
                    ? { bottom: prev.top, top: null }
                    : prev
                );
              }}
            />
          )}
        </m.div>
      </div>
    </BackdropPortal>
  );
}

// Re-exported for test convenience.
export const __testing = {
  intersectionWeight,
  resolveAtmosphere,
  intensityToChromaMultiplier,
};
