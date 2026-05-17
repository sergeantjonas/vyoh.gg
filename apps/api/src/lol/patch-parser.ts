// Parses a League of Legends patch-notes wikitext blob (from MediaWiki
// `action=parse&prop=wikitext`) into a flat list of champion change rows.
//
// The wiki structure under `== Champions ==` is:
//
//   ;{{ci|ChampionName}}
//   * {{ai|AbilityName|ChampionName}}
//   ** change line with embedded {{ap|...}} / {{as|...}} / {{sbc|...}} templates
//   ** another change line
//
// We track the current champion + ability anchors while walking lines, and
// emit one `ParsedChange` per `**`-prefixed line. Template stripping is
// recursive (innermost-first) to handle nested cases like
// `{{as|{{ap|2 to 3}}% of '''maximum''' health}}`.
//
// `ability` is stored as the wiki ability name verbatim (e.g. "Cunning
// Sweep", "Passive"). Mapping ability names to Q/W/E/R slots requires
// ddragon champion data and is deferred to PN2 where the UI consumes it.

export type ChangeType = "buff" | "nerf" | "adjustment" | "new_effect" | "removed";

export interface ParsedChange {
  champion: string;
  ability: string | null;
  changeText: string;
  changeType: ChangeType | null;
}

// `== Champions ==` may appear with varying spacing/equals counts. We
// match `==+ \s*Champions \s*==+` and slice from the next line.
const CHAMPIONS_HEADING = /^={2,}\s*Champions\s*={2,}\s*$/m;
// `== <Anything> ==` after the Champions section ends the slice.
const NEXT_HEADING = /^={2,}\s*[^=]+={2,}\s*$/m;

const CHAMPION_ANCHOR = /^;\s*\{\{ci\|([^}|]+)(?:\|[^}]*)?\}\}/;
const ABILITY_ANCHOR = /^\*\s+\{\{ai\|([^}|]+)(?:\|[^}]*)?\}\}/;
const BARE_ABILITY_LINE = /^\*\s+(?!\{\{ai\|)(.*)$/;
const CHANGE_LINE = /^\*\*+\s+(.+)$/;

export function parsePatchWikitext(wikitext: string): ParsedChange[] {
  const champSection = sliceChampionsSection(wikitext);
  if (!champSection) return [];

  const changes: ParsedChange[] = [];
  let currentChampion: string | null = null;
  let currentAbility: string | null = null;

  for (const rawLine of champSection.split("\n")) {
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

    const changeMatch = line.match(CHANGE_LINE);
    if (changeMatch?.[1] && currentChampion) {
      const raw = changeMatch[1];
      changes.push({
        champion: currentChampion,
        ability: currentAbility,
        changeText: stripTemplates(raw),
        changeType: classify(raw),
      });
    }
  }

  return changes;
}

function sliceChampionsSection(wikitext: string): string | null {
  const headingMatch = wikitext.match(CHAMPIONS_HEADING);
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
    case "ap":
    case "as":
      return first;
    case "sbc":
      return first;
    case "ci":
    case "ai":
      // These are anchor templates; inside a change line they shouldn't
      // appear, but render the visible arg defensively if they do.
      return first;
    default:
      // Unknown template: prefer the first arg if present, else the name.
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
