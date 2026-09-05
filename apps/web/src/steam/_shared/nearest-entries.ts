import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import type { SteamCompletionCandidate, SteamOwnedGame } from "@vyoh/shared";

// A planner, not a leaderboard: past the first handful the list stops being
// "what could I finish next" and becomes the whole backlog again. Shared by
// the signature-page section and the palette's `/hunt` group so both show
// the same eight.
export const NEAREST_HUNDRED_LIMIT = 8;

export interface NearestEntry extends SteamCompletionCandidate {
  name: string;
  capsuleUrl: string;
}

// Joins the ranked candidates with the owned-games list for names and art,
// keeping the server order and skipping appids the library cannot name.
export function joinNearestEntries(
  candidates: SteamCompletionCandidate[],
  owned: SteamOwnedGame[]
): NearestEntry[] {
  const gameById = new Map(owned.map((g) => [g.appid, g]));
  const entries: NearestEntry[] = [];
  for (const c of candidates) {
    const game = gameById.get(c.appid);
    if (!game) continue;
    entries.push({
      ...c,
      name: game.name,
      capsuleUrl: steamCapsuleUrl(c.appid, game.assetTimestamp),
    });
    if (entries.length === NEAREST_HUNDRED_LIMIT) break;
  }
  return entries;
}

// Fixed locale on purpose: the same list is rendered on the server and on the
// client, and a viewer-locale join would hydrate differently.
const CONJUNCTION = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

// Names the games the ranking left out because Steam keeps their achievement
// stats private, in server order, skipping appids the library cannot name.
// Returns the joined sentence fragment ("Subverse and Five Hearts Under One
// Roof") or null when nothing is nameable.
export function privateGamesSentence(
  privateAppids: readonly number[],
  owned: readonly SteamOwnedGame[]
): string | null {
  const nameById = new Map(owned.map((g) => [g.appid, g.name]));
  const names = privateAppids.flatMap((appid) => {
    const name = nameById.get(appid);
    return name === undefined ? [] : [name];
  });
  return names.length === 0 ? null : CONJUNCTION.format(names);
}
