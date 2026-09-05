import { HttpError } from "@/lib/http-error";
import type { SteamOwnedGame } from "@vyoh/shared";

type QueryLike = {
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
};

export type GameRowState =
  | { kind: "ready"; game: SteamOwnedGame }
  | { kind: "pending" }
  | { kind: "missing" }
  | { kind: "error" };

// The game panel reads one row from two queries: the owned-games list, which a
// click from the library already holds, and the single-row endpoint, which a
// cold arrival has instead (primed server-side, or fetched while the list is
// still loading). This decides what the panel shows from the pair.
//
// "Missing" is a settled answer from either side — the list came back without
// the row, or the row endpoint said 404 (unowned, or hidden from this viewer).
// Anything else that settles without a row is an outage. A disabled single-row
// query is pending but never fetching, which is why the conjunct is needed.
//
// `serverSaidMissing` is the route loader's word that the row endpoint answered
// 404 during the server render. A failed query is not dehydrated, so without it
// the hydrating render would see a pending query where the server saw a
// settled miss; it only speaks while nothing has settled on the client, so the
// owner's cookie-scoped re-ask can still turn the answer into a row.
export function resolveGameRow(
  ownedRow: SteamOwnedGame | undefined,
  owned: QueryLike & { data: { games: readonly SteamOwnedGame[] } | undefined },
  single: QueryLike & { data: SteamOwnedGame | undefined },
  serverSaidMissing = false
): GameRowState {
  const game = ownedRow ?? single.data;
  if (game !== undefined) return { kind: "ready", game };
  // A 404 settles it before the list lands: the list reads the same snapshot
  // for the same viewer, so it cannot hold a row the endpoint just refused.
  if (single.error instanceof HttpError && single.error.status === 404) {
    return { kind: "missing" };
  }
  if (owned.isPending || (single.isPending && single.isFetching)) {
    return serverSaidMissing ? { kind: "missing" } : { kind: "pending" };
  }
  if (owned.data !== undefined) return { kind: "missing" };
  return { kind: "error" };
}
