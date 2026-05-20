# vyoh.gg — LoL static-metadata pipeline (post-wiki-image-migration)

**Status:** Plan locked, not yet started. Direct successor to the wiki-image migration arc (commits `c055052`, `0dcaf82`, `c4af090`). Profile-icon resolver (Chunk 6) stays deferred until 4 + 5 land.

Working plan for replacing the five remaining client-side DDragon/CDragon JSON fetches with a server-side static-metadata pipeline sourced primarily from the wiki, with DDragon retained narrowly as the id↔name bridge for resources that wiki doesn't self-identify.

Read this when working on: `apps/api/src/lol/patch.service.ts`, any new `lol-static-sync.service.ts`, the Prisma schema for static catalog tables, or any web-side migration of `useItems` / `useChampionSpells` / `useChampions` / `useSummonerSpells` / `usePerks` / `useDDragonVersion`.

---

## Why this arc exists

After the image migration (Chunks 1–3) and icon unification commit, image URLs in `apps/web` are entirely wiki-sourced. What remains are five client-side JSON fetches that pull metadata bundles from raw CDragon endpoints:

- [use-items.ts](../../../apps/web/src/lol/matches/use-items.ts) — items.json (~250KB)
- [use-champion-spells.ts](../../../apps/web/src/lol/matches/use-champion-spells.ts) — champion-summary.json + per-champion JSON
- [use-champions.ts](../../../apps/web/src/lol/champions/use-champions.ts) — champion-summary.json (alias→name+roles)
- [use-summoner-spells.ts](../../../apps/web/src/lol/_shared/analytics/use-summoner-spells.ts) — summoner-spells.json
- [use-perks.ts](../../../apps/web/src/lol/_shared/analytics/use-perks.ts) — perks.json

Each fetch builds a small id→{name, iconUrl, description?} map on the client. After this arc lands, all of that is served from `apps/api` as a single bundled `/lol/static` endpoint, sourced from wiki + DDragon-as-bridge.

Portfolio framing: "I own the data pipeline" — drift-tolerant two-source sync, self-healing, zero external runtime deps in the web app.

---

## Architectural decisions

### Wiki is the content source; DDragon is the bridge

Wiki has every description, image, stat, recipe, ability mapping, and rune effect we need — verified by probing `Module:ItemData/data` (per-item Lua module with `["id"] = 3078` self-identifying), `Module:ChampionData/data` (already parsed in [patch.service.ts](../../../apps/api/src/lol/patch.service.ts)), `Module:SpellData/data` (summoner spells), and `Template:Rune data {Name}` (per-rune pages with `path`/`slot`/`description`).

DDragon's role narrows to one thing wiki cannot do: **translate Riot's numeric ids to canonical names for resources that wiki doesn't self-identify** — namely summoner spells and runes. Wiki templates for runes carry name + description but never a Riot `perkId`; wiki summoner spell module keys by name only. Without DDragon we couldn't detect rune churn like "Phase Rush retired, perkId reassigned to Stormraider's Surge."

Items + champions + abilities self-identify on wiki (items have `["id"]` in their module, Match-V5 carries both `championId` and `championName`, abilities derive from champion + slot), so they need no DDragon involvement.

### Drift-tolerant two-source sync

Wiki is volunteer-edited and lags Riot's official drops by 0–48h for new content, sometimes days for balance-tweak description rewrites. Pretending the two sources march in lockstep would corrupt the API. Instead:

- **DDragon sync** runs on patch detection (existing 6h cron in [patch.service.ts](../../../apps/api/src/lol/patch.service.ts)). Updates the id↔name bridge fast lane.
- **Wiki content sync** runs on **every** cron tick regardless of patch detection — picks up volunteer edits and catches up on lagged new entries.
- Each row carries `ddragonSyncedAt` + `wikiSyncedAt` + `wikiSyncedPatchVersion` for transparency.
- A row can exist with DDragon data but `description: null` until wiki catches up. API never lies about freshness.
- Sync is **idempotent and additive** — `action=parse` failures keep last-known-good HTML; we never blow it away on transient errors.

### Hardcoding is prohibited

No hardcoded `id→name` maps anywhere. Rune/summoner-spell churn (Phase Rush retirement is the canonical example) silently breaks hardcoded lists. The bridge lives in DB, refreshed automatically by every patch sync. Manual PRs are not part of the contract.

### Description rendering

Wiki descriptions are stored as wiki template markup (e.g. `{{as|200% '''base''' AD}}`). To render as HTML in tooltips we use MediaWiki's `action=parse&text=...&contentmodel=wikitext` to expand templates → store rendered HTML alongside raw wikitext. One `action=parse` call per item/rune/spell per patch sync. Web renders the HTML directly via the existing `dangerouslySetInnerHTML` pattern.

If MediaWiki API returns an error or empty HTML for a description: keep last-known-good cached HTML, log the failure, retry next cycle. Never destructive.

---

## Chunk plan

Each chunk is independently committable. Run `tokf err pnpm run verify:cc` before each commit. Owner handles pushes.

### Chunk 4a — Static metadata sync (api-only)

**Files in scope:**
- New: `apps/api/src/lol/lol-static-sync.service.ts` (split from `patch.service.ts` to keep it under ~300 lines)
- New: `apps/api/src/lol/lol-static-sync.service.spec.ts`
- New: `apps/api/prisma/schema.prisma` additions — `LolItem`, `LolChampion`, `LolChampionAbility`, `LolSummonerSpell`, `LolPerk`
- New: Prisma migration
- Modify: `apps/api/src/lol/patch.service.ts` — invoke static sync after patch detection
- Modify: `apps/api/src/lol/lol.module.ts` — register new service + cron tick

**Service behavior:**
1. `syncDDragonBridge()` — fetch `summoner.json` + `runesReforged.json`, upsert `LolSummonerSpell` + `LolPerk` rows. Touches `ddragonSyncedAt`.
2. `syncWikiContent()` — for each existing row, fetch the matching wiki module/template, parse Lua/wikitext, `action=parse` the description, upsert content fields. Touches `wikiSyncedAt` + `wikiSyncedPatchVersion`.
3. `syncItems()` — fetch `Module:ItemData/data`, parse Lua, upsert `LolItem`. Wiki self-identifies item ids so no DDragon needed.
4. `syncChampionsAndAbilities()` — factor out the existing `fetchChampionAbilityData` logic in [patch.service.ts](../../../apps/api/src/lol/patch.service.ts) and persist results into `LolChampion` + `LolChampionAbility` rather than keeping them transient.
5. Two cron entry points:
   - `@Cron("0 */6 * * *")` (matches existing patch cron) — call patch detection THEN `syncDDragonBridge()` THEN `syncWikiContent()`.
   - The same wiki content sync also fires on every cron regardless of patch detection (covers wiki lag/correction edits).
6. Each per-resource sync wraps fetch + parse + upsert in try/catch — one item failure does not abort the rest.

**Schema sketch:**

```prisma
model LolPerk {
  id                 Int      @id              // Riot perkId
  name               String                    // From DDragon
  path               String?                   // "Precision" etc., from wiki
  slot               String?                   // "Keystone" / "Slot1" etc.
  descriptionWikitext String?
  descriptionHtml    String?
  ddragonSyncedAt    DateTime
  wikiSyncedAt       DateTime?
  wikiSyncedPatchVersion String?
  retiredAt          DateTime?                 // Set when id vanishes from DDragon
}

model LolSummonerSpell {
  id                 Int      @id              // Riot summoner-spell id
  name               String
  descriptionWikitext String?
  descriptionHtml    String?
  // ... same sync-state columns
}

model LolItem {
  id                 Int      @id              // From wiki module, matches Riot
  name               String
  priceTotal         Int?
  recipe             Json     @default("[]")   // Array of ingredient item ids OR names (decide during impl)
  categories         Json     @default("[]")   // String[]
  stats              Json     @default("{}")   // Record<string, number>
  descriptionWikitext String?
  descriptionHtml    String?
  wikiSyncedAt       DateTime
  wikiSyncedPatchVersion String?
}

model LolChampion {
  id                 Int      @id              // Riot championId
  alias              String   @unique          // "MonkeyKing"
  name               String                    // "Wukong"
  roles              Json     @default("[]")
  wikiSyncedAt       DateTime
  wikiSyncedPatchVersion String?
}

model LolChampionAbility {
  championId         Int
  slot               String                    // "Passive" | "Q" | "W" | "E" | "R"
  name               String
  descriptionWikitext String?
  descriptionHtml    String?
  iconWikiName       String?                   // For wiki ability icon URL construction (Chunk 5)
  // PK: (championId, slot)
}
```

**Open questions to resolve during impl:**
- Does `Module:ItemData/data` (the bulk 410KB module) contain everything, or do we have to fetch per-item submodules like `Module:ItemData/data/Trinity Force`? Bulk is preferred for one HTTP request.
- For the `recipe` field, should ingredients be stored as wiki names (matches wiki source) or as Riot item ids (matches what we'd render against)? Likely names — resolved to ids on the read side.
- Drift detection: if a previously-known perkId vanishes from DDragon, set `retiredAt` but keep the row (historical match data still references it). Decide whether `/lol/static` filters retired rows or includes them.

**Tests:**
- Per-resource sync: mock DDragon + MediaWiki API responses, assert upserts.
- Failure isolation: one parse error doesn't abort the batch.
- Drift detection: simulate Phase Rush retirement, assert `retiredAt` is set.
- Idempotency: rerun against the same payload, no diff.

### Chunk 4b — Read endpoints + shared types

**Files in scope:**
- New: `packages/shared/src/lol/static.ts` — DTOs (`LolItem`, `LolChampion`, `LolChampionAbility`, `LolSummonerSpell`, `LolPerk`, `LolStaticBundle`)
- Modify: `packages/shared/src/index.ts` — re-export
- New: `apps/api/src/lol/lol-static.controller.ts`
- New: `apps/api/src/lol/lol-static.controller.spec.ts`
- Modify: `apps/api/src/lol/lol.module.ts` — register controller

**Endpoint:**
Single bundle endpoint `GET /lol/static` returning everything:
```ts
{
  champions: LolChampion[];
  championAbilities: Record<number, LolChampionAbility[]>;  // championId → 5 abilities
  items: LolItem[];
  summonerSpells: LolSummonerSpell[];
  perks: LolPerk[];
  syncedAt: string;       // The latest of any resource's wikiSyncedAt
  patchVersion: string;   // Current synced patch
}
```

The bundle is small (~50–80KB JSON, sub-30KB gzipped). One HTTP request on app boot, TanStack Query caches with `staleTime: Infinity`, web derives all maps from it.

If granular endpoints are needed later (e.g. mobile clients pulling only items) they get added in a later chunk — start with the bundle.

**Tests:**
- Returns 200 with all five collections populated.
- Includes rows where `descriptionHtml` is null (drift case).
- Filters retired perks (or doesn't — decision flagged in 4a) consistently.

### Chunk 4c — Web migration

**Files in scope:**
- New: `apps/web/src/lol/_shared/static/use-lol-static.ts` — fetches the bundle, exposes typed selectors
- Modify (or replace): five hooks listed at top
- Delete: `apps/web/src/lol/_shared/patch/use-ddragon-version.ts` if no remaining consumer (verify before deletion)
- Update: All `useItems` / `useChampionSpells` / `useChampions` / `useSummonerSpells` / `usePerks` consumers — should be drop-in if the hook signatures stay stable

**Behavior:**
- `useLolStatic()` returns the full bundle once on app boot.
- Existing hook shapes preserved at the public surface — `useItems()` still returns `useQueryResult<Map<number, Item>>`, just sourced from the bundle.
- Test fixtures get a `mockLolStatic()` helper to seed tests that previously stubbed the CDragon fetches.

**Tests:**
- Per-hook: assert same map shape as before, sourced from API bundle.
- Component tests that previously mocked CDragon fetches now mock the static bundle.

### Chunk 5 — Ability icons + last wiki swaps

**Files in scope:**
- Modify: `apps/web/src/lol/matches/use-champion-spells.ts` (or its successor in 4c) — replace `spellIconUrl()` CDragon path with `wikiAbilityIconUrl(championName, abilityName)` from `@vyoh/shared`
- Verify: no remaining `raw.communitydragon.org` or `cdn.communitydragon.org` strings in `apps/web/src/**` (other than profile-icon, Chunk 6).

The slot→ability-name mapping arrives in 4b via `LolChampionAbility.iconWikiName`, so `wikiAbilityIconUrl()` finally has the data it needs.

After this chunk, only profile icons remain CDragon-sourced.

### Chunk 6 (deferred, separable arc)

Profile-icon resolver. Per [lol-image-pipeline.md](./lol-image-pipeline.md) the wiki hosts profile icons but with editorial filenames that don't transform cleanly from CDragon's `title` field. Needs a one-time MediaWiki sync that walks Riot's `summoner-icons.json` and queries MediaWiki for the canonical filename per icon id, persists `iconId → wikiSlug` in DB. Same shape as items/runes sync but with a different parsing strategy.

Sequence: do not start until 4 + 5 ship. Profile-icon work is independently valuable but doesn't gate Chunk 4's portfolio narrative.

---

## Sequence + handoff between chunks

1. **Before 4a:** confirm bulk `Module:ItemData/data` is parseable in one shot vs. requiring per-item submodule fetches. If per-item, sync becomes ~270 fetches per patch — still fine on a 6h cron but worth measuring.
2. **After 4a, before 4b:** run the sync once manually against the dev DB, eyeball a few rows to confirm Lua parsing produced sane output, descriptions rendered, drift detection fired on a synthetic case.
3. **After 4b, before 4c:** hit `/lol/static` in dev, eyeball the JSON shape, confirm payload size + gzip cost are within target.
4. **After 4c, before 5:** spot-check the app in browser — match detail tooltips, build flows, command palette champion search, live game roles — all should render unchanged.
5. **Chunk 5:** swap ability icons last so any wiki name mismatches are surfaced after the surrounding pipeline is proven.

Each chunk-boundary should produce one commit. `/compact` between 4b and 4c if mid-arc context is large.

---

## Risks + things to watch

- **MediaWiki `action=parse` rate limits.** Wiki has no published quota but recommends "no faster than 200/min" for sustained traffic. Per patch sync we do ~270 items + ~80 perks + ~16 spells + ~170 champions = ~535 calls. Comfortably under 200/min if we serialize. Add a small delay between calls if testing surfaces 429s.
- **Lua parser robustness.** `Module:ItemData/data` is hand-edited Lua. Our existing parser in [patch.service.ts](../../../apps/api/src/lol/patch.service.ts) handles `Module:ChampionData/data` which has a stricter structure. Expect some per-item edge cases (e.g. nested `effects` tables, conditional fields). Treat parse failures per-item and log loudly.
- **Drift detection false positives.** A perkId can briefly disappear from DDragon between Riot ship + CDN propagation. Don't mark `retiredAt` on the first miss — require N consecutive sync cycles of absence (e.g. 4 cycles = 24h).
- **Initial sync cost.** First-ever sync touches everything. Run it once manually via a `pnpm run lol:static-sync` script (similar to existing `prisma/run-patch-sync.ts`) before the cron takes over. Document the script in `prisma/README.md` if one exists.
- **Wiki disambiguation pages.** Some champion+ability names collide with item names ("Spellbreaker", "Bloodthirster" etc.). Wiki resolves via context but our parser must not confuse the two.
- **Riot might publish a new resource type.** Augments (Arena), curses (URF), Mayhem prismatics already have wiki modules. Don't try to cover them in 4a — explicit scope is items / champions / summoner spells / runes only. New types ship in follow-up chunks.

---

## Out of scope

- Removing the existing CDragon JSON fetches from `apps/web` before 4c lands (they keep working until then; 4c is the swap).
- Profile-icon resolver (Chunk 6).
- TFT static data (separate arc when TFT integration starts).
- Any UI redesign of tooltips / build flows. The pipeline change should be invisible to users.
- Replacing the wiki helpers in `@vyoh/shared` with API-sourced URLs. Image URLs stay constructable client-side; only the *name resolution* moves server-side.

---

## Done criteria

- All five client-side CDragon JSON fetches in `apps/web` are deleted.
- `useDDragonVersion()` is deleted (or its single remaining caller is documented).
- `apps/web/src/**` contains zero `raw.communitydragon.org` or `cdn.communitydragon.org` strings other than the profile-icon site.
- `/lol/static` endpoint returns a populated bundle in <100ms cached, <1s cold.
- Patch sync correctly handles a simulated Phase Rush → Stormraider's Surge churn — old row gets `retiredAt`, new row gets created with name + (eventually) wiki description.
- Match detail tooltips render with the same content fidelity as today; if a description hasn't synced yet, the tooltip renders gracefully without the body section.
