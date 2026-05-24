import { isWebKit } from "@/lib/is-webkit";
import { useState } from "react";

// Steam tab order mirrors the TABS array in apps/web/src/routes/steam.tsx.
// Kept local because this hook is only used by Steam and pulling the source
// of truth back through a shared module is more indirection than the
// duplication is worth (same call as navigation-type.ts's local copy).
const STEAM_TAB_ORDER = ["", "library", "wishlist", "achievements"] as const;

function steamTabIndex(pathname: string): number {
  if (pathname === "/steam" || pathname === "/steam/") return 0;
  if (!pathname.startsWith("/steam/")) return -1;
  const rest = pathname.slice("/steam/".length);
  const seg = rest.split("/")[0] ?? "";
  // /steam/game/* is a Library drill-in.
  if (seg === "game") return STEAM_TAB_ORDER.indexOf("library");
  const idx = STEAM_TAB_ORDER.indexOf(seg as (typeof STEAM_TAB_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

export type SlideDirection = "left" | "right" | null;

function computeDirection(prev: string, next: string): SlideDirection {
  const fromIdx = steamTabIndex(prev);
  const toIdx = steamTabIndex(next);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;
  return toIdx > fromIdx ? "left" : "right";
}

// Returns the Safari-only sibling-tab slide direction for an intra-Steam
// nav. Computed synchronously by comparing the current pathname's tab
// index against the previous one — left when moving down the tab order
// (Profile → Library), right when moving up. Returns null when the
// navigation isn't a sibling-tab swap, when the engine isn't WebKit
// (real VT handles other engines), or on the first render.
//
// Pairs with navigation-type.ts's WebKit bypass: that bypass returns
// `false` for intra-Steam navs on WebKit so router VT skips capturing
// the expensive Steam snapshot, and this hook drives a cheap CSS-only
// slide animation on the freshly-mounted route content as a UX
// substitute. The animation runs on the compositor — no main-thread
// snapshot work — so Safari users get visible motion without the chop.
//
// Uses the "set state during render" pattern (officially supported by
// React) so the direction is known on the same render that the new
// pathname is applied — no one-frame paint of the destination without
// the animation class, no useEffect timing lag. React drops the first
// render's JSX and re-renders synchronously when setState is called
// during render.
export function useSafariSlideDirection(pathname: string): SlideDirection {
  const [prev, setPrev] = useState<string | null>(null);
  const [direction, setDirection] = useState<SlideDirection>(null);

  if (prev !== pathname) {
    setPrev(pathname);
    if (!isWebKit() || prev === null) {
      setDirection(null);
    } else {
      setDirection(computeDirection(prev, pathname));
    }
  }

  // Guard the return so callers don't see the stale `direction` from the
  // previous pathname during the brief in-render moment before React
  // commits the setState above.
  return prev === pathname ? direction : null;
}
