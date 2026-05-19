# LoL patch-notes pipeline — wiki wikitext as a structured feed

> Two product surfaces ride on one parser: a profile-page "what changed for your champs since you last queued" heads-up, and a per-patch selector that renders the entire slate. Riot doesn't publish a structured patch-notes feed; the LoL wiki does, in wikitext. Eleven regex anchors, a 6-hour cron, and a single Postgres table replace the missing API.

## TL;DR

- **Source of truth: the LoL wiki, not Riot.** ddragon `/versions.json` answers "is there a new patch yet"; the wiki's MediaWiki API answers "what changed."
- **Regex parser over LLM extraction.** Deterministic, free, cacheable, debuggable. The wikitext is structured enough that anchors + template stripping cover every line that carries game-state info.
- **Two product surfaces, one parser.** Profile-page heads-up filters to the caller's top-5 champions; the patch-notes tab renders the entire slate partitioned by section (champions / items / runes).
- **Wiki icons by URL convention.** Items and runes don't need an API call — name + kind deterministically yields `…/Phase_Rush_rune.png`. Removed entities keep their image forever, which is exactly what a historical-changes table needs.
- **Cron-driven, idempotent, no queue.** Every 6h: poll ddragon, short-circuit if version already in DB, otherwise fetch + parse + persist in one transaction. Re-runnable after a parser bugfix.

## The setup

The product needs patch context for two reasons:

1. **Freshness signal on the profile page** — "These three champions you play got changed on V26.10. Here's what." A small persistent banner that sells the project as "actually current," not a frozen demo.
2. **Patch-drift verdicts on the champion-pool page** — a per-champion verdict that explains *why* a stat moved. "Win rate down 4pp on Lillia, V26.09 nerfed her Q damage by 12%." That's the load-bearing use case; freshness is the cosmetic one.

Both need structured patch data: subject (champion / item / rune), ability slot (Q/W/E/R/Passive), change text, and ideally a directional classification (buff / nerf / adjustment / new effect / removed).

Riot publishes patch notes as a CMS-rendered HTML page. No structured feed, no API, no contract. Scraping the HTML is brittle by construction — every redesign breaks the parse. ddragon publishes the version string and the per-champion stat JSON, but not the human-language change log.

The LoL community wiki has shipped a `V<year>.<patch>` page for every patch since 2009. It's editor-curated, follows a strict template convention, and — crucially — is exposed as raw [MediaWiki wikitext](https://www.mediawiki.org/wiki/Wikitext) through the public API. Structured-by-convention text, not HTML.

## The shape

```
                       ┌────────────────────────────┐
                       │  ddragon /versions.json    │  ── poll every 6h
                       └──────────────┬─────────────┘
                                      │ "16.10.1"  →  truncateVersion()  →  "26.10"
                                      ▼
                        ┌─────────────────────────┐
                        │ PatchVersion lookup     │  short-circuit if exists
                        └──────────────┬──────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────┐
                  │ wiki MediaWiki API: V26.10 wikitext  │
                  └──────────────────┬───────────────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       ▼                           ▼
              parsePatchWikitext()        fetchChampionAbilityData()
              ─ champion / item / rune    ─ wiki Module:ChampionData/data
                anchor regexes              ─ ddragon champion.json
              ─ template stripping          (parallel; alias → display
              ─ change-type classifier       → slot triangulation)
                       └─────────────┬─────────────┘
                                     ▼
                       ┌─────────────────────────┐
                       │ persist(): single tx    │
                       │  delete + upsert + many │
                       └──────────────┬──────────┘
                                      ▼
                              PatchChange rows
                                      │
                ┌─────────────────────┴─────────────────────┐
                ▼                                           ▼
   GET /lol/patches/current/changes          GET /lol/patches/:v/changes
   (PN2 profile heads-up, top-5)             (PN3+PN4 full patch tab)
```

One cron writer, two read paths, zero queue. The cache is the database row.

## Chunk plan (PN1–PN7)

The arc shipped 2026-05-15 → 2026-05-17 in seven landable chunks:

| Chunk | What it shipped | Why split here |
| --- | --- | --- |
| **PN1** | Parser + service + cron + `PatchVersion` / `PatchChange` schema. Champion section only. | Get the cron writing rows before any UI depends on them. |
| **PN2** | Profile-page heads-up tile: top-5 champions filter on `GET /lol/patches/current/changes`. | First product surface — proves the data is real. |
| **PN3** | `/lol/$accountSlug/patches` route + per-patch selector backed by `GET /lol/patches`. | New surface, no new parser work — pure read API. |
| **PN4** | Items + runes parsing; PN3 tab now renders all three sections. Table renamed `lol/patch-notes` → `lol/patches` (rename without drop). | Parser scope expansion + URL rename in the same chunk because the surface is no longer champion-only. |
| **PN5** | Ability slot mapping (Q/W/E/R/Passive) + ability icons via parallel wiki `Module:ChampionData/data` + ddragon `champion.json` fetch. | The hardest single piece — needs the alias/display/slot triangulation to be correct before icons can render. |
| **PN6** | Release-date extraction from the `{{Infobox patch}}` block; sort order changed to `patchDate desc, version desc`. | Without dates, "newest patch" was string-sorted — fine until V26.10 sorts before V26.9. |
| **PN7** | Server-side `wikiEntryIconUrl(name, kind)` replaces client-side CDragon resolution for items + runes. | The client was constructing wiki image URLs from item names — moved to the API so the icon path is stored once at sync time. |

Each chunk landed in one commit, with the open-work index updated in the same commit (per the repo's maintenance rule). The full pre-ship working note is archived at [`docs/working-notes/archive/lol-patch-notes.md`](../working-notes/archive/lol-patch-notes.md).

## What worked

### Regex anchors over LLM extraction

The wikitext follows a strict template per section. Champion changes look like:

```
==Champions==
;{{ci|Ahri}}
*{{ai|Charm|Ahri}}
**Cooldown {{ap|14/13/12/11/10}} ⇒ {{ap|12/11.5/11/10.5/10}}.
**{{sbc|New effect:}} Now refunds 50% of cooldown on champion takedown.
*{{ai|Spirit Rush|Ahri}}
**Damage per missile {{ap|increased to 75}} from 60.
```

A small set of regexes ([apps/api/src/lol/patch-parser.ts:1-26](../../apps/api/src/lol/patch-parser.ts#L1-L26)) handles the entire structure:

- `^;\s*\{\{ci\|...\}\}` — champion anchor
- `^\*\s+\{\{ai\|Ability\|Champion\}\}` — ability anchor (or `^\*\s+'''…'''` for a base-stats block)
- `^\*\*+\s+(.+)$` — change line
- `\{\{sbc\|New effect:\}\}` / `Removed:` / `Adjusted:` — explicit change-type tags
- `\bincreased to\b` / `\breduced to\b` — directional classification (gated on absence of `{{sbc|…}}` to avoid misclassifying mechanic rewrites that happen to contain "increased")

Template stripping ([apps/api/src/lol/patch-parser.ts:181-203](../../apps/api/src/lol/patch-parser.ts#L181-L203)) recursively resolves innermost `{{…}}` first, then collapses bold markers and whitespace. Value templates (`{{ap|14/13/…}}`, `{{g|1000}}`, `{{fd|0.6}}`) all collapse to their first argument. Unknown templates fall back to joining their args, which is a strict win over dropping them.

An LLM call per line would cost ~2¢ per patch (well within budget) but would be non-deterministic — a re-parse of the same wikitext might emit subtly different change text, which then drifts the patch-drift verdict UI. Regexes give byte-stable output, free re-runs, and trivial debugging.

### One transaction, idempotent re-runs

Persist is three operations in a single Prisma `$transaction` ([patch.service.ts:333-358](../../apps/api/src/lol/patch.service.ts#L333-L358)):

```ts
await this.prisma.$transaction([
  this.prisma.patchChange.deleteMany({ where: { patchVersion: version } }),
  this.prisma.patchVersion.upsert({ where: { version }, create: { version, patchDate }, update: { patchDate } }),
  this.prisma.patchChange.createMany({ data: changes.map(...) }),
]);
```

Delete-before-insert means re-syncing after a parser bugfix is a single line — `pnpm --filter @vyoh/api db:run-patch-sync 26.10`. No duplicate rows, no migration, no drift between what the parser produces today and what's in the DB.

### Two surfaces, no orchestration

Two consumers, completely different shapes:

- **PN2 profile heads-up** — `GET /lol/patches/current/changes?champion=Ahri&champion=Wukong` returns just the latest patch's champion-section rows for those names. Top-5 champions, no items, no runes.
- **PN3 patch-notes tab** — `GET /lol/patches/26.10/changes` returns the entire patch partitioned into `champions / items / runes`, sorted by play count client-side.

Both queries hit the same `PatchChange` table with `patchVersion + section` indexed. No view, no materialization, no separate cache. The "current patch" query uses `orderBy: [{ patchDate: { sort: "desc", nulls: "last" } }, { version: "desc" }]` so the tiebreaker is deterministic when patchDate is missing.

### Wiki image URLs are deterministic by name

PN7's `wikiEntryIconUrl(name, kind)` ([patch.service.ts:45-48](../../apps/api/src/lol/patch.service.ts#L45-L48)) takes an item or rune name, replaces spaces with `_`, percent-encodes apostrophes, and appends `_item.png` or `_rune.png`. No API call. The wiki keeps the image file path stable even after an entity is removed from the live game — `Phase_Rush_rune.png` still resolves long after Phase Rush was deprecated.

This matters more than it looks. A patch-notes table is *historical*: when V25.04 says "Phase Rush: removed," the UI is rendering a runestone that doesn't exist anymore. Any icon source that 404s on removed entities (CDragon does, on the `latest` channel) makes the historical view look broken.

## What didn't (surprises worth keeping in writing)

### ddragon's version major is still legacy-season-numbered

ddragon returns `"16.10.1"` in May 2026. Riot's internal version numbering is season-based (season 16 = 2026); the user-facing patch label and the wiki page slug are year-based (V26.10). Same +10 transform on both sides of the codebase ([patch.service.ts:460-469](../../apps/api/src/lol/patch.service.ts#L460-L469)):

```ts
const displayMajor = majorNum >= 20 ? majorNum : majorNum + 10;
```

The `>= 20` guard pre-empts a future Riot switch to year-based numbering — if the major is already year-shaped, pass through unchanged. Cheap insurance against a one-line breakage in three years.

### Wiki page titles zero-pad the minor

The storage version is `"26.9"` (unpadded), matching the web side's `truncatePatch()` and Riot's `gameVersion` format. But the wiki page is `V26.09` (zero-padded minor). One transform when constructing the URL ([patch.service.ts:473-478](../../apps/api/src/lol/patch.service.ts#L473-L478)), nowhere else. Storage stays canonical; the wiki convention is a URL detail.

### Ability slot mapping needs two sources

Riot's match data uses string IDs (`"MonkeyKing"`); the wiki's patch notes use display names (`"Wukong"`); the slot mapping (`"Crushing Blow"` → Q) lives in the wiki's `Module:ChampionData/data` Lua table.

The fetch is two parallel requests ([patch.service.ts:274-290](../../apps/api/src/lol/patch.service.ts#L274-L290)) — ddragon `champion.json` for the alias↔display lookup, wiki module for the slot map — joined in-memory:

```
ddragon champion.json     →  MonkeyKing ↔ Wukong (string id ↔ display name)
wiki Module:ChampionData  →  Crushing Blow → Q  (display name → slot)
```

CDragon ability icons are keyed by string ID + slot letter (`/champion/MonkeyKing/ability-icon/q`), so both sources are load-bearing. The wiki module also lists every named variant of every ability — Karma's "Renewal" under `skill_w`, Lee Sin's "Iron Will" under `skill_w` — which means empowered/transformed forms slot correctly without per-champion heuristics.

### File embeds aren't change lines

Rune-section anchor lines lead with a wiki file embed:

```
;{{ri|Phase Rush}}
*[[File:Sorcery icon.png|...]] [[Sorcery]] Keystone rune.
**Cooldown reduced to 15s from 20s.
```

The `[[File:…]]` leading line is a category descriptor, not a game-change line. `isFileEmbedLine()` ([patch-parser.ts:165-167](../../apps/api/src/lol/patch-parser.ts#L165-L167)) skips them; without that guard, every rune in the table would have a phantom first "change" reading something like "Sorcery Keystone rune."

### Change-type classification only covers ~60% of lines

The classifier maps to one of five values: `buff`, `nerf`, `adjustment`, `new_effect`, `removed`, or null. About 40% of lines stay null — generally lines that describe complex behavioural rewrites where "increased / reduced" doesn't appear and there's no `{{sbc|…}}` tag.

This is acceptable, not a bug. The UI renders unclassified lines neutrally (no arrow icon); the classified ones get a `↑` / `↓` / `↺` glyph that lights up at a glance. False positives would be worse than misses — a mechanic rewrite labelled as a buff because it contains the word "increased" would be actively misleading. The classifier is conservative on purpose.

## Open questions

**Historical backfill.** The cron only sees patches from the moment it started running. Backfilling 14 years of patches would multiply the table size by ~300× and surface every wiki format shift along the way (the `{{ai|…}}` ability anchor was introduced around 2018; pre-2018 patches use a different template). Deferred until the patch-drift verdict UI proves valuable enough on a few months of data to justify the backfill complexity.

**Auto-rotation of empowered ability names.** When an ability gets renamed mid-season, the wiki module updates; the historical `PatchChange` rows still carry the old name. No plan to handle this — the historical change *did* refer to that name at the time. Worth noting in the UI if the prevalence ever justifies it.

**Wiki rate limits.** Two requests per patch (one wikitext fetch, one module fetch) every 6h is well below any conceivable threshold. The cron tick logs the version, so spike detection is trivial if the wiki ever pushes back. No retry/backoff logic shipped; not needed yet.

## Why this earns its place in the portfolio

- **Integration story without an API.** The interesting work in any LoL aggregator isn't calling Riot — it's the gaps Riot leaves. Patch notes is the cleanest example: no official feed, brittle HTML scrape if you go to Riot's site, structured-enough wikitext if you know where to look. The case for choosing the wiki is the case for any pipeline that picks structure-by-convention over structure-by-contract.
- **Parser discipline.** The whole pipeline is fewer than 500 LOC across `patch-parser.ts` + `patch.service.ts`. No parser library, no DOM toolkit, no LLM call. Just regex anchors against a known template, with the unknown-template fallback documented in code. It reads as boring on purpose.
- **Two surfaces, one parser.** A common shape in product engineering: the "tile" version (top-5 filter) and the "full slate" version (no filter, partitioned client-side) of the same data. One write path, one schema, two read endpoints, no view materialization. Worth pointing at when a frontend engineer asks why a project this size doesn't have a GraphQL layer.
- **Resilient by data choice, not by retry logic.** The strongest argument for the wiki isn't "it's free" — it's that wiki image URLs survive entity removal, the wikitext template convention has been stable for years, and re-syncing is one transaction. Resilience came from picking a source that's stable, not from wrapping a fragile source in retries.

## Connections

- [Riot API rate limiting](./riot-rate-limits.md) — the other half of the LoL data pipeline; pairs with this case study as "what we built around what Riot does and doesn't give us."
- [Runtime image proxy](./runtime-image-proxy.md) — the same "stable URLs as a design choice" thread; the proxy replaced a build-time CDN bundle once content cadence outgrew deploy cadence, the same pressure that drives the 6h patch cron.
- [Bundling the bounded CDN](./bundling-the-bounded-cdn.md) — the parallel decision on the asset side: when a third party publishes a stable surface, lean on the surface instead of paying for orchestration.
