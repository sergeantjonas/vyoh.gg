export interface LolTabDescriptor {
  to: string;
  exact: boolean;
}

// Strip a single trailing slash so /lol/jonas-euw/ and /lol/jonas-euw resolve
// to the same tab.
export function normalizePath(s: string): string {
  return s.replace(/\/$/, "");
}

// Substitute the `$accountSlug` placeholder in a tab `to` template against an
// actual slug, then normalize the trailing slash.
export function resolveTabPath(to: string, accountSlug: string): string {
  return normalizePath(to.replace("$accountSlug", accountSlug));
}

// Exact tabs match only the literal substituted path. Prefix tabs match either
// the literal path or any subpath. Used both for active-tab styling and slide
// direction indexing.
export function isTabActive(
  tab: LolTabDescriptor,
  pathname: string,
  accountSlug: string
): boolean {
  const tabPath = resolveTabPath(tab.to, accountSlug);
  if (tab.exact) return pathname === tabPath;
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

// Find the index of the matching tab for slide-direction logic. Returns -1
// for paths that don't match any tab (e.g. match-detail subpaths), which the
// caller short-circuits via a separate detail-transition override.
export function tabIndexFromPath(
  tabs: readonly LolTabDescriptor[],
  pathname: string,
  accountSlug: string
): number {
  const norm = normalizePath(pathname);
  return tabs.findIndex(({ to }) => norm === resolveTabPath(to, accountSlug));
}

// We're "in the matches subtree" when the path is exactly /matches or any
// /matches/* subpath. The saved-scroll/active-match state is only meaningful
// while inside this subtree; navigating to Trends/Champions invalidates it.
export function isInMatchesSubtree(pathname: string, accountSlug: string): boolean {
  const matchesPath = `/lol/${accountSlug}/matches`;
  return pathname === matchesPath || pathname.startsWith(`${matchesPath}/`);
}

// We're on a match-detail page when the path is strictly deeper than /matches.
// /matches itself returns false; /matches/EUW1_X (and any nested tab under it)
// returns true.
export function isMatchDetail(pathname: string, accountSlug: string): boolean {
  const prefix = `/lol/${accountSlug}/matches/`;
  return pathname.startsWith(prefix) && pathname.length > prefix.length;
}

// Per-tab icon entrance variants. The shape isn't important — what matters is
// that each label gets a distinct pop so swapping tabs reads as intentional
// rather than a generic shimmer.
export function iconPop(label: string): { scale: number; rotate?: number; y?: number } {
  if (label === "Profile") return { scale: 0.75, y: -4 };
  if (label === "Matches") return { scale: 0.75, rotate: -12 };
  if (label === "Trends") return { scale: 0.75, y: 5 };
  if (label === "Live") return { scale: 0.75, y: -4 };
  return { scale: 0.65, rotate: 8 };
}
