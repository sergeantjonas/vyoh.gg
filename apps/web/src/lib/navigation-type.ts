import { topLevelScope } from "@/lib/top-level-scope";

// Tab order mirrors the TABS arrays in
//   apps/web/src/routes/lol/$accountSlug.tsx
//   apps/web/src/routes/steam.tsx
// Local to this classifier so the slide-direction lookup is self-contained.
// If a third surface (e.g. TFT) needs the same ordering, fold the source-of-
// truth into a shared per-section module and import it here instead of
// duplicating — but until then, the duplication is cheaper than the cross-
// file indirection.
const LOL_TAB_ORDER = ["", "matches", "trends", "champions", "live"] as const;
const STEAM_TAB_ORDER = ["", "library", "wishlist", "achievements"] as const;

type ParsedLocationLike = { pathname: string };

export type NavigationType =
  | "slide-left"
  | "slide-right"
  | "intra-section"
  | "cross-section"
  | "account-swap";

function lolTabIndex(pathname: string, slug: string): number {
  const base = `/lol/${slug}`;
  if (pathname === base || pathname === `${base}/`) return 0;
  if (!pathname.startsWith(`${base}/`)) return -1;
  const rest = pathname.slice(base.length + 1);
  const seg = rest.split("/")[0] ?? "";
  const idx = LOL_TAB_ORDER.indexOf(seg as (typeof LOL_TAB_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

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

function lolSlug(pathname: string): string | null {
  if (!pathname.startsWith("/lol/")) return null;
  const seg = pathname.slice("/lol/".length).split("/")[0];
  return seg || null;
}

function isLolListDetailPair(from: string, to: string, slug: string): boolean {
  for (const sub of ["matches", "champions"]) {
    const root = `/lol/${slug}/${sub}`;
    const fromIn = from === root || from.startsWith(`${root}/`);
    const toIn = to === root || to.startsWith(`${root}/`);
    if (fromIn && toIn) return true;
  }
  return false;
}

function isSteamLibraryPair(from: string, to: string): boolean {
  const inLib = (p: string) =>
    p === "/steam/library" ||
    p.startsWith("/steam/library/") ||
    p.startsWith("/steam/game/");
  return inLib(from) && inLib(to);
}

/**
 * Router-level navigation classifier feeding TanStack Router's
 * `defaultViewTransition.types`. The returned strings are matched by
 * `:active-view-transition-type(...)` in styles/view-transitions.css.
 *
 * Returns `false` for same-pathname navigations to skip the transition.
 */
export function getNavigationType(
  from: ParsedLocationLike | undefined,
  to: ParsedLocationLike
): Array<string> | false {
  if (!from) return false;
  if (from.pathname === to.pathname) return false;

  const fromScope = topLevelScope(from.pathname);
  const toScope = topLevelScope(to.pathname);
  if (fromScope !== toScope) return ["cross-section"];

  if (fromScope === "/lol") {
    const fromSlug = lolSlug(from.pathname);
    const toSlug = lolSlug(to.pathname);
    if (!fromSlug || !toSlug) return ["cross-section"];
    if (fromSlug !== toSlug) return ["account-swap"];
    // List ↔ detail pairs are owned end-to-end by per-element handlers
    // (hand-rolled startViewTransition on the forward card click, rect-based
    // `el.animate()` on the back-mount). Returning a type here would wrap
    // those handlers in a router-level VT whose CSS ends up `animation:none`
    // everywhere — visually a no-op, but the snapshot/update window still
    // freezes the viewport, and lazy-loaded images on the destination then
    // pop in after the freeze ends. Returning `false` skips router VT
    // entirely so React just commits in place.
    if (isLolListDetailPair(from.pathname, to.pathname, toSlug)) return false;
    const fromIdx = lolTabIndex(from.pathname, fromSlug);
    const toIdx = lolTabIndex(to.pathname, toSlug);
    if (fromIdx < 0 || toIdx < 0) return ["intra-section"];
    if (toIdx > fromIdx) return ["slide-left"];
    if (toIdx < fromIdx) return ["slide-right"];
    return ["intra-section"];
  }

  if (fromScope === "/steam") {
    // See comment on the matching LoL branch — list ↔ game pairs are owned
    // end-to-end by per-element handlers; router VT here only adds freeze.
    if (isSteamLibraryPair(from.pathname, to.pathname)) return false;
    const fromIdx = steamTabIndex(from.pathname);
    const toIdx = steamTabIndex(to.pathname);
    if (fromIdx < 0 || toIdx < 0) return ["intra-section"];
    if (toIdx > fromIdx) return ["slide-left"];
    if (toIdx < fromIdx) return ["slide-right"];
    return ["intra-section"];
  }

  return ["cross-section"];
}
