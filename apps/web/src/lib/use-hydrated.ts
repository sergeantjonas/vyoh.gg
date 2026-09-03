import { useEffect, useState, useSyncExternalStore } from "react";

// False during the server render AND during the client render that hydrates it;
// true from the first effect onwards.
//
// This exists because the obvious way to write a browser-only branch —
// `if (typeof document === "undefined") return null` — is a hydration bug
// wearing a safety guard. The server takes one path and the client's first
// render takes the other, so React finds markup it did not expect, discards the
// entire server-rendered tree, and re-renders it on the client. The page still
// works, which is why this hides so well: the only symptom is a console error,
// and the cost is that every route paints as if there were no SSR at all.
//
// Reach for this whenever a component can only render once the DOM exists
// (portals, measurement, anything reading `window`). It makes both first
// renders agree on "not yet" and defers the browser-only branch by one commit.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// Same question, answered without costing a *client-mounted* component a
// second commit. `useHydrated` starts false on every mount, so a component
// that swaps its own parent on the answer — a portal, say — remounts its whole
// subtree every time it opens, not only on the render that hydrates. Here
// `getServerSnapshot` answers the server render and the hydrating render,
// while anything mounted afterwards reads `true` on its first render and never
// swaps at all.
//
// Prefer this wherever the answer changes the shape of the tree. `useHydrated`
// stays the right call when the browser-only branch simply cannot be entered
// before an effect has run.
const NEVER_CHANGES = () => () => {};
const HYDRATED = () => true;
const HYDRATING = () => false;

export function useHydratedSync(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, HYDRATED, HYDRATING);
}
