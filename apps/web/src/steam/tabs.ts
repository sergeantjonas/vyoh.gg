/**
 * The Steam section's tab order, and the only copy of it.
 *
 * Three places have to agree: the strip that renders the tabs, the router's
 * slide-direction classifier, and the WebKit substitute animation that stands
 * in where router view transitions are bypassed. Each kept its own literal
 * until a fifth tab had to land in all three — and a tab present in two of
 * three does not fail, it slides the wrong way, which is the kind of defect
 * nobody files. `""` is the section index (`/steam`).
 */
export const STEAM_TAB_SEGMENTS = [
  "",
  "portrait",
  "library",
  "wishlist",
  "upcoming",
  "achievements",
] as const;

export type SteamTabSegment = (typeof STEAM_TAB_SEGMENTS)[number];

/** Position in the tab strip, or -1 for anything outside it. */
export function steamTabIndex(pathname: string): number {
  if (pathname === "/steam" || pathname === "/steam/") return 0;
  if (!pathname.startsWith("/steam/")) return -1;
  const segment = pathname.slice("/steam/".length).split("/")[0] ?? "";
  return STEAM_TAB_SEGMENTS.indexOf(segment as SteamTabSegment);
}

export interface SteamTabDescriptor {
  to: string;
  label: string;
  exact: boolean;
  extraPrefixes?: readonly string[];
}

export function isSteamTabActive(tab: SteamTabDescriptor, pathname: string): boolean {
  if (tab.exact) return pathname === tab.to;
  if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return true;
  if (tab.extraPrefixes) {
    return tab.extraPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return false;
}

export function steamTabIndexOf(
  tabs: readonly SteamTabDescriptor[],
  pathname: string
): number {
  return tabs.findIndex((tab) => isSteamTabActive(tab, pathname));
}
