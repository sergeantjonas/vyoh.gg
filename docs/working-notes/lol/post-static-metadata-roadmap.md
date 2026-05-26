# vyoh.gg — Post-static-metadata roadmap (3-arc sequencing)

**Status:** Reference — post-arc roadmap drafted 2026-05-21 as the LoL static-metadata arc (chunks 4a–6.5) wrapped up. All three follow-ups have since shipped on the recommended sequence: `lazy` (2026-05-21), `unified` (2026-05-21 to 2026-05-23), `rich` (2026-05-21). Kept as a record of how the three arcs were sequenced and which inter-arc dependencies held.

## The three arcs

| Slug | Note | Headline | Size |
|---|---|---|---|
| `lazy` | [lazy-ability-descriptions.md](./lazy-ability-descriptions.md) | Flip `syncChampionAbilityDescriptions` from cron-bulk to on-demand, killing the cold-sync 429 spam | 2 chunks |
| `unified` | [unified-image-fallback.md](./unified-image-fallback.md) | Route every wiki-sourced LoL image through the proxy with upstream fallback (extends the 6.5c profile-icon pattern) | 4 chunks |
| `rich` | [rich-descriptions.md](./rich-descriptions.md) | Replace `stripWikitext` plain-text with sanitized wiki HTML on the wider item/ability tooltips | 4 chunks |

## Recommended sequence: `lazy → unified → rich`

### Why this order

1. **`lazy` first** — it's the smallest arc (2 chunks), fixes a *currently-firing* bug (~58 wiki 429s every cron tick), and shrinks the cron tick from minutes to seconds. Lowest risk, highest immediate value.
2. **`unified` second** — establishes the *invariant* that every image URL the web sees points at the proxy. `rich` will then inline images inside descriptions (`{{ai|...}}` damage icons, `{{g|...}}` gold icons), and the sanitizer can assume one URL shape instead of forking on "is this image already through the proxy or still direct-wiki?".
3. **`rich` last** — depends on both upstream changes being in place. Descriptions can be lazy (fine — rich renders whatever's available), inline images route through the proxy (clean sanitizer rewrite), and the visible payoff lands when the architectural foundation is solid.

### Alternate orderings considered

- **`unified` first, then `lazy`, then `rich`** — defensible (clean architectural foundation first), but the 429 spam keeps recurring every cron tick until `lazy` ships, and `unified` is 4 chunks which could stretch.
- **`lazy → rich → unified`** — fastest path to visible payoff, but the `rich` sanitizer would ship with mixed URL shapes (some proxy, some direct wiki) and then need a second pass when `unified` lands. Wasted work.

### What if priorities shift

If `rich` becomes user-visible-priority before `lazy` ships: do `unified-A1` (ability icons through proxy) + `rich` together, defer `lazy`. The 429 spam is annoying but self-healing — it's not a correctness bug.

## Inter-arc dependencies

### `lazy` ↔ `unified`

Independent. They touch different parts of the system:
- `lazy` modifies `syncChampionAbilityDescriptions` (description text content) and `useChampionSpells` (web hook).
- `unified` modifies `LolImageService` (image URL resolution) and the components that build asset URLs.

They both touch `LolChampionAbility`-related code but only `lazy` adds a schema column (`wikiSyncedPatchVersion`).

### `lazy` → `rich`

Soft dependency. `rich` reads `descriptionHtml` from ability/item rows. If `lazy` ships first, descriptions are populated on-demand instead of by cron — both states are valid (rich just renders whatever's present, falling back to plain text or empty when null). If `rich` ships first and `lazy` later, the descriptions get rewritten on a different schedule but `rich` doesn't notice.

### `unified` → `rich` (hard dependency on one chunk)

`rich` inlines small images inside descriptions (the wiki's `{{ai|magic}}` produces a `<img>` for the magic-damage icon; `{{g|450}}` produces a gold-icon img tag inline with the value). The sanitizer needs to rewrite those `<img src="...">` URLs to proxy URLs.

If `unified-A3` (UI icon proxy routes: gold, attack, magic damage, etc.) ships *before* `rich-R2` (sanitizer), the sanitizer rewrites are mechanical. If `unified` is partial, `rich` either ships with mixed URL shapes (eww) or has to special-case the not-yet-proxied subset.

**Concretely:** `unified-A3` (UI singletons) is the gating chunk for `rich`. The other `unified` chunks (`A1` ability icons, `A2` champion squares, `A4` sweep) can land in any order relative to `rich` without conflict.

## Schema migration ordering

Both `lazy` and `unified-A1` touch ability-row metadata:
- `lazy-L1` adds `wikiSyncedPatchVersion` to `LolChampionAbility`.
- `unified-A1` reads (but doesn't write) `iconWikiName` from the same table.

No conflict — `lazy` adds a column, `unified` doesn't touch the schema. Either can land first.

Reminder from [[lol-static-metadata-arc]]: the migration sequence is poisoned from a prior hand-edit, so `prisma migrate dev` refuses subsequent migrations. Use `prisma migrate deploy` or `prisma db execute --file` for new migrations until someone resets the migration history. 6.5a's migration was applied via `migrate deploy` successfully — same path for future arcs.

## Pre-decisions to make before each arc starts

- **`lazy-L1`:** per-ability vs per-champion granularity for the new endpoint. Note recommends per-ability; revisit if a champion-detail page emerges that eagerly renders all 5 tooltips on mount.
- **`unified-A2`:** champion-square variant — wiki `OriginalSquare` (used by live-tab today) vs CDragon's desaturated client art (used everywhere else). Either pick one for all consumers or fork the route into two variants. Decide before touching `LolImageService.champion()`.
- **`rich-R1`:** sanitizer dependency choice — `dompurify` vs a small purpose-built allowlist sanitizer scoped to wiki's known ~10 tags. Owner generally prefers small utilities over deps when the surface is small.

## Suggested session boundaries

Roughly one chunk per session — each chunk is one independently-committable change with same-commit tests. After each chunk, `/compact` if the chunk involved more than ~8 file reads. Between arcs, `/clear` may be more appropriate than `/compact` if the surrounding investigation isn't reused (e.g. after `lazy` ships, the next session starting `unified-A1` doesn't need the lazy debugger trace in context).

Total: 10 chunks across 3 arcs. At one chunk per session, that's ~10 working sessions to land the full backlog. Comfortable as background work over a couple of weeks; can compress if multiple chunks land in one session.

## Done criteria (cross-arc)

When all three arcs ship:

- Cron tick is ~5 wiki/DDragon calls instead of ~800+.
- Zero direct-to-wiki image URLs in `apps/web/src/**`.
- Item and ability tooltips render rich HTML with inline icons, sourced from `descriptionHtml`, sanitized through the project's own allowlist.
- The `descriptionHtml` plumbing in `ItemSlot` ([match-detail-view.tsx](../../../apps/web/src/lol/matches/match-detail-view.tsx)) is no longer dead — it actually renders something.
- A wiki outage degrades the UI gracefully: cached images still serve, lazy-fetched descriptions fall back to existing wikitext, every tooltip still renders.
