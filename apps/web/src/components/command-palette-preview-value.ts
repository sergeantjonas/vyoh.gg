// Sentinel-prefix parser for cmdk row values. Each CommandItem in
// command-palette-dialog.tsx that has a preview-able entity tags its `value`
// with `<type>:<id>` so the preview can dispatch on a structured descriptor
// instead of reverse-parsing free-form tokens.
//
// The existing `ACCOUNT_VALUE_PREFIX = "account:"` chord path established
// this pattern; champion/match/steam-game extend it for the Chunk 3 preview.
//
// Pages, tabs, and recents stay un-prefixed → `{ type: "other" }`, which the
// preview treats as "no entity content, render nothing."

export type ParsedPaletteValue =
  | { type: "champion"; alias: string }
  | { type: "match"; matchId: string }
  | { type: "steam-game"; appid: string }
  | { type: "account"; slug: string }
  | { type: "other" };

const SENTINEL = /^(champion|match|steam-game|account):([^\s]+)/;

export function parsePaletteValue(value: string): ParsedPaletteValue {
  const match = value.match(SENTINEL);
  if (!match) return { type: "other" };
  const [, type, id] = match;
  switch (type) {
    case "champion":
      return { type, alias: id ?? "" };
    case "match":
      return { type, matchId: id ?? "" };
    case "steam-game":
      return { type, appid: id ?? "" };
    case "account":
      return { type, slug: id ?? "" };
    default:
      return { type: "other" };
  }
}
