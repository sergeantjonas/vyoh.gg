# vyoh.gg — Unified LoL image fallback

**Status:** Partial — proxy-routing landed 2026-05-21 across `36ac902` / `209cc45` / `6865f8e` / `644a74c` / `96a21cb`; `apps/web/src` has zero direct-to-wiki render URLs. But the deeper ambition is incomplete: most asset types still resolve from DDragon/CDragon, and most wiki-primary routes are single-upstream with no fallback chain. The owner-stated principle — *the image proxy should always route images, with the fallback chain as the failure-tolerance layer* — only holds for `champion(square)` and `profileIcon`.

## What shipped

Web call sites now route through `/img/lol/*` proxy routes; `apps/web/src` contains zero direct `wiki.leagueoflegends.com/en-us/images/` render URLs (the two grep matches are a comment and the canonical-wiki HTML test fixtures, not render paths). Helpers were relocated from `@vyoh/shared` into [`apps/api/src/img/wiki-url-helpers.ts`](../../../apps/api/src/img/wiki-url-helpers.ts), marking the boundary that they're server-internal URL builders.

Per-asset upstream + fallback state, read directly from [lol-image.service.ts](../../../apps/api/src/img/lol-image.service.ts):

| Asset | Primary | Fallback | Notes |
|---|---|---|---|
| `champion(square)` | wiki | CDragon | Real 2-stage chain. Lookup by `lolChampion.name` (alias→name map). |
| `profileIcon(iconId)` | wiki | DDragon | Real 2-stage chain. Lookup via `Module:IconData/data` sync. |
| `ability(...)` | wiki | **none** | Single-element `urls`. Wiki outage blanks tooltips. |
| `map(mapId)`, `rankEmblem(...)`, `uiIcon(...)`, `wikiFile(...)` | wiki | **none** | Single-element `urls`. No second upstream exists (DDragon doesn't ship these). Cache-only resilience. |
| `champion(card)`, `champion(backdrop)` | CDragon splash | **none** | Not wiki-sourced. CDragon splash art only. |
| `item(itemId)` | DDragon | **none** | Not wiki-sourced. DDragon item PNG only. |
| `rune(keystoneId)` | CDragon game-data | **none** | Not wiki-sourced. CDragon `iconPath` lookup. |
| `spell(spellKey)` | CDragon game-data | **none** | Not wiki-sourced. CDragon `iconPath` lookup. |

## What's left

### A — Items + runes onto wiki primary

The [wiki coverage matrix](./lol-image-pipeline.md#wiki-as-canonical-image-source-confirmed-direction-2026-05-17) confirms wiki carries `{Name_underscored}_item.png` and `{Name_underscored}_rune.png` for every item and rune. The proxy currently uses DDragon/CDragon as the sole upstream for both. Migration path: `LolItem` and `LolPerk` rows already carry `iconWikiName` (populated by `lol-static-sync.service.ts`); switch `item()` and `rune()` to return `[wikiItemUrl(name), ddragonItemUrl]` and `[wikiRuneUrl(name), cdragonRunePath]` respectively.

### B — Summoner spells: wiki coverage probe

Summoner spells aren't in the existing wiki-coverage matrix. Quick probe needed: does `https://wiki.leagueoflegends.com/en-us/images/{Name}_spell.png` (or similar pattern) work for the 18 summoner spells? If yes, mirror item/rune migration. If no, document why and leave `spell()` on CDragon.

### C — Champion card / backdrop: wiki coverage probe

Wiki has champion *splash* art (`{Name}_OriginalSplash.png` and per-skin variants), but our `card` and `backdrop` variants use CDragon's centered splash crops (`splash-art/centered`). Open question: is the centered crop available on wiki, or only the full splash? If only the full splash, can the proxy do the centering crop server-side via Sharp instead of relying on CDragon's pre-cropped variant?

### D — Wire fallbacks where a second upstream exists

The note I'd written claimed `ability()` returns `[wikiUrl, cdragonAbilityUrl]` — actual code has a single-element array. CDragon does serve `/champion/{slug}/abilities/{slot}` so the fallback is buildable. Same pattern applies to whatever items/runes/spells settle into after A/B.

`map`, `rankEmblem`, `uiIcon`, `wikiFile` genuinely have no second upstream — these stay single-element. Document that explicitly in the resolver comments so future readers don't add a phantom fallback.

## How to extend

If a new wiki-sourced asset type appears: add the proxy route in [`apps/api/src/img/img.controller.ts`](../../../apps/api/src/img/img.controller.ts), resolver method in [`lol-image.service.ts`](../../../apps/api/src/img/lol-image.service.ts) returning `urls: [wikiUrl, …fallbacks]`, and the corresponding `*Url()` helper in [`apps/web/src/lol/_shared/assets/champion-icon.ts`](../../../apps/web/src/lol/_shared/assets/champion-icon.ts) that resolves to the proxy URL.

For id→wiki-name lookups (the pattern profile-icon and champion-square use): cache the map lazy + sticky on the service instance, mirror `loadProfileIconTitles()` / `loadChampionDisplayNames()`.

## Related

- [[lol-static-metadata-arc]] — the static-metadata pipeline that owns the `LolItem.iconWikiName` / `LolPerk.iconWikiName` columns needed for chunk A.
- [rich-descriptions.md](./rich-descriptions.md) — inlines wiki `<img>` tags inside tooltip HTML, all of which route through `/img/lol/wiki-file/:filename.webp` via the same proxy.
