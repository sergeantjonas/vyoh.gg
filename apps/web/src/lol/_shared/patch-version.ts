// Riot's gameVersion is a 4-part string like "16.9.772.8292". Riot's API
// still uses the legacy SEASON number as the major (season 16 = 2026), but
// the user-facing patch label is now year-based ("Patch 26.9"). The mapping
// is stable: display major = API major + 10. Apply that transform here so
// every consumer (chip, boundary labels, grouping) shows what players see in
// the launcher and on Riot's socials. Full Riot build string is preserved
// elsewhere for tooltips/diagnostics.
//
// Guard against a future Riot API switch to year-based: if the major already
// looks year-shaped (>= 20), pass it through unchanged.

export function truncatePatch(gameVersion: string): string {
  if (!gameVersion) return "";
  const parts = gameVersion.split(".");
  if (parts.length < 2) return "";
  const [rawMajor, minor] = parts;
  if (!rawMajor || !minor) return "";
  const majorNum = Number(rawMajor);
  if (!Number.isFinite(majorNum)) return "";
  const displayMajor = majorNum >= 20 ? majorNum : majorNum + 10;
  return `${displayMajor}.${minor}`;
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
