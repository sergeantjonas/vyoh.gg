import type { SteamRecentUnlock } from "@vyoh/shared";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function monthKey(iso: string): string {
  return monthFormatter.format(new Date(iso));
}

export function formatRowDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export interface MonthGroup {
  label: string;
  rows: SteamRecentUnlock[];
}

// Server returns rows sorted by unlockedAt desc, so preserving insertion order
// gives newest-month-first and newest-row-first within each group without an
// extra sort. Map keys keep insertion order in JS, so this falls out for free.
export function groupByMonth(unlocks: SteamRecentUnlock[]): MonthGroup[] {
  const buckets = new Map<string, SteamRecentUnlock[]>();
  for (const u of unlocks) {
    const key = monthKey(u.unlockedAt);
    const existing = buckets.get(key);
    if (existing) existing.push(u);
    else buckets.set(key, [u]);
  }
  return Array.from(buckets.entries()).map(([label, rows]) => ({ label, rows }));
}
