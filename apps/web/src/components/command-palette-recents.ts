const STORAGE_PREFIX = "vyoh:palette-recents:";
const MAX_RECENTS = 5;

export type RecentKind = "page" | "account" | "tab" | "champion" | "match";

export type RecentItem = {
  path: string;
  label: string;
  kind: RecentKind;
};

// Per-stream namespacing so steam selections don't leak into a lol account's
// recents and vice versa. `/lol/<slug>/...` gets a per-account bucket because
// recents on one account shouldn't surface on another.
export function deriveRecentsScope(pathname: string): string {
  const slug = pathname.match(/^\/lol\/([^/]+)/)?.[1];
  if (slug) return `lol:${slug}`;
  if (pathname.startsWith("/lol")) return "lol";
  if (pathname.startsWith("/steam")) return "steam";
  return "global";
}

function isValidRecent(value: unknown): value is RecentItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.path === "string" &&
    typeof v.label === "string" &&
    typeof v.kind === "string" &&
    ["page", "account", "tab", "champion", "match"].includes(v.kind)
  );
}

export function loadRecents(scope: string): RecentItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecent).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function recordRecent(scope: string, item: RecentItem): void {
  if (typeof localStorage === "undefined") return;
  try {
    const current = loadRecents(scope);
    const filtered = current.filter((r) => r.path !== item.path);
    const next = [item, ...filtered].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(next));
  } catch {
    // quota exceeded or private-mode write rejection — silently drop, recents
    // are a non-essential affordance.
  }
}
