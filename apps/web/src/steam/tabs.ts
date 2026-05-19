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
