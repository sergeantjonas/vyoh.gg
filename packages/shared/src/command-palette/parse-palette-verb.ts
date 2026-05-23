// Navigation verbs for the ⌘K palette. Distinct from the match-filter
// grammar in `lol/match-query.ts`: that one filters the matches currently
// loaded in the cache; this one drives cross-page navigation that doesn't
// belong to any single account scope.
//
// Current vocabulary:
//   /patches                       → /lol/patches
//   /patches 25.10                 → /lol/patches/25.10
//   /patches @jonas-eune           → /lol/patches?as=jonas-eune
//   /patches 25.10 @jonas-eune     → /lol/patches/25.10?as=jonas-eune
//
// Designed as a discriminated union so future global LoL surfaces
// (champion DB, item meta, tier list) plug in by adding a `kind`.

export type PalettePatchesVerb = {
  kind: "patches";
  version: string | null;
  asSlug: string | null;
};

export type PaletteVerb = PalettePatchesVerb;

const VERSION_RE = /^\d+\.\d+(?:\.\d+)?$/;
const SLUG_TOKEN_RE = /^@([a-z0-9-]+)$/;

export function parsePaletteVerb(input: string): PaletteVerb | null {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const head = tokens[0];
  if (head !== "/patches") return null;

  let version: string | null = null;
  let asSlug: string | null = null;
  for (const token of tokens.slice(1)) {
    if (VERSION_RE.test(token)) {
      version = token;
      continue;
    }
    const slugMatch = token.match(SLUG_TOKEN_RE);
    if (slugMatch?.[1]) {
      asSlug = slugMatch[1];
    }
    // Unknown trailing tokens are ignored rather than rejected, so a
    // fragment typed mid-keystroke ("/patches 25" before the user finishes
    // the version) still surfaces the Patches entry.
  }

  return { kind: "patches", version, asSlug };
}
