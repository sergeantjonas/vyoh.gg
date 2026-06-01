import { type ReactNode, useCallback, useMemo, useState } from "react";
import { AtmosphereLayer } from "./atmosphere-layer";
import {
  type AtmosphereClaim,
  type AtmosphereClaimEntry,
  AtmosphereContext,
  type AtmosphereOwnerId,
} from "./use-atmosphere-claim";

function claimsEqual(a: AtmosphereClaim, b: AtmosphereClaim): boolean {
  return a.palette === b.palette && a.image === b.image && a.intensity === b.intensity;
}

/**
 * Provides a single shared atmosphere layer for the landing page. Bands call
 * `useAtmosphereClaim(ref, claim)` to declare what the atmosphere should look
 * like while their band is near viewport center. The layer (mounted via portal
 * by `<AtmosphereLayer />`) reads all active claims, weights each by its
 * bounding-rect proximity to the viewport, and interpolates the blend onto
 * CSS custom properties — no React re-renders during scroll.
 *
 * Pattern parity with `SplashProvider` (apps/web/src/lol/_shared/assets/splash-backdrop.tsx).
 */
export function AtmosphereProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Map<AtmosphereOwnerId, AtmosphereClaimEntry>>(
    () => new Map()
  );

  const setClaim = useCallback<
    (
      owner: AtmosphereOwnerId,
      ref: AtmosphereClaimEntry["ref"],
      claim: AtmosphereClaim
    ) => void
  >((owner, ref, claim) => {
    setClaims((prev) => {
      const existing = prev.get(owner);
      if (existing && existing.ref === ref && claimsEqual(existing.claim, claim)) {
        return prev;
      }
      const next = new Map(prev);
      next.set(owner, { id: owner, ref, claim });
      return next;
    });
  }, []);

  const clearClaim = useCallback<(owner: AtmosphereOwnerId) => void>((owner) => {
    setClaims((prev) => {
      if (!prev.has(owner)) return prev;
      const next = new Map(prev);
      next.delete(owner);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ setClaim, clearClaim }), [setClaim, clearClaim]);

  return (
    <AtmosphereContext.Provider value={value}>
      {children}
      <AtmosphereLayer claims={claims} />
    </AtmosphereContext.Provider>
  );
}
