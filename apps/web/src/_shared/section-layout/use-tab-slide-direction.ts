import { useRef } from "react";

// Compute page-slide direction (-1 | 0 | 1) synchronously during render so the
// entering element gets the correct `initial` on the same frame it mounts.
// `tabIndexOf` is section-supplied because each section resolves pathnames
// differently — Steam uses `extraPrefixes` (a Library drill-in under
// `/steam/game/*` should count as Library), LoL substitutes `$accountSlug`
// then compares exactly (a `/matches/<id>` detail returns -1 and the section
// short-circuits the slide via `slideTransitionOverride`).
export function useTabSlideDirection(
  pathname: string,
  tabIndexOf: (path: string) => number
): number {
  const directionRef = useRef(0);
  const prevPathnameRef = useRef(pathname);
  if (prevPathnameRef.current !== pathname) {
    const prevIdx = tabIndexOf(prevPathnameRef.current);
    const currIdx = tabIndexOf(pathname);
    directionRef.current =
      prevIdx !== -1 && currIdx !== -1 ? Math.sign(currIdx - prevIdx) : 0;
    prevPathnameRef.current = pathname;
  }
  return directionRef.current;
}
