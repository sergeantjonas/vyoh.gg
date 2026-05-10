// Riot's gameVersion is a 4-part string like "14.20.586.5840". Players think
// in terms of MAJOR.MINOR ("14.20") — the rest are build numbers that change
// without meta impact. Truncate to that for all patch-grouping UI.

export function truncatePatch(gameVersion: string): string {
  if (!gameVersion) return "";
  const parts = gameVersion.split(".");
  if (parts.length < 2) return "";
  return `${parts[0]}.${parts[1]}`;
}

export function comparePatches(a: string, b: string): number {
  const [aMaj = 0, aMin = 0] = a.split(".").map(Number);
  const [bMaj = 0, bMin = 0] = b.split(".").map(Number);
  if (aMaj !== bMaj) return aMaj - bMaj;
  return aMin - bMin;
}

export interface PatchBucket<T> {
  patch: string;
  items: T[];
}

// Returns buckets in chronological order (oldest patch first).
// Items with empty/invalid gameVersion are dropped silently — the schema
// default is "" for un-backfilled rows.
export function groupByPatch<T>(
  items: readonly T[],
  getVersion: (item: T) => string
): PatchBucket<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const patch = truncatePatch(getVersion(item));
    if (!patch) continue;
    let bucket = map.get(patch);
    if (!bucket) {
      bucket = [];
      map.set(patch, bucket);
    }
    bucket.push(item);
  }
  return [...map.entries()]
    .sort((a, b) => comparePatches(a[0], b[0]))
    .map(([patch, items]) => ({ patch, items }));
}

export interface PatchBoundary {
  // ms timestamp at the midpoint between the last match of `fromPatch` and
  // the first match of `toPatch`. Use this on time-axis charts.
  ts: number;
  // Game-number midpoint (e.g. 12.5 between game 12 and game 13). Use this on
  // sequence-indexed charts where games are 1-indexed in chronological order.
  gameIndex: number;
  fromPatch: string;
  toPatch: string;
}

// Walks a chronologically-sorted (oldest first) match list and emits one
// boundary per consecutive pair where the truncated patch differs. Items
// with empty gameVersion break the run silently — they don't generate
// spurious boundaries against the next valid patch.
export function findPatchBoundaries<T>(
  chronologicalItems: readonly T[],
  getVersion: (item: T) => string,
  getTimestamp: (item: T) => number
): PatchBoundary[] {
  const boundaries: PatchBoundary[] = [];
  for (let i = 1; i < chronologicalItems.length; i++) {
    const prev = chronologicalItems[i - 1];
    const curr = chronologicalItems[i];
    if (!prev || !curr) continue;
    const prevPatch = truncatePatch(getVersion(prev));
    const currPatch = truncatePatch(getVersion(curr));
    if (!prevPatch || !currPatch) continue;
    if (prevPatch === currPatch) continue;
    boundaries.push({
      ts: (getTimestamp(prev) + getTimestamp(curr)) / 2,
      gameIndex: i + 0.5,
      fromPatch: prevPatch,
      toPatch: currPatch,
    });
  }
  return boundaries;
}
