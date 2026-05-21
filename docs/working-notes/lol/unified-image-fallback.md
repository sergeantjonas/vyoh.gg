# vyoh.gg — Unified LoL image fallback

**Status:** Shipped 2026-05-21 across four chunks landed on the same day as the static-metadata Chunk 6.5 prototype. All LoL images in `apps/web/src` now route through `/img/lol/*`; the proxy decides upstream priority and absorbs failures. Owner-stated principle realised: *the image proxy should always route images, with the fallback chain as the failure-tolerance layer.*

## What landed

| Commit | What |
| --- | --- |
| `36ac902` | Profile icons: proxy route gains wiki-primary + DDragon-fallback chain (Chunk 6.5 prototype that generalised). |
| `209cc45` | Ability icons: `/img/lol/ability/:championId/:slot/:abilityIndex/:patch.webp`, wiki-primary, CDragon `/champion/{slug}/abilities/{slot}` secondary. Bundle-derived `iconWikiName` per `(championId, slot, abilityIndex)` read from Prisma. |
| `6865f8e` | Champion squares: live-tab consumer flipped to the proxy route; `square` variant returns `[wikiUrl, cdragonUrl]`. |
| `644a74c` | Minimaps, rank emblems, gold/minion/ward/attack UI icons all routed through `/img/lol/map/...`, `/img/lol/rank/...`, `/img/lol/ui/...`. Cache-only fallback (no second upstream exists for these). |
| `96a21cb` | Relocated the `wiki*Url` helpers from `@vyoh/shared` into [`apps/api/src/img/wiki-url-helpers.ts`](../../../apps/api/src/img/wiki-url-helpers.ts) — the helpers are now server-internal, marking the architectural boundary that they're URL builders the proxy uses, not something web call sites reach for directly. |

Done-criteria check (all met):

- `apps/web/src/**` contains zero direct `wiki.leagueoflegends.com/en-us/images/` URLs. Two matches remain: a comment string in `lol/_shared/assets/champion-icon.ts:104` and the canonical-wiki HTML fixtures in `rich-description.snapshots.test.ts` — neither is a render-path URL.
- Every image render in the LoL views goes through `/img/lol/...`.
- Wiki-blip tolerance: the fallback chain returns DDragon/CDragon art on ability + champion-square + profile-icon routes; map/emblem/UI fall back to the proxy's own immutable cache.

## How to extend

If a new wiki-sourced asset type appears: add the proxy route in [`apps/api/src/img/img.controller.ts`](../../../apps/api/src/img/img.controller.ts), resolver method in [`lol-image.service.ts`](../../../apps/api/src/img/lol-image.service.ts) returning `urls: [wikiUrl, …fallbacks]`, and the corresponding `*Url()` helper in [`apps/web/src/lol/_shared/assets/champion-icon.ts`](../../../apps/web/src/lol/_shared/assets/champion-icon.ts) that resolves to the proxy URL. Web call sites import the helper — never construct the wiki URL directly.

For id→wiki-name lookups (the pattern profile-icon and ability use): cache the map lazy + sticky on the service instance, mirror `loadProfileIconTitles()`.

## Background (kept for context)

Before this arc, `apps/web` routed some images through the project image proxy (champions, items, profile icons after Chunk 6.5, runes, summoner spells, role icons) and some directly to wiki (ability icons, live-tab champion squares, minimaps, ranked emblems, gold/minion/ward/attack singletons). The split was historical accident: the proxy was built to bridge DDragon's PNG-only catalog and grew piecemeal; the wiki helpers were added later as straight URL builders. Profile-icon Chunk 6.5 proved the wiki-primary + DDragon-fallback pattern; this arc generalised it.

## Related

- [[lol-static-metadata-arc]] — the static-metadata pipeline that this arc generalised from.
- [rich-descriptions.md](./rich-descriptions.md) — shipped 2026-05-21; inlines wiki `<img>` tags inside tooltip HTML, all of which route through `/img/lol/wiki-file/:filename.webp` via the same proxy.
