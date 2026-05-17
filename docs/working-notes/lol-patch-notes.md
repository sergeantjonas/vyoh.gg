# LoL patch notes

A working note for patch-awareness features in the LoL section. Two surfaces share a single data pipeline:

1. **Profile heads-up** — when you visit your profile, a callout surfaces relevant changes for champions you actually play ("Ahri had changes in patch 26.10").
2. **Patch notes tab** — a dedicated tab under the account route showing all champion changes for the current patch, with your most-played champions highlighted and sorted to the top.

---

## Decisions

- **Data source: League of Legends wiki via MediaWiki API** (Weird Gloop, CC BY-SA 3.0). Patch pages live at `/en-us/V{major}.{minor}`; the wikitext is available at `https://wiki.leagueoflegends.com/api.php?action=parse&page=V{version}&prop=wikitext&format=json`. No auth required.
- **Not ddragon diffing.** ddragon snapshots only cover numeric stat values — mechanic changes, new effects, and removals are invisible. The wiki wikitext covers all of these.
- **Not LLM extraction.** The wiki wikitext is structured enough for regex-based parsing. Champion sections are anchored on `{{ci|ChampionName}}`, abilities on `{{ai|AbilityName|Champion}}`, and values on `{{ap|...}}`. Change direction is consistent prose ("reduced to X from Y" / "increased to X from Y"). `{{sbc|New Effect:}}` and `{{sbc|Removed:}}` mark mechanic-level changes.
- **Version detection via ddragon `/versions` endpoint.** `https://ddragon.leagueoflegends.com/api/versions.json` returns all versions newest-first, no auth. When the top entry changes, a new patch is live. A daily cron check is sufficient — patches drop every two weeks and lag within a day is acceptable.
- **Champion changes first; items/runes/system as a later pass.** The parser can be extended; the schema is designed for it.
- **Tab lives under `/lol/$accountSlug`.** Patch notes are global but personalization (play frequency, highlighting) is per-account. Avoids a standalone route for now.

---

## Data source details

### Version detection

```
GET https://ddragon.leagueoflegends.com/api/versions.json
→ ["26.10.1", "26.9.1", ...]
```

Compare top entry against `patch_versions.version` in DB. If new, trigger the parse job.

### Wikitext fetch

```
GET https://wiki.leagueoflegends.com/api.php
  ?action=parse&page=V{major}.{minor}&prop=wikitext&format=json
```

Returns the full page wikitext. The champion section starts after the `== Champions ==` heading.

### Wikitext structure (verbatim examples)

```wiki
;{{ci|Ambessa}}
* {{ai|Cunning Sweep|Ambessa}}
** Target's health ratio increased to {{as|{{ap|2 to 3}}% of target's '''maximum''' health}} from {{as|{{ap|1 to 3}}%|health}}.
** Bonus monster damage reduced to 75 from 125.

;{{ci|Lee Sin}}
* {{ai|Safeguard|Lee Sin}}
** Base shield reduced to {{ap|60 to 240}} from {{ap|70 to 250}}.
** Cooldown reduced to 7 seconds from 12.
** {{sbc|Removed:}} If the targeted ally is a champion upon arrival...
** {{sbc|New Effect:}} When targeting an ally minion or ward...
```

**Template key:**

| Template | Meaning |
|---|---|
| `{{ci|Name}}` | Champion section anchor |
| `{{ai|Ability|Champion}}` | Ability sub-section |
| `{{ap|x to y}}` | Rank-scaled value range |
| `{{as|...}}` | Stat styling (strip outer wrapper, keep content) |
| `{{sbc|Text:}}` | Change-type label — Removed, New Effect, etc. |

**Parse strategy:** extract champion name from `{{ci|...}}`, ability name from `{{ai|...}}`, then collect all `**`-prefixed lines until the next champion anchor. Strip templates to produce display-ready strings. Store the raw stripped lines — no need to compute numeric deltas; the wiki prose is already human-readable.

---

## Schema

```sql
-- One row per detected patch version
CREATE TABLE patch_versions (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL UNIQUE,   -- e.g. "26.10"
  patch_date  DATE,                   -- populated from ddragon version string or schedule
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per change line, per ability, per champion, per patch
CREATE TABLE champion_patch_changes (
  id              SERIAL PRIMARY KEY,
  patch_version   TEXT NOT NULL REFERENCES patch_versions(version),
  champion_key    TEXT NOT NULL,   -- normalized, e.g. "Ahri"
  ability         TEXT,            -- "Q", "W", "E", "R", "Passive", "Base", or null for base stats
  change_text     TEXT NOT NULL,   -- display-ready stripped string
  change_type     TEXT,            -- "buff" | "nerf" | "adjustment" | "new_effect" | "removed" | null
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON champion_patch_changes (patch_version, champion_key);
```

`change_type` is a best-effort classification from the prose direction ("increased to" → buff, "reduced to" → nerf, `{{sbc|New Effect:}}` → new_effect, `{{sbc|Removed:}}` → removed). Null when the direction is ambiguous.

---

## Architecture

```
[Daily cron]
  → GET ddragon/versions.json
  → compare top entry vs patch_versions table
  → if new patch:
      → GET wiki wikitext for V{version}
      → parse champion section → champion_patch_changes rows
      → insert patch_versions + champion_patch_changes

[API endpoint]
  GET /lol/patches/current/changes?champions[]=Ahri&champions[]=Yasuo
  → join champion_patch_changes on patch_version = latest + champion_key IN (...)
  → return grouped by champion

[Profile heads-up]
  → after top-champions query resolves, fetch /lol/patches/current/changes
    with top 5 champion keys
  → render callout if any changes exist

[Patch notes tab]
  → fetch /lol/patches/current/changes (all champions)
  → sort: user's played champions first (by play count), rest alphabetical
  → highlight user's champions with a badge or ring
  → "My champions" toggle filters to played-only
```

---

## Chunk plan

### PN1 — Version detection + parse job (API only) — **shipped 2026-05-17**

- ✅ `PatchVersion` + `ChampionPatchChange` Prisma migration
- ✅ `PatchService.syncIfNewPatch()` — ddragon `/versions.json` poll, `truncateVersion` (legacy season-major → year-based +10, mirroring `apps/web/src/lol/_shared/patch/patch-version.ts`), `wikiPageTitle` zero-pads minor for the wiki page name
- ✅ `parsePatchWikitext` parser with 11 unit tests covering anchor extraction, nested template stripping, buff/nerf/sbc classification
- ✅ `@Cron("0 */6 * * *")` wired on the service; 4 cheap GETs/day, parse only fires on detected change
- ✅ One-shot `scripts/run-patch-sync.ts` for manual runs; smoke-tested against V26.10 → 58 changes across 24 champions (12 buff / 18 nerf / 4 new_effect / 1 removed / 23 unclassified — mostly bug-fix prose without direction words)

**Deferred to PN2:** ability name → slot (Q/W/E/R/Passive) mapping needs ddragon champion data; stored verbatim as wiki name for now. `patchDate` stays nullable (backfill from MediaWiki revision timestamp later). Cosmetic parser nit: adjacent `{{ap|...}}` templates collapse without a separator (e.g. "15 to 20 3% of damage dealt" instead of "15 to 20% per 3% of damage dealt") — revisit when prose rendering becomes a UI concern.

Files: `apps/api/src/lol/patch.service.ts`, `apps/api/src/lol/patch-parser.ts`, `apps/api/src/lol/patch-parser.spec.ts`, `apps/api/src/lol/patch.service.spec.ts`, `apps/api/prisma/migrations/20260517015157_patch_notes_pn1/`, `apps/api/src/scripts/run-patch-sync.ts`, `apps/api/src/lol/lol.module.ts`

### PN2 — Profile heads-up — **shipped 2026-05-17**

- ✅ `GET /lol/patches/current/changes?champion=Ahri&champion=Wukong` — `PatchController` + `PatchService.getCurrentChanges`; repeated `champion` query param, max 20, dedupe + trim
- ✅ Shared `CurrentPatchChangesResponse` / `ChampionPatchChangeGroup` / `ChampionPatchChangeLine` / `ChampionPatchChangeKind` types
- ✅ `ProfilePatchNotice` callout mounted in `/lol/$accountSlug/` between the live-game chip and the pre-game ritual; derives top-5 champions from `useMatchWindow().matches`, resolves Riot aliases → wiki names via existing `useChampionName` (CDragon-backed)
- ✅ Dismissible per patch via `vyoh:patch-notice-dismissed:{version}` localStorage key
- ✅ Per-line glyph: ↑ buff (emerald), ↓ nerf (rose), + new_effect (sky), × removed (muted); 3 lines visible per champion with `+N more` overflow line
- ✅ 13 unit tests (`patch.service.spec.ts` getCurrentChanges + `patch.controller.spec.ts` normalizeChampions)

**Deferred to PN3:** ability name → Q/W/E/R slot mapping (still stored verbatim as wiki ability name); `+N more` line is currently plain text — wire it to the patch-notes tab once PN3 lands.

### PN3 — Patch notes tab

- Tab added to the account route tab bar
- Full champion list for current patch, sorted by your play count
- Your champions highlighted (badge/ring consistent with existing champion card style)
- "My champions only" toggle
- Patch selector (dropdown or prev/next) for browsing history

Files: new tab route, patch notes list component, champion change card component

### PN4 — Items, runes, system (stretch)

- Extend parser to handle `== Items ==` and `== Runes ==` sections
- Add `section` column to `champion_patch_changes` (rename to `patch_changes`)
- Surface in the patch notes tab as collapsible sections below champions

---

## Open questions

- **Patch date display.** ddragon version strings don't carry a calendar date. Options: derive from the wiki page's `timestamp` field in the MediaWiki API response, maintain a manual schedule, or just show the version string without a date.
- **Rolling history depth.** Keep all patches indefinitely — storage is negligible (a few hundred rows per patch, 26 patches/year) and history enables future surfaces: buff/nerf trajectory badges, LP timeline patch markers, win-rate-before/after-nerf correlations. The wiki has every historical patch page going back years at the same API endpoint and format, so a one-shot backfill is available any time.
- **Change type reliability.** "Reduced to / increased to" classification will mis-fire on complex lines. Consider leaving `change_type` null for mechanic-change lines and only classifying clean numeric lines.
