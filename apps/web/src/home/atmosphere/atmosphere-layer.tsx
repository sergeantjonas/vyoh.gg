import { BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import {
  VIGNETTE_MASK,
  intensityToChromaMultiplier,
  layerToCssGradient,
} from "@/home/ambient-hero";
import { mainScrollRef } from "@/lib/scroll-container";
import { m, useMotionValue } from "motion/react";
import { useEffect, useMemo } from "react";
import type { AtmosphereClaim, AtmosphereClaimEntry } from "./use-atmosphere-claim";

// Triangle weighting peaking at viewport-center: a band whose center sits at
// 50% of the scroll-container height gets full weight (1.0); weight falls
// linearly to 0 as the center approaches either edge. Bands fully offscreen
// contribute nothing. Pairing the per-band ref's bounding rect with the
// container height gives a stable progress signal that respects <main> as the
// scroll container (mainScrollRef), not the window.
function proximityWeight(centerProgress: number): number {
  if (centerProgress <= 0 || centerProgress >= 1) return 0;
  return Math.max(0, 1 - Math.abs(centerProgress - 0.5) * 2);
}

type ResolvedAtmosphere = {
  backgroundImage: string;
  imageUrl: string | null;
  imageAlpha: number;
};

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
  return { backgroundImage, imageUrl, imageAlpha };
}

const LAYER_CLASS =
  "pointer-events-none fixed inset-0 -z-20 overflow-hidden bg-background";

type Props = { claims: Map<number, AtmosphereClaimEntry> };

/**
 * Renders the single shared atmosphere layer behind every band on `/`. Reads
 * active claims from `AtmosphereProvider`, weights each by viewport-center
 * proximity, and writes the blend onto inline styles each scroll tick via
 * MotionValues — no React renders during scroll. Portaled to `document.body`
 * for parity with `BackdropPortal` (clean isolation from route content).
 *
 * With zero claims, the layer renders a transparent background-coloured
 * surface. Becomes the bg colour as the page scrolls past the last claim.
 */
export function AtmosphereLayer({ claims }: Props) {
  const backgroundImage = useMotionValue<string>("none");
  const imageOpacity = useMotionValue<number>(0);
  const imageUrlVar = useMotionValue<string>("none");
  const entries = useMemo(() => Array.from(claims.values()), [claims]);

  const compute = useMemo(() => {
    return () => {
      const container = mainScrollRef.current;
      const containerHeight = container?.clientHeight ?? window.innerHeight;
      if (containerHeight <= 0 || entries.length === 0) {
        return null;
      }
      const weighted = entries.map((entry) => {
        const el = entry.ref.current;
        if (!el) return { claim: entry.claim, weight: 0 };
        const rect = el.getBoundingClientRect();
        const containerRect = container?.getBoundingClientRect();
        const containerTop = containerRect?.top ?? 0;
        const center = rect.top - containerTop + rect.height / 2;
        const progress = center / containerHeight;
        return { claim: entry.claim, weight: proximityWeight(progress) };
      });
      return resolveAtmosphere(weighted);
    };
  }, [entries]);

  const apply = useMemo(() => {
    return () => {
      const resolved = compute();
      if (!resolved) {
        imageOpacity.set(0);
        return;
      }
      backgroundImage.set(resolved.backgroundImage);
      imageUrlVar.set(resolved.imageUrl ? `url("${resolved.imageUrl}")` : "none");
      imageOpacity.set(resolved.imageAlpha);
    };
  }, [compute, backgroundImage, imageOpacity, imageUrlVar]);

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
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [apply]);

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
          style={{
            backgroundImage: imageUrlVar,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) saturate(1.1)",
            opacity: imageOpacity,
          }}
        />
      </div>
    </BackdropPortal>
  );
}

// Re-exported for test convenience.
export const __testing = {
  proximityWeight,
  resolveAtmosphere,
  intensityToChromaMultiplier,
};
