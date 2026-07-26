import { useCallback, useMemo, useSyncExternalStore } from "react";

// `useSyncExternalStore` rather than `useState` + `useEffect` because this hook
// has to answer differently depending on whether React is hydrating, and it is
// the only API that knows. The previous lazy initialiser read `matchMedia`
// directly, which meant the server said `false` and the client's first render
// said whatever the real device was — so on any desktop browser the two
// disagreed, and consumers that branch on the result (the match row only mounts
// its hover popover when `(hover: hover)`) rendered a different tree on each
// side. React's response to that is not to patch the difference: it discards
// the server-rendered tree and re-renders the route on the client, which quietly
// spends the entire benefit of server-rendering it.
//
// The three arguments split the cases cleanly. `getServerSnapshot` answers the
// server render and the hydrating client render, so both agree on `false`.
// `getSnapshot` answers every render after that, including the first render of a
// component mounted by a client-side navigation — so post-hydration mounts still
// read the true value synchronously and never flash a wrong layout.
export function useMediaQuery(query: string): boolean {
  const mql = useMemo(
    () => (typeof window === "undefined" ? null : window.matchMedia(query)),
    [query]
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!mql) return () => {};
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [mql]
  );

  return useSyncExternalStore(
    subscribe,
    () => mql?.matches ?? false,
    () => false
  );
}
