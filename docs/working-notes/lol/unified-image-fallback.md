# vyoh.gg — Unified LoL image fallback

**Status:** Shipped — proxy-routing landed 2026-05-21 (`36ac902` / `209cc45` / `6865f8e` / `644a74c` / `96a21cb`). Chunk A landed 2026-05-21 (`58309f5`): items + runes wiki-primary with DDragon/CDragon fallback. Chunk D landed 2026-05-21: ability has CDragon fallback; map/rankEmblem/uiIcon/wikiFile single-upstream documented. Chunk B landed 2026-05-23 (`6ce40f8`): summoner spells wiki-primary with CDragon fallback (14/16 coverage). Chunk C landed 2026-05-23 (`849839a`): champion card/backdrop wiki-primary with CDragon fallback. Chunk E landed 2026-05-23 (`4485fc1`): role-position icons wiki-primary with CDragon fallback. Chunk F landed 2026-05-23: map + rankEmblem + uiIcon(gold/minion/attack) gained CDragon fallbacks sourced from the pre-wiki git history; transcode layer grew an `extractTopHalf` param so the minion 1:2 sprite renders as a single icon. Only `uiIcon("ward")` and `wikiFile` remain single-upstream by design.

## What shipped

Web call sites now route through `/img/lol/*` proxy routes; `apps/web/src` contains zero direct `wiki.leagueoflegends.com/en-us/images/` render URLs (the two grep matches are a comment and the canonical-wiki HTML test fixtures, not render paths). Helpers were relocated from `@vyoh/shared` into [`apps/api/src/img/wiki-url-helpers.ts`](../../../apps/api/src/img/wiki-url-helpers.ts), marking the boundary that they're server-internal URL builders.

Per-asset upstream + fallback state, read directly from [lol-image.service.ts](../../../apps/api/src/img/lol-image.service.ts):

| Asset | Primary | Fallback | Notes |
|---|---|---|---|
| `champion(square)` | wiki | CDragon | Real 2-stage chain. Lookup by `lolChampion.name` (alias→name map). |
| `profileIcon(iconId)` | wiki | DDragon | Real 2-stage chain. Lookup via `Module:IconData/data` sync. |
| `ability(...)` | wiki | CDragon | Real 2-stage chain (chunk D). CDragon `/champion/{slug}/ability-icon/{slot}` as fallback. |
| `map(mapId)` | wiki `{MapName}_Minimap.png` | CDragon `game/assets/maps/info/map{N}/{filename}.png` | Real 2-stage chain (chunk F). Per-map filename: SR uses `2dlevelminimap_npe_1.png`, HA uses bare `2dlevelminimap.png`. |
| `rankEmblem(...)` | wiki `Season_{year}_-_{Tier}.png` | CDragon `ranked-emblem/emblem-{tier}.png` | Real 2-stage chain (chunk F). Same CDragon path covers all 10 tiers including Emerald. |
| `uiIcon("gold" \| "minion" \| "attack")` | wiki | CDragon (per-icon path, see resolver) | Real 2-stage chain (chunk F). Minion sprite is a vertical 1:2 — Sharp `extractTopHalf` clips the bottom half before resize. |
| `uiIcon("ward")` | wiki `Ward_icon.png` | **none** | Single-upstream intentionally — original implementation was a hand-rolled SVG (game-icons.net CC BY 3.0), no CDragon image equivalent. |
| `wikiFile(...)` | wiki | **none** | Single-upstream intentionally — generic wiki-file passthrough for inline tooltip icons; wiki-only by definition. |
| `champion(card)`, `champion(backdrop)` | wiki `OriginalCentered.jpg` | CDragon `/splash-art/centered` | Real 2-stage chain (chunk C). Wiki ships Riot's pre-cropped 1280×720 centered art — same source bytes as CDragon for the spot-checked champions. Lookup reuses `loadChampionDisplayNames()`. |
| `role(positionSlug)` | wiki `{Title}_icon.png` (136×136) | CDragon `position-{slug}.svg` | Real 2-stage chain (chunk E). Route changed from `.svg` pass-through to `.webp` via `proxyWebp`; slug→title shim maps `utility` → `Support`. Same Riot icon design across both upstreams. |
| `item(itemId)` | wiki | DDragon | Real 2-stage chain (chunk A, `58309f5`). Lookup via `LolItem.iconWikiName`; falls through to DDragon alone when the row is missing. |
| `rune(keystoneId)` | wiki | CDragon game-data | Real 2-stage chain (chunk A, `58309f5`). Lookup via `LolPerk.iconWikiName`; existing CDragon `iconPath` lookup retained as the second-stage fallback. |
| `spell(spellKey)` | wiki | CDragon game-data | Real 2-stage chain (chunk B). Lookup via `LolSummonerSpell.iconWikiName` (mirrors DDragon `name`). Bare-name `{Name}.png` shape — no `_spell` suffix. Arena `Flee` + UltBook `Placeholder` 404 on wiki and rely on the fallback. |

## What's left

### A — Items + runes onto wiki primary (shipped 2026-05-21)

Landed as `58309f5`. `LolItem.iconWikiName` and `LolPerk.iconWikiName` (populated by the static-sync service, mirror the row's `name`) drive `wikiEntryIconUrl(name, "item" | "rune")`; cold-start before the first sync lands cleanly on DDragon (items) / CDragon `iconPath` (runes). Lookup maps are lazy + sticky on the service instance, mirroring `loadProfileIconTitles` — one Prisma round-trip per process lifetime. Tests cover wiki-primary, missing-row fallback, apostrophe-escape (Luden's Echo case), and memoization.

### B — Summoner spells: wiki-primary with CDragon fallback (shipped 2026-05-23)

Probe on 2026-05-23: the hypothesised `{Name}_spell.png` pattern returned 404 for all 16 DDragon-listed summoner spells. The actual wiki convention is bare `{Name}.png` (verified by parsing the wiki Flash page), which resolves for 14/16: Flash, Ignite, Heal, Teleport, Smite, Cleanse, Exhaust, Ghost, Barrier, Clarity, Mark, Poro Toss, To the King!, "Placeholder and Attack-Smite". The two 404s — Arena's `Flee` (Cherry-mode `SummonerCherryHold`) and UltBook's bare `Placeholder` — fall through to the CDragon `iconPath` lookup.

Added `wikiSummonerSpellIconUrl(name)` in `wiki-url-helpers.ts` (bare-name shape, distinct from `wikiEntryIconUrl`'s `_{kind}` suffix). `LolImageService.spell()` now mirrors the rune pattern: `loadSpellIconNames()` is sticky+lazy, one Prisma round-trip per process lifetime; missing rows fall through cleanly. Tests cover wiki-primary, multi-word slugging ("To the King!"), missing-row fallback, and memoization.

### C — Champion card / backdrop: wiki-primary with CDragon fallback (shipped 2026-05-23)

**First probe (rejected):** `{Name}_OriginalSplash.png` returned 404 across the roster; the wiki Aatrox cosmetics page revealed the actual full-splash filename is `{Name}_OriginalSkin.jpg` (1215×717 — byte-identical to CDragon's full `/splash-art`). Naive centering on the full splash would mis-frame off-centre champions, so this dead-ended.

**Second probe (correct):** `Category:Champion_centered_skins` on wiki indexes pre-cropped 1280×720 centered art as `{Name}_OriginalCentered.jpg`. Spot-checked across `Aatrox`, `Ahri`, `Jarvan_IV`, `Aurelion_Sol`, `Bel%27Veth`, `K%27Sante`, `Wukong`, `Yasuo`, `Renata_Glasc`, `Nunu` — all 200. Aatrox + Ahri wiki bytes are MD5-identical to CDragon's `/centered` (same Riot source upload); Yasuo's hash differs but dimensions and framing are unchanged (likely a JPEG re-encoding). Splash visual-parity holds.

Nunu & Willump uses the same bare `Nunu_` prefix as ability and square (`Nunu_OriginalCentered.jpg`, `Nunu_OriginalSquare.png`). Extracted the existing ability-icon Nunu shim into `wikiChampionPrefix()` and applied it to `wikiChampionSquareUrl()` + the new `wikiChampionCenteredUrl()` — the square previously fell through to CDragon for Nunu silently (one 404 round-trip per request), now it serves wiki-primary cleanly.

`LolImageService.champion(alias, "card" | "backdrop")` now resolves to `[wikiChampionCenteredUrl(displayName), cdragonCentered]`, reusing the sticky `loadChampionDisplayNames()` cache that the `square` variant already built. Cold-start before the first sync lands on CDragon alone, matching the square pattern.

### D — Wire fallbacks where a second upstream exists (shipped 2026-05-21)

`ability()` now returns `[wikiUrl, cdragonAbilityUrl]`. CDragon serves `/champion/{slug}/ability-icon/{slot}` (lowercase slot, normalised alias). Slot "Passive" lowercases to "passive"; compound aliases like "JarvanIV" lowercase directly. The Prisma include was updated to also select `alias` so the slug can be built without an extra lookup.

`map`, `rankEmblem`, `uiIcon`, `wikiFile` have no second upstream — intentionally single-element. Each resolver now carries an explicit "Single-upstream intentionally" comment so future readers don't add phantom fallbacks.

## How to extend

If a new wiki-sourced asset type appears: add the proxy route in [`apps/api/src/img/img.controller.ts`](../../../apps/api/src/img/img.controller.ts), resolver method in [`lol-image.service.ts`](../../../apps/api/src/img/lol-image.service.ts) returning `urls: [wikiUrl, …fallbacks]`, and the corresponding `*Url()` helper in [`apps/web/src/lol/_shared/assets/champion-icon.ts`](../../../apps/web/src/lol/_shared/assets/champion-icon.ts) that resolves to the proxy URL.

For id→wiki-name lookups (the pattern profile-icon and champion-square use): cache the map lazy + sticky on the service instance, mirror `loadProfileIconTitles()` / `loadChampionDisplayNames()`.

## Related

- [[lol-static-metadata-arc]] — the static-metadata pipeline that owns the `LolItem.iconWikiName` / `LolPerk.iconWikiName` columns needed for chunk A.
- [rich-descriptions.md](./rich-descriptions.md) — inlines wiki `<img>` tags inside tooltip HTML, all of which route through `/img/lol/wiki-file/:filename.webp` via the same proxy.
