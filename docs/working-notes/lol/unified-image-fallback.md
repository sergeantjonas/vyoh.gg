# vyoh.gg — Unified LoL image fallback

**Status:** In progress — proxy-routing landed 2026-05-21 (`36ac902` / `209cc45` / `6865f8e` / `644a74c` / `96a21cb`). Chunk A landed 2026-05-21 (`58309f5`): items + runes are now wiki-primary with DDragon/CDragon fallback. Chunk D landed 2026-05-21: ability now has CDragon fallback; map/rankEmblem/uiIcon/wikiFile single-upstream documented in code. Chunk B landed 2026-05-23: summoner spells are now wiki-primary with CDragon fallback (14/16 wiki coverage; Arena `Flee` + UltBook `Placeholder` fall through). Chunk C (champion card/backdrop probe, gated by [splash visual-parity](#c--champion-card--backdrop-wiki-coverage-probe)) remains.

## What shipped

Web call sites now route through `/img/lol/*` proxy routes; `apps/web/src` contains zero direct `wiki.leagueoflegends.com/en-us/images/` render URLs (the two grep matches are a comment and the canonical-wiki HTML test fixtures, not render paths). Helpers were relocated from `@vyoh/shared` into [`apps/api/src/img/wiki-url-helpers.ts`](../../../apps/api/src/img/wiki-url-helpers.ts), marking the boundary that they're server-internal URL builders.

Per-asset upstream + fallback state, read directly from [lol-image.service.ts](../../../apps/api/src/img/lol-image.service.ts):

| Asset | Primary | Fallback | Notes |
|---|---|---|---|
| `champion(square)` | wiki | CDragon | Real 2-stage chain. Lookup by `lolChampion.name` (alias→name map). |
| `profileIcon(iconId)` | wiki | DDragon | Real 2-stage chain. Lookup via `Module:IconData/data` sync. |
| `ability(...)` | wiki | CDragon | Real 2-stage chain (chunk D). CDragon `/champion/{slug}/ability-icon/{slot}` as fallback. |
| `map(mapId)`, `rankEmblem(...)`, `uiIcon(...)`, `wikiFile(...)` | wiki | **none** | Intentionally single-upstream — DDragon/CDragon do not ship these assets. Documented in resolver comments (chunk D). |
| `champion(card)`, `champion(backdrop)` | CDragon splash | **none** | Not wiki-sourced. CDragon splash art only. |
| `item(itemId)` | wiki | DDragon | Real 2-stage chain (chunk A, `58309f5`). Lookup via `LolItem.iconWikiName`; falls through to DDragon alone when the row is missing. |
| `rune(keystoneId)` | wiki | CDragon game-data | Real 2-stage chain (chunk A, `58309f5`). Lookup via `LolPerk.iconWikiName`; existing CDragon `iconPath` lookup retained as the second-stage fallback. |
| `spell(spellKey)` | wiki | CDragon game-data | Real 2-stage chain (chunk B). Lookup via `LolSummonerSpell.iconWikiName` (mirrors DDragon `name`). Bare-name `{Name}.png` shape — no `_spell` suffix. Arena `Flee` + UltBook `Placeholder` 404 on wiki and rely on the fallback. |

## What's left

### A — Items + runes onto wiki primary (shipped 2026-05-21)

Landed as `58309f5`. `LolItem.iconWikiName` and `LolPerk.iconWikiName` (populated by the static-sync service, mirror the row's `name`) drive `wikiEntryIconUrl(name, "item" | "rune")`; cold-start before the first sync lands cleanly on DDragon (items) / CDragon `iconPath` (runes). Lookup maps are lazy + sticky on the service instance, mirroring `loadProfileIconTitles` — one Prisma round-trip per process lifetime. Tests cover wiki-primary, missing-row fallback, apostrophe-escape (Luden's Echo case), and memoization.

### B — Summoner spells: wiki-primary with CDragon fallback (shipped 2026-05-23)

Probe on 2026-05-23: the hypothesised `{Name}_spell.png` pattern returned 404 for all 16 DDragon-listed summoner spells. The actual wiki convention is bare `{Name}.png` (verified by parsing the wiki Flash page), which resolves for 14/16: Flash, Ignite, Heal, Teleport, Smite, Cleanse, Exhaust, Ghost, Barrier, Clarity, Mark, Poro Toss, To the King!, "Placeholder and Attack-Smite". The two 404s — Arena's `Flee` (Cherry-mode `SummonerCherryHold`) and UltBook's bare `Placeholder` — fall through to the CDragon `iconPath` lookup.

Added `wikiSummonerSpellIconUrl(name)` in `wiki-url-helpers.ts` (bare-name shape, distinct from `wikiEntryIconUrl`'s `_{kind}` suffix). `LolImageService.spell()` now mirrors the rune pattern: `loadSpellIconNames()` is sticky+lazy, one Prisma round-trip per process lifetime; missing rows fall through cleanly. Tests cover wiki-primary, multi-word slugging ("To the King!"), missing-row fallback, and memoization.

### C — Champion card / backdrop: wiki coverage probe

Wiki has champion *splash* art (`{Name}_OriginalSplash.png` and per-skin variants), but our `card` and `backdrop` variants use CDragon's centered splash crops (`splash-art/centered`). Open question: is the centered crop available on wiki, or only the full splash? If only the full splash, can the proxy do the centering crop server-side via Sharp instead of relying on CDragon's pre-cropped variant?

**Hard constraint:** the current visual must be preserved exactly — champion cards, splash backdrops, and the `card-splash-breathe` hover animation all read against CDragon's centered crop framing today. Any wiki-primary swap on chunk C must pass a side-by-side visual check on a representative roster (multi-champion cards page, profile splash backdrop, recap hero) before it ships. If wiki crops differ even subtly, do the crop server-side via Sharp on the wiki source rather than landing visual drift. No "close enough" allowed for splash art — this is the section's load-bearing aesthetic surface.

### D — Wire fallbacks where a second upstream exists (shipped 2026-05-21)

`ability()` now returns `[wikiUrl, cdragonAbilityUrl]`. CDragon serves `/champion/{slug}/ability-icon/{slot}` (lowercase slot, normalised alias). Slot "Passive" lowercases to "passive"; compound aliases like "JarvanIV" lowercase directly. The Prisma include was updated to also select `alias` so the slug can be built without an extra lookup.

`map`, `rankEmblem`, `uiIcon`, `wikiFile` have no second upstream — intentionally single-element. Each resolver now carries an explicit "Single-upstream intentionally" comment so future readers don't add phantom fallbacks.

## How to extend

If a new wiki-sourced asset type appears: add the proxy route in [`apps/api/src/img/img.controller.ts`](../../../apps/api/src/img/img.controller.ts), resolver method in [`lol-image.service.ts`](../../../apps/api/src/img/lol-image.service.ts) returning `urls: [wikiUrl, …fallbacks]`, and the corresponding `*Url()` helper in [`apps/web/src/lol/_shared/assets/champion-icon.ts`](../../../apps/web/src/lol/_shared/assets/champion-icon.ts) that resolves to the proxy URL.

For id→wiki-name lookups (the pattern profile-icon and champion-square use): cache the map lazy + sticky on the service instance, mirror `loadProfileIconTitles()` / `loadChampionDisplayNames()`.

## Related

- [[lol-static-metadata-arc]] — the static-metadata pipeline that owns the `LolItem.iconWikiName` / `LolPerk.iconWikiName` columns needed for chunk A.
- [rich-descriptions.md](./rich-descriptions.md) — inlines wiki `<img>` tags inside tooltip HTML, all of which route through `/img/lol/wiki-file/:filename.webp` via the same proxy.
