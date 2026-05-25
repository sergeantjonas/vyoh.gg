// Steam library palette grammar — parallel to `parseMatchQuery` in
// packages/shared/src/lol/match-query.ts. Three verbs (`dev:`, `pub:`,
// `franchise:`) plus free-text. Multi-occurrence verbs union as arrays so
// `dev:from-software dev:capcom` means "FromSoftware OR Capcom" (same shape
// as `with:` / `vs:` in the LoL parser).
//
// Why a separate parser per stream: per the F-chunk pattern (`parsePaletteVerb`
// is also separate from `parseMatchQuery`), each grammar stays narrowly typed
// to its own verbs. The dialog dispatches by route scope.

export type ParsedSteamLibraryQuery = {
  devs: string[];
  pubs: string[];
  franchises: string[];
  freeText: string;
};

const EMPTY_QUERY: ParsedSteamLibraryQuery = {
  devs: [],
  pubs: [],
  franchises: [],
  freeText: "",
};

export function parseSteamLibraryQuery(input: string): ParsedSteamLibraryQuery {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return EMPTY_QUERY;

  const devs: string[] = [];
  const pubs: string[] = [];
  const franchises: string[] = [];
  const freeTokens: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("dev:")) {
      const value = token.slice("dev:".length);
      if (value) devs.push(value);
      continue;
    }
    if (token.startsWith("pub:")) {
      const value = token.slice("pub:".length);
      if (value) pubs.push(value);
      continue;
    }
    if (token.startsWith("franchise:")) {
      const value = token.slice("franchise:".length);
      if (value) franchises.push(value);
      continue;
    }
    freeTokens.push(token);
  }

  return {
    devs,
    pubs,
    franchises,
    freeText: freeTokens.join(" "),
  };
}

// Slug-normalise a free-form name (or query token) so the matcher doesn't
// require the user to type the canonical capitalisation. "FromSoftware Inc." →
// "fromsoftware-inc", "PlayStation Publishing LLC" → "playstation-publishing-llc".
// Both haystack and needle pass through this so the comparison is symmetric.
export function kebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Does any entry in `names` match the query under hyphen-insensitive
// substring semantics? `FromSoftware` canonicalises with no internal
// separator while a user typically types `dev:from-software` with one;
// comparing both sides as alphanumerics-only papers over that. Returns true
// for empty `query` (no filter applied).
function flatten(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function nameMatchesQuery(names: string[], query: string): boolean {
  if (!query) return true;
  const needle = flatten(query);
  if (!needle) return true;
  for (const name of names) {
    if (flatten(name).includes(needle)) return true;
  }
  return false;
}
