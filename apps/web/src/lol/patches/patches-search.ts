export interface PatchesSearch {
  as?: string;
}

// Validates the TanStack Router search params for the global `/lol/patches`
// routes. `as` is an optional account slug that opts the page into the
// personalized lens (play-count sort, "My champions only" toggle, profile
// deeplinks). Unknown or non-string values fall back to the neutral view.
export function validatePatchesSearch(search: Record<string, unknown>): PatchesSearch {
  const as =
    typeof search.as === "string" && search.as.length > 0 ? search.as : undefined;
  return as === undefined ? {} : { as };
}
