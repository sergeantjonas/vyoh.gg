import type { AmbientPalette } from "@/home/ambient-hero";
import { type RefObject, createContext, useContext, useEffect, useRef } from "react";

// Atmosphere claim shape. Carries abstracted visual data only — palette
// coordinates, optional heavily-blurred image URL, intensity scalar. See
// ADR-2 in atmosphere-arc.md: recognizable per-band imagery lives on per-stream
// routes, never on `/`.
export type AtmosphereClaim = {
  palette: AmbientPalette;
  image?: string;
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
