# vyoh.gg — Rich icon-embedded descriptions (follow-up)

**Status:** Parked — proposed 2026-05-21 during the LoL static-metadata arc tooltip pass. Direct follow-up to chunk 4–6 of [lol-static-metadata.md](./lol-static-metadata.md).

## Motivation

The current tooltip pipeline runs the bundle's `descriptionWikitext` / `descriptionHtml` through `stripWikitext` (in [packages/shared/src/lol/strip-wikitext.ts](../../../packages/shared/src/lol/strip-wikitext.ts)), which:

- Unwraps wiki templates like `{{as|200% '''base''' AD}}` → `200% base AD`.
- Strips HTML tags from the `action=parse` output so both source paths land at the same plain-text shape.
- Drops `[[wiki/link|display]]` markup.

This is correct for compact label-style tooltips (the summoner-spell icon, keystone icon, build-order item slot, participant-row item slots) — every tooltip in the app today fits in a 288px-wide box and reads as one paragraph.

But the wiki source actually carries rich content the strip loses:

- Inline damage-type icons (`{{ai|...}}` template) — e.g. Hextech Proto-Belt's tooltip on the wiki interleaves `[Magic Damage]` icons with the numeric values.
- Champion-name icons, monster icons, item icons, gold icons (`{{g|...}}`).
- Color-coded stat callouts (red for damage, gold for cost).
- Bullet lists for multi-effect items.

The owner's screenshot reference (Hextech Proto-Belt on the wiki) shows what a rich rendering of these descriptions looks like — small inline icons make the description scannable instead of a wall of plain text.

## Out of scope for the tooltip-enrichment pass that shipped

The pass that landed in `123c593` (summoner spells + keystones + build-order tooltips) intentionally kept the simple text path. The plumbing is:

- `useSummonerSpells()` / `usePerks()` / `useItems()` already strip the description on the way through `stripWikitext`.
- The icon components (`SummonerSpellIcon`, `KeystoneIcon`, `BuildItemSlot`, `ItemSlot`) render the stripped string directly inside a `TooltipPrimitive.Content`.
- `ItemSlot` in [match-detail-view.tsx](../../../apps/web/src/lol/matches/match-detail-view.tsx) still uses `dangerouslySetInnerHTML` against `item.description` as a placeholder for where rich HTML would land — but since `stripWikitext` returns plain text, it currently just renders text. The `dangerouslySetInnerHTML` marker stays as the breadcrumb for this follow-up.

## Approach options

### A — Preserve HTML, scope per-surface

Keep `descriptionHtml` (from `action=parse`) untouched in the bundle, expose it as a separate field on the icon hook (e.g. `description` stays the plain text, `descriptionHtml` is new). Tooltips that want rich rendering opt in by reading `descriptionHtml`; compact tooltips keep `description`.

- Pros: Compact tooltips still get the safe plain text. No surprise re-flow in label-only icons.
- Cons: Need to sanitize wiki HTML (it ships with absolute `[[File:...]]` URLs that need rewriting and `<a>` tags that should not navigate). The wiki's `action=parse` already returns relative URLs for the wiki domain, so a base-URL rewrite + a tag allowlist (img, span, ul, li, b, i, br) is the minimum.

### B — Custom render pipeline from wikitext

Skip `descriptionHtml`. Parse a richer subset of wikitext templates in `packages/shared/src/lol/wikitext-to-react.tsx` returning a `ReactNode[]` instead of a string. Each template handler returns a JSX node (e.g. `{{ai|magic}}` → `<img src={wikiAttackIconUrl("magic-damage")} ... />`).

- Pros: No HTML sanitization. No dependency on wiki's HTML rendering staying stable. Output is real React, so it composes with existing motion/click handlers.
- Cons: Carrying a wikitext parser per-template is its own maintenance surface. Wiki adds new templates over time; we'd discover them as missing icons.

**Recommended:** A. The HTML approach is one fewer parser to maintain, and the wiki's `action=parse` output is already what the wiki renders — staying current with it is automatic.

## Concrete scope when this arc starts

Surfaces that should get the rich rendering:

- [`ItemSlot`](../../../apps/web/src/lol/matches/match-detail-view.tsx) — participant row item tooltip in match detail (largest, most-read tooltip).
- [`BuildItemSlot`](../../../apps/web/src/lol/matches/match-build-order.tsx) — already wider than the summoner-spell tooltip, room for inline icons.
- `useChampionSpells()` ability tooltips wherever they surface (champion detail page, currently rendering plain text).

Surfaces that should keep plain text:

- `SummonerSpellIcon` and `KeystoneIcon` — these are 4-line summaries at most; inline icons would be visual noise at this density.

## Dependencies / pre-work

- `descriptionHtml` is already in the bundle DTOs ([packages/shared/src/lol/static.ts](../../../packages/shared/src/lol/static.ts)) for items, perks, summoner spells, abilities. No schema change needed.
- Image URLs for inline icons need to resolve from wiki File names. The existing wiki-image helpers in [packages/shared/src/lol/wiki-image-urls.ts](../../../packages/shared/src/lol/wiki-image-urls.ts) cover the common ones (champion squares, stat icons, gold). Anything else either lives on wiki and can be added there, or comes from DDragon (item, profile-icon, summoner-spell) which we already serve via the proxy.
- HTML sanitization: pull in `dompurify` *or* write a small allowlist sanitizer scoped to the wiki's known tag set. The owner generally prefers small purpose-built utilities over deps when the surface is small (~10 tags).

## Risks

- **Wiki HTML drift.** If wiki changes its template rendering, descriptions could land mangled. Snapshot tests against a handful of canonical descriptions (Trinity Force passive, Hextech Proto-Belt active, Ahri Q) would catch this.
- **Tooltip width.** Rich content tends to want more horizontal space. The current `max-w-72` (288px) caps it tightly; may want `max-w-sm` (384px) for the rich variant.
- **Image-proxy cold cache.** Inline icons hit the same proxy; first render of a rich tooltip with 6 inline icons fans out 6 proxy requests. The proxy already caches with `IMMUTABLE_YEAR` headers, so this is only a cold-cache concern, but worth noting in case it surfaces as jank.
