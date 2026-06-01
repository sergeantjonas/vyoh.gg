import type { AmbientPalette } from "@/home/ambient-hero";
import type { MotionValue } from "motion/react";
import { type RefObject, createContext, useContext, useEffect, useRef } from "react";

// Atmosphere claim shape. Carries palette coordinates, optional image URL,
// per-claim blur, and intensity scalar. Heavy blur (default 80px) yields the
// abstracted ambient look the substrate originally shipped with; light blur
// (~4–8px) yields recognizable game/champion assets for the recap arc's
// subject chapters — see self-portrait-recap-arc.md (ADR-2 retired, image
// now meant for recognizable assets at directional-masked light blur).
//
// `bloomBlurPx` is an optional MotionValue that adds to `blurPx` each scroll
// tick — the layer reads `.get()` in its apply step so the bloom curve runs
// outside React's render cycle. Drives the splash-rotation blur-bloom beat
// (subject chapter skin rotation) without re-rendering on every frame.
export type AtmosphereClaim = {
  palette: AmbientPalette;
  image?: string;
  blurPx?: number;
  bloomBlurPx?: MotionValue<number>;
  /**
   * Optional asset dominant color (any CSS color — hex, oklch, etc.). The
   * layer publishes this as `--accent` on `documentElement` while the claim
   * is the dominant one, parallel to `--atmosphere-tint-h`. Hero and
   * conclusion regions leave it unset so `--accent` falls back to the static
   * neutral token declared in index.css.
   */
  accentHex?: string;
  intensity: number;
};

export type AtmosphereOwnerId = number;

export type AtmosphereClaimEntry = {
  id: AtmosphereOwnerId;
  ref: RefObject<HTMLElement | null>;
  claim: AtmosphereClaim;
};

export type AtmosphereContextValue = {
  setClaim: (
    owner: AtmosphereOwnerId,
    ref: RefObject<HTMLElement | null>,
    claim: AtmosphereClaim
  ) => void;
  clearClaim: (owner: AtmosphereOwnerId) => void;
};

export const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);

// Owner ids are allocated at first render of each consumer hook, so parents
// get lower numbers than their children — parity with SplashProvider's
// nesting semantics. The layer uses the id ordering as a tiebreak when
// multiple bands are simultaneously claiming.
let ownerSeq = 0;

export function __resetAtmosphereOwnerSeqForTests() {
  ownerSeq = 0;
}

/**
 * Register an atmosphere claim for the given band element. The claim is
 * active while the consumer is mounted; updates to `claim` are reactive and
 * cheap (object-identity comparison happens in the provider).
 *
 * The `ref` is forwarded to the layer so it can read the band's bounding rect
 * each scroll tick — proximity to viewport center drives the per-claim weight
 * in the active blend.
 */
export function useAtmosphereClaim(
  ref: RefObject<HTMLElement | null>,
  claim: AtmosphereClaim
) {
  const ctx = useContext(AtmosphereContext);
  if (!ctx) {
    throw new Error("useAtmosphereClaim must be used within an AtmosphereProvider");
  }
  const ownerRef = useRef<AtmosphereOwnerId | null>(null);
  if (ownerRef.current === null) ownerRef.current = ++ownerSeq;

  useEffect(() => {
    const owner = ownerRef.current;
    if (owner === null) return;
    ctx.setClaim(owner, ref, claim);
  }, [claim, ref, ctx]);

  useEffect(() => {
    const owner = ownerRef.current;
    return () => {
      if (owner !== null) ctx.clearClaim(owner);
    };
  }, [ctx]);
}
