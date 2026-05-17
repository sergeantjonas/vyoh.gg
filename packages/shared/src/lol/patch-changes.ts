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

export interface CurrentPatchChangesResponse {
  // null when the DB has no patches synced yet (fresh install pre-cron).
  patchVersion: string | null;
  changes: ChampionPatchChangeGroup[];
}
