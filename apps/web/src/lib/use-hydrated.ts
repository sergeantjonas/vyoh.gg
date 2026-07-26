import { useEffect, useState } from "react";

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
