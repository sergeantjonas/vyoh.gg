// Steam wishlist palette grammar for the ⌘K palette — a navigation + name
// search verb, parallel to `parsePaletteVerb` (LoL `/patches`) and
// `parseSteamLibraryQuery` (`dev:`/`pub:`/`franchise:`). Two head keywords, for
// the two routes that were once two tabs of one:
//
//   wishlist            → offer both destinations
//   wishlist all        → /steam/wishlist
//   wishlist upcoming   → /steam/upcoming
//   upcoming            → /steam/upcoming
//   wishlist <name>     → find a wishlisted game → /steam/wishlist?appid=<id>
//
// One grammar rather than two because `wishlist upcoming` was the phrasing the
// palette itself taught while the calendar lived behind `?tab=upcoming`, and
// muscle memory outlives a route split.
//
// Why a separate parser per stream/intent: per the F/G-chunk pattern
// (`parsePaletteVerb` and `parseSteamLibraryQuery` are both already separate
// from `parseMatchQuery`), each grammar stays narrowly typed to its own verbs
// and the dialog dispatches.

export type WishlistPaletteTarget = "wishlist" | "upcoming";

export type WishlistPaletteQuery = {
  kind: "wishlist";
  // A resolved route, or null when the input names none — bare `wishlist` (or a
  // name query), where the palette offers both.
  target: WishlistPaletteTarget | null;
  // Free-text name search, lowercased; empty string when the input is pure
  // navigation.
  query: string;
};

export function parseWishlistQuery(input: string): WishlistPaletteQuery | null {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  const head = tokens[0];

  // `upcoming` heads its own route now, and takes no arguments: the calendar has
  // no per-item anchor to search toward. Trailing tokens make it someone else's
  // grammar rather than a malformed one of ours.
  if (head === "upcoming") {
    if (tokens.length > 1) return null;
    return { kind: "wishlist", target: "upcoming", query: "" };
  }
  if (head !== "wishlist") return null;

  const rest = tokens.slice(1);
  // A lone `upcoming` / `all` after the head is navigation. Anything else —
  // including a keyword followed by more tokens — is a name query; there is no
  // combined destination+name target, so the name search wins.
  const second = rest[0];
  if (rest.length === 1 && (second === "upcoming" || second === "all")) {
    return {
      kind: "wishlist",
      target: second === "upcoming" ? "upcoming" : "wishlist",
      query: "",
    };
  }

  return { kind: "wishlist", target: null, query: rest.join(" ") };
}
