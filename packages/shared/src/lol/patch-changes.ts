// Best-effort classification derived from the wiki prose direction; see
// `apps/api/src/lol/patch-parser.ts`. Null when the line had no direction
// word the parser could read (mostly bug-fix prose).
export type ChampionPatchChangeKind =
  | "buff"
  | "nerf"
  | "adjustment"
  | "new_effect"
  | "removed";

export interface ChampionPatchChangeLine {
  // Wiki ability name verbatim (e.g. "Cunning Sweep", "Passive"), "Base" for
  // base-stat blocks, or null when the parser saw a change line before any
  // ability anchor (shouldn't happen in well-formed pages but stays nullable
  // to mirror the schema).
  ability: string | null;
  // Ability slot derived from CDragon at sync time: "Q" | "W" | "E" | "R" |
  // "Passive". Null for base-stat rows, items, runes, or when the CDragon
  // lookup failed (ability name falls back to verbatim wiki name).
  slot: string | null;
  // Full CDragon URL for the ability icon. Null for base-stat rows, items,
  // runes, or when the CDragon lookup failed.
  iconPath: string | null;
  changeText: string;
  changeType: ChampionPatchChangeKind | null;
}

export interface ChampionPatchChangeGroup {
  // Wiki champion name (e.g. "Ahri", "Lee Sin", "Wukong"). Web callers must
  // resolve their Riot-internal aliases (e.g. "MonkeyKing") to wiki display
  // names before querying — see `useChampionName` on the web side.
  champion: string;
  changes: ChampionPatchChangeLine[];
}

// PN4: items and runes share an identical shape — no ability layer, just a
// flat list of changes per subject. Splitting them by name (rather than
// reusing `ChampionPatchChangeGroup`) keeps the API surface explicit and
// makes it harder to feed item rows into the champion-keyed personalization
// path by mistake.
export interface PatchEntryChangeLine {
  changeText: string;
  changeType: ChampionPatchChangeKind | null;
}

export interface PatchEntryChangeGroup {
  // Wiki item or rune name verbatim (e.g. "Lich Bane", "Deathfire Touch").
  name: string;
  // Full CDragon URL for the item/rune icon. Null when CDragon lookup failed
  // or the entry is for a removed entity not present in either version's data.
  iconUrl: string | null;
  changes: PatchEntryChangeLine[];
}

// Response shape for the PN2 profile heads-up endpoint
// (`/lol/patches/current/changes?champion=…`). Champion-only by design —
// the heads-up surface only personalizes against the user's played champions.
export interface CurrentPatchChangesResponse {
  // null when the DB has no patches synced yet (fresh install pre-cron).
  patchVersion: string | null;
  changes: ChampionPatchChangeGroup[];
}

// PN4 response shape for the patches-tab endpoint
// (`/lol/patches/:version/changes`). Returns the full slate for the
// requested patch, partitioned by section. `patchVersion` is null when the
// requested version isn't in the DB (treat as "unknown patch" on the client).
export interface PatchChangesResponse {
  patchVersion: string | null;
  champions: ChampionPatchChangeGroup[];
  items: PatchEntryChangeGroup[];
  runes: PatchEntryChangeGroup[];
}

// One row per synced patch; powers the PN3 patch-selector dropdown.
// Dates arrive as ISO strings over the wire (Prisma `DateTime` → JSON).
export interface PatchListEntry {
  version: string;
  patchDate: string | null;
  fetchedAt: string;
}
