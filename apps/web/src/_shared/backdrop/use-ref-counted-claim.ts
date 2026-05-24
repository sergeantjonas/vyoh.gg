import { useCallback, useMemo, useRef, useState } from "react";

export interface RefCountedClaimApi<T> {
  claim: T | null;
  setClaim: (next: T) => void;
  acquire: () => () => void;
}

// Ref-counted single-slot claim for full-screen backdrops. Multiple consumers
// can lease the slot concurrently; the slot only nulls when the last release
// runs. This defends against the SectionShell `<AnimatePresence>` around
// `<Outlet />` pattern, where the exiting and entering `<m.div>`s both resolve
// their Outlet to the current matched route — so the same page mounts twice
// during a slide. A naive `setClaim(null)` on the exiting instance's cleanup
// would nuke the still-valid claim from the surviving instance.
//
// `isEqual` is read through a ref so callers can pass an inline comparator
// without breaking the stable identity of `setClaim` / `acquire`.
export function useRefCountedClaim<T>(
  isEqual: (prev: T, next: T) => boolean = Object.is
): RefCountedClaimApi<T> {
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  const [claim, setClaimState] = useState<T | null>(null);
  const liveCountRef = useRef(0);

  const setClaim = useCallback((next: T) => {
    setClaimState((prev) => {
      if (prev !== null && isEqualRef.current(prev, next)) return prev;
      return next;
    });
  }, []);

  const acquire = useCallback(() => {
    liveCountRef.current += 1;
    return () => {
      liveCountRef.current -= 1;
      if (liveCountRef.current === 0) setClaimState(null);
    };
  }, []);

  return useMemo(() => ({ claim, setClaim, acquire }), [claim, setClaim, acquire]);
}
