// Pure parsers for the LoL static-metadata pipeline. No I/O — every fn takes
// a string payload and returns parsed records. Kept isolated from
// `lol-static-sync.service.ts` so the regex/Lua-shape handling can be tested
// without mocking fetch.

export interface ParsedItem {
  id: number;
  name: string;
  tier: number | null;
  itemType: string[];
  priceTotal: number | null;
  recipe: string[];
  categories: string[];
  stats: Record<string, number>;
  descriptionWikitext: string | null;
}

export interface ParsedAbility {
  slot: "Passive" | "Q" | "W" | "E" | "R";
  name: string;
}

export interface ParsedChampionAbilities {
  championWikiName: string;
  abilities: ParsedAbility[];
}

export interface ParsedAbilityTemplate {
  description: string | null;
  icon: string | null;
}

export interface ParsedProfileIcon {
  id: number;
  title: string;
  availability: string | null;
  release: number | null;
}

const SKILL_SLOT: Record<string, ParsedAbility["slot"]> = {
  i: "Passive",
  q: "Q",
  w: "W",
  e: "E",
  r: "R",
};

// Find the matching close-brace for an open-brace at `openIdx`. Tracks
// string-quoting so braces inside wiki descriptions (e.g. `{{as|200% AD}}`)
// don't confuse the depth counter. Returns the substring inclusive of both
// braces; empty string when unbalanced — caller treats that as "field
// absent" rather than erroring on a malformed module.
function extractBracedValue(lua: string, openIdx: number): string {
  if (lua[openIdx] !== "{") return "";
  let depth = 0;
  let inString = false;
  for (let i = openIdx; i < lua.length; i++) {
    const c = lua[i];
    if (inString) {
      if (c === "\\" && i + 1 < lua.length) {
        i++;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return lua.slice(openIdx, i + 1);
    }
  }
  return "";
}

function findFieldValueStart(block: string, key: string): number {
  // Match `["key"]    = ` (any whitespace between key and =, any after =).
  const re = new RegExp(`\\["${key}"\\]\\s*=\\s*`, "g");
  const m = re.exec(block);
  if (!m) return -1;
  return m.index + m[0].length;
}

function parseStringField(block: string, key: string): string | null {
  const start = findFieldValueStart(block, key);
  if (start < 0) return null;
  const m = block.slice(start).match(/^"((?:[^"\\]|\\.)*)"/);
  if (!m || m[1] === undefined) return null;
  return m[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\");
}

function parseIntField(block: string, key: string): number | null {
  const start = findFieldValueStart(block, key);
  if (start < 0) return null;
  const m = block.slice(start).match(/^-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseStringList(block: string, key: string): string[] {
  const start = findFieldValueStart(block, key);
  if (start < 0) return [];
  const value = extractBracedValue(block, start);
  if (!value) return [];
  const result: string[] = [];
  for (const m of value.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    if (m[1] !== undefined) result.push(m[1]);
  }
  return result;
}

function parseNumericRecord(block: string, key: string): Record<string, number> {
  const start = findFieldValueStart(block, key);
  if (start < 0) return {};
  const value = extractBracedValue(block, start);
  if (!value) return {};
  const result: Record<string, number> = {};
  for (const m of value.matchAll(/\["([^"]+)"\]\s*=\s*(-?\d+(?:\.\d+)?)/g)) {
    const k = m[1];
    const n = Number(m[2]);
    if (k && Number.isFinite(n)) result[k] = n;
  }
  return result;
}

// Parse the keys of a record-style sub-table (e.g. `["menu"] = { ["tank"] = true, ... }`)
// — returns the inner keys as strings, ignoring values.
function parseRecordKeys(block: string, key: string): string[] {
  const start = findFieldValueStart(block, key);
  if (start < 0) return [];
  const value = extractBracedValue(block, start);
  if (!value) return [];
  const keys: string[] = [];
  for (const m of value.matchAll(/\["([^"]+)"\]\s*=/g)) {
    if (m[1]) keys.push(m[1]);
  }
  return keys;
}

// Pull the first `description` string out of an effects table. The wiki
// stores it as `["pass"] = { ["description"] = "..." }` for passives and
// `["pass2"] = { ... }` for stacked passives; we take whichever is first
// (typically the headline passive). Empty when absent or malformed.
function parseFirstDescription(block: string): string | null {
  const start = findFieldValueStart(block, "effects");
  if (start < 0) return null;
  const effects = extractBracedValue(block, start);
  if (!effects) return null;
  const m = effects.match(/\["description"\]\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (!m || m[1] === undefined) return null;
  return m[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\");
}

// Parses `Module:ItemData/data` (~410KB Lua) into one record per item.
// Enumerate `["NAME"] = { ... }` top-level entries inside a wiki Lua
// module's outer `return { ... }` wrapper. Indentation varies between
// modules (`Module:ChampionData/data` uses 2 spaces, `Module:ItemData/data`
// uses 4 with tabs inside), so a regex split on indent over-matches every
// nested key. Instead, walk the string with brace-aware depth tracking and
// only emit entries seen at depth 1.
function* enumerateTopLevelEntries(
  lua: string
): Generator<{ name: string; block: string }> {
  let depth = 0;
  let inString = false;
  let i = 0;
  while (i < lua.length) {
    const c = lua[i];
    if (inString) {
      if (c === "\\" && i + 1 < lua.length) {
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      // Only treat as a top-level entry when we're at depth 1 and this
      // string is in the `["NAME"]` opener position.
      if (depth === 1) {
        // Look back for `[` and ahead for `"]\s*=\s*{`.
        const closeQuote = lua.indexOf('"', i + 1);
        if (closeQuote < 0) break;
        const after = lua.slice(closeQuote + 1, closeQuote + 32);
        const m = after.match(/^\]\s*=\s*\{/);
        if (lua[i - 1] === "[" && m) {
          const name = lua.slice(i + 1, closeQuote);
          const braceIdx = closeQuote + 1 + m[0].length - 1;
          const block = extractBracedValue(lua, braceIdx);
          if (block) yield { name, block };
          i = braceIdx + block.length;
          continue;
        }
      }
      inString = true;
      i += 1;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    i += 1;
  }
}

// Failure to parse one item does not abort the rest — callers should log
// per-item warnings.
export function parseItemDataModule(lua: string): ParsedItem[] {
  const results: ParsedItem[] = [];
  for (const { name, block } of enumerateTopLevelEntries(lua)) {
    const id = parseIntField(block, "id");
    if (id === null) continue;
    results.push({
      id,
      name,
      tier: parseIntField(block, "tier"),
      itemType: parseStringList(block, "type"),
      priceTotal: parseIntField(block, "buy"),
      recipe: parseStringList(block, "recipe"),
      categories: parseRecordKeys(block, "menu"),
      stats: parseNumericRecord(block, "stats"),
      descriptionWikitext: parseFirstDescription(block),
    });
  }
  return results;
}

// Parse `Module:IconData/data` into one record per profile icon. The wiki
// keys entries by editorial title (e.g. `"Fenerbahçe 2017"`), which doubles
// as the image filename slug — `{Title}_profileicon.png` resolves under
// `wiki.leagueoflegends.com/en-us/images/`. `id` matches Riot's numeric
// profileIconId returned by Summoner-V4. Entries without an `id` field
// (rare malformed rows) are skipped silently.
export function parseIconDataModule(lua: string): ParsedProfileIcon[] {
  const results: ParsedProfileIcon[] = [];
  for (const { name, block } of enumerateTopLevelEntries(lua)) {
    const id = parseIntField(block, "id");
    if (id === null) continue;
    results.push({
      id,
      title: name,
      availability: parseStringField(block, "availability"),
      release: parseIntField(block, "release"),
    });
  }
  return results;
}

// Parse `Module:ChampionData/data` into one record per champion, with all
// named ability variants per slot preserved in source order. Mirrors the
// existing parser in patch.service.ts but builds an array (rather than a
// name→slot map) so multiple variants under the same slot (Karma's W,
// Lee Sin's W) round-trip into discrete LolChampionAbility rows.
export function parseChampionAbilityModule(lua: string): ParsedChampionAbilities[] {
  const result: ParsedChampionAbilities[] = [];
  for (const { name: championWikiName, block } of enumerateTopLevelEntries(lua)) {
    const abilities: ParsedAbility[] = [];
    for (const m of block.matchAll(/\["skill_([iqwer])"\]\s*=\s*\{([^}]+)\}/g)) {
      const slotKey = m[1];
      const inner = m[2];
      if (!slotKey || !inner) continue;
      const slot = SKILL_SLOT[slotKey];
      if (!slot) continue;
      for (const n of inner.matchAll(/\[\d+\]\s*=\s*"([^"]+)"/g)) {
        const abilityName = n[1];
        if (abilityName) abilities.push({ slot, name: abilityName });
      }
    }
    if (abilities.length > 0) {
      result.push({ championWikiName, abilities });
    }
  }
  return result;
}

// Extract one `|<field> = <value>` pair from a `Template:Data X/Y` wikitext
// payload. Tracks `{{ }}` depth so a value containing nested wiki templates
// (e.g. `{{as|magic damage}}`) isn't terminated by the inner pipe. The value
// runs until the next top-level `\n|<field2>=` or the closing `\n}}` of the
// outer template. Returns null when the field is absent or empty.
function extractTemplateField(wikitext: string, field: string): string | null {
  const re = new RegExp(`\\n\\|\\s*${field}\\s*=\\s*`);
  const m = re.exec(wikitext);
  if (!m) return null;
  const start = m.index + m[0].length;

  let depth = 0;
  let i = start;
  while (i < wikitext.length) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth += 1;
      i += 2;
      continue;
    }
    if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      if (depth === 0) {
        const v = wikitext.slice(start, i).trim();
        return v.length > 0 ? v : null;
      }
      depth -= 1;
      i += 2;
      continue;
    }
    if (depth === 0 && wikitext[i] === "\n" && wikitext[i + 1] === "|") {
      const v = wikitext.slice(start, i).trim();
      return v.length > 0 ? v : null;
    }
    i += 1;
  }
  const v = wikitext.slice(start).trim();
  return v.length > 0 ? v : null;
}

// `Template:Data {Champion}/{Ability}` carries `|description = ...` (rich
// wikitext) and `|icon = ...` (filename) alongside leveling/cost/range
// fields we don't yet persist. Pulls just the two fields useChampionSpells
// needs; everything else is ignored on purpose so future template churn
// in unused fields doesn't break the parser.
export function parseAbilityTemplate(wikitext: string): ParsedAbilityTemplate {
  return {
    description: extractTemplateField(wikitext, "description"),
    icon: extractTemplateField(wikitext, "icon"),
  };
}
