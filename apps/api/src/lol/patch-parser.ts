// Parses a League of Legends patch-notes wikitext blob (from MediaWiki
// `action=parse&prop=wikitext`) into a flat list of change rows across the
// Champions, Items, and Runes sections.
//
// Champions block (`=== Champions ===`):
//
//   ;{{ci|ChampionName}}
//   * {{ai|AbilityName|ChampionName}}
//   ** change line
//   ** another change line
//
// Items / Runes blocks (`=== Items ===` / `=== Runes ===`):
//
//   ;{{ii|ItemName}}              ;{{ri|RuneName}}
//   * change line                 * change line
//   ** sub-bullet                 ** sub-bullet
//
// Items/runes use `*` directly for change content (no `{{ai|...}}` ability
// layer); sub-bullets are flattened into the parent change list. Template
// stripping is recursive (innermost-first) to handle nested cases like
// `{{as|{{ap|2 to 3}}% of '''maximum''' health}}`.
//
// Champion `ability` is stored as the wiki ability name verbatim (e.g.
// "Cunning Sweep", "Passive"); item/rune rows always have `ability: null`.
// Mapping ability names to Q/W/E/R slots requires ddragon champion data
// and is deferred — UI consumers render the verbatim name.

export type PatchSection = "champion" | "item" | "rune";

export type ChangeType = "buff" | "nerf" | "adjustment" | "new_effect" | "removed";

export interface ParsedChange {
  section: PatchSection;
  subject: string;
  ability: string | null;
  changeText: string;
  changeType: ChangeType | null;
}

// `== Section ==` may appear with varying spacing/equals counts. We match
// `={2,}\s*Name\s*={2,}` and slice from the next line. `[^=]+` inside the
// next-heading regex stops scanning at the next equals-framed header.
const CHAMPIONS_HEADING = /^={2,}\s*Champions\s*={2,}\s*$/m;
const ITEMS_HEADING = /^={2,}\s*Items\s*={2,}\s*$/m;
const RUNES_HEADING = /^={2,}\s*Runes\s*={2,}\s*$/m;
const NEXT_HEADING = /^={2,}\s*[^=]+={2,}\s*$/m;

const CHAMPION_ANCHOR = /^;\s*\{\{ci\|([^}|]+)(?:\|[^}]*)?\}\}/;
const ITEM_ANCHOR = /^;\s*\{\{ii\|([^}|]+)(?:\|[^}]*)?\}\}/;
const RUNE_ANCHOR = /^;\s*\{\{ri\|([^}|]+)(?:\|[^}]*)?\}\}/;
const ABILITY_ANCHOR = /^\*\s+\{\{ai\|([^}|]+)(?:\|[^}]*)?\}\}/;
const BARE_ABILITY_LINE = /^\*\s+(?!\{\{ai\|)(.*)$/;
const CHAMPION_CHANGE_LINE = /^\*\*+\s+(.+)$/;
// Items / runes use `*` directly for change content; `**` sub-bullets are
// flattened into the same list. One pattern matches both indent depths.
const FLAT_CHANGE_LINE = /^\*+\s+(.+)$/;

export function parsePatchWikitext(wikitext: string): ParsedChange[] {
  return [
    ...parseChampionSection(wikitext),
    ...parseFlatAnchoredSection(wikitext, ITEMS_HEADING, ITEM_ANCHOR, "item"),
    ...parseFlatAnchoredSection(wikitext, RUNES_HEADING, RUNE_ANCHOR, "rune"),
  ];
}

function parseChampionSection(wikitext: string): ParsedChange[] {
  const body = sliceSection(wikitext, CHAMPIONS_HEADING);
  if (!body) return [];

  const changes: ParsedChange[] = [];
  let currentChampion: string | null = null;
  let currentAbility: string | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const champMatch = line.match(CHAMPION_ANCHOR);
    if (champMatch?.[1]) {
      currentChampion = champMatch[1].trim();
      currentAbility = null;
      continue;
    }

    const abilityMatch = line.match(ABILITY_ANCHOR);
    if (abilityMatch?.[1]) {
      currentAbility = abilityMatch[1].trim();
      continue;
    }

    // A `* `-prefixed line without `{{ai|...}}` marks a base-stats block.
    if (BARE_ABILITY_LINE.test(line)) {
      currentAbility = "Base";
      continue;
    }

    const changeMatch = line.match(CHAMPION_CHANGE_LINE);
    if (changeMatch?.[1] && currentChampion) {
      const raw = changeMatch[1];
      changes.push({
        section: "champion",
        subject: currentChampion,
        ability: currentAbility,
        changeText: stripTemplates(raw),
        changeType: classify(raw),
      });
    }
  }

  return changes;
}

// Items + runes share an identical shape: an anchor template followed by
// one or more `*`/`**`-prefixed change lines. `ability` is always null.
function parseFlatAnchoredSection(
  wikitext: string,
  heading: RegExp,
  anchor: RegExp,
  section: PatchSection
): ParsedChange[] {
  const body = sliceSection(wikitext, heading);
  if (!body) return [];

  const changes: ParsedChange[] = [];
  let currentSubject: string | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const anchorMatch = line.match(anchor);
    if (anchorMatch?.[1]) {
      currentSubject = anchorMatch[1].trim();
      continue;
    }

    const changeMatch = line.match(FLAT_CHANGE_LINE);
    if (changeMatch?.[1] && currentSubject) {
      const raw = changeMatch[1];
      changes.push({
        section,
        subject: currentSubject,
        ability: null,
        changeText: stripTemplates(raw),
        changeType: classify(raw),
      });
    }
  }

  return changes;
}

function sliceSection(wikitext: string, heading: RegExp): string | null {
  const headingMatch = wikitext.match(heading);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const after = wikitext.slice(headingMatch.index + headingMatch[0].length);
  const next = after.match(NEXT_HEADING);
  return next?.index !== undefined ? after.slice(0, next.index) : after;
}

// Iteratively strip wiki templates from innermost outward. Each pass
// rewrites the deepest `{{...}}` (one with no nested braces) to its
// display form, until none remain. Also strips `'''bold'''` markers
// and collapses whitespace.
export function stripTemplates(input: string): string {
  let text = input;
  // Cap iterations to avoid pathological loops on malformed input.
  for (let i = 0; i < 50; i++) {
    const innermost = /\{\{([^{}]+)\}\}/;
    const match = text.match(innermost);
    if (!match || match.index === undefined) break;
    text =
      text.slice(0, match.index) +
      renderTemplate(match[1] ?? "") +
      text.slice(match.index + match[0].length);
  }
  return text
    .replace(/'''([^']+)'''/g, "$1")
    .replace(/''([^']+)''/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Render a single template body (the text between `{{` and `}}`, with
// no further nesting) to its display string per the conventions in
// docs/working-notes/lol-patch-notes.md.
function renderTemplate(body: string): string {
  const parts = body.split("|");
  const name = (parts[0] ?? "").trim().toLowerCase();
  const args = parts.slice(1);
  const first = args[0]?.trim() ?? "";

  switch (name) {
    // Value/format templates and section anchors all collapse to their
    // first arg: `{{ap|2 to 3}}` → "2 to 3", `{{g|1000}}` → "1000",
    // `{{fd|0.6}}` → "0.6", `{{pp|2 to 6}}` → "2 to 6",
    // `{{rd|48%|36%}}` → "48%" (primary tier),
    // `{{ii|Lich Bane}}` → "Lich Bane", `{{tip|fear}}` → "fear".
    case "ap":
    case "as":
    case "sbc":
    case "ci":
    case "ai":
    case "ii":
    case "ri":
    case "si":
    case "g":
    case "fd":
    case "pp":
    case "rd":
    case "tip":
      return first;
    default:
      // Unknown template: prefer joining args (preserves info), else name.
      return args.length > 0 ? args.map((a) => a.trim()).join(" ") : name;
  }
}

function classify(rawLine: string): ChangeType | null {
  if (/\{\{sbc\|\s*new effect:?\s*\}\}/i.test(rawLine)) return "new_effect";
  if (/\{\{sbc\|\s*removed:?\s*\}\}/i.test(rawLine)) return "removed";
  if (/\{\{sbc\|\s*adjusted:?\s*\}\}/i.test(rawLine)) return "adjustment";
  // Direction classification only fires on lines without an sbc tag, to
  // avoid mis-labelling mechanic-rewrite lines that happen to contain
  // "increased" or "reduced" in their prose.
  if (/\bincreased to\b/i.test(rawLine)) return "buff";
  if (/\breduced to\b/i.test(rawLine)) return "nerf";
  return null;
}
