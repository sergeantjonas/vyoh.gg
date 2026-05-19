import { MAX_COUNT } from "@/lol/matches/match-count-selector";

export interface AccountSearch {
  queue?: number;
  count?: number;
}

// Validates the TanStack Router search params for the account layout. `queue`
// must be a number; `count` must be a positive integer (and is clamped to
// MAX_COUNT to keep the cached-window query bounded).
export function validateAccountSearch(search: Record<string, unknown>): AccountSearch {
  const queue = typeof search.queue === "number" ? search.queue : undefined;
  const count =
    typeof search.count === "number" && search.count > 0
      ? Math.min(search.count, MAX_COUNT)
      : undefined;
  return {
    ...(queue !== undefined && { queue }),
    ...(count !== undefined && { count }),
  };
}
