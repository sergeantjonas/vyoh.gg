// Steam wishlist palette grammar for the ⌘K palette — a navigation + name
// search verb, parallel to `parsePaletteVerb` (LoL `/patches`) and
// `parseSteamLibraryQuery` (`dev:`/`pub:`/`franchise:`). The head keyword is
// `wishlist`; what follows is either a tab keyword (navigation) or free text
// (find a wishlisted game by name):
//
//   wishlist            → open the wishlist (route's default tab)
//   wishlist upcoming   → /steam/wishlist?tab=upcoming
//   wishlist all        → /steam/wishlist?tab=all
//   wishlist <name>     → find a wishlisted game → ?tab=all&appid=<id>
//
// Why a separate parser per stream/intent: per the F/G-chunk pattern
// (`parsePaletteVerb` and `parseSteamLibraryQuery` are both already separate
// from `parseMatchQuery`), each grammar stays narrowly typed to its own verbs
// and the dialog dispatches.

export type WishlistTabKeyword = "upcoming" | "all";

export type WishlistPaletteQuery = {
  kind: "wishlist";
  // `wishlist upcoming` / `wishlist all` resolve a tab; bare `wishlist` (or a
  // name query) leaves it null so the route falls back to its own default tab.
  tab: WishlistTabKeyword | null;
  // Free-text name search, lowercased; empty string when the input is pure
  // navigation.
  query: string;
};

export function parseWishlistQuery(input: string): WishlistPaletteQuery | null {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens[0] !== "wishlist") return null;

  const rest = tokens.slice(1);
  // A lone `upcoming` / `all` after the head is a tab navigation. Anything
  // else — including a tab keyword followed by more tokens — is a name query;
  // the route has no combined tab+name target, so the name search wins.
  const head = rest[0];
  if (rest.length === 1 && (head === "upcoming" || head === "all")) {
    return { kind: "wishlist", tab: head, query: "" };
  }

  return { kind: "wishlist", tab: null, query: rest.join(" ") };
}
