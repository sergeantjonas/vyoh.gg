# vyoh.gg — Rich icon-embedded descriptions

**Status:** Shipped 2026-05-21 across [lol-static-metadata.md](./lol-static-metadata.md) chunks 4–6 and three follow-up commits. Item and ability tooltips on the wider surfaces now render sanitised wiki HTML with inline icons; compact label-style tooltips intentionally kept the plain-text path.

## What landed

Approach A from the original options below was the chosen path — keep wiki's `action=parse` HTML, sanitise via a small in-repo allowlist, route inline icons through the existing image proxy.

| Commit | What |
| --- | --- |
| `eaf44d1` | Allowlist sanitiser in [`@vyoh/shared`](../../../packages/shared/src/lol/sanitize-rich-html.ts) (~10 tags, only `src/alt/width/height` on `<img>`, only `class` on `<span>`; `<a>` stripped to text on purpose — tooltips don't navigate). |
| `127999b` | Wiki-file image-proxy route + [`rewriteWikiImageSrc`](../../../packages/shared/src/lol/wiki-url-helpers.ts) helper so wiki `<img src>` survives the rewrite into a proxied URL. |
| `8a9e68d` | Rich tooltip variant on `ItemSlot` / `BuildItemSlot` / `SpellRowLabel`, with `max-w-sm` for items and `max-w-xs` for abilities. |
| `0df7b93` | Drop md5 buckets in the wiki-file proxy — leaguepedia serves flat `/en-us/images/<filename>` paths. |
| `eb1d02c` | Tooltip CSS: inline-block icons + null out wiki's `.border` class collision with Tailwind. |
| `7cc584f` | Canonical-wiki snapshot tests — see [`rich-description.snapshots.test.ts`](../../../apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts). |
| `9efec7b` | Eager item `descriptionHtml` sync during `syncItems` with wikitext-unchanged dedup (zero parse calls at steady state). |
| `71046b9` | Unwrap wiki `{{ft\|long\|short}}` flip template before sanitisation so both the inactive arm and the `「 」` bracket padding disappear. |

## How to extend

If a new surface needs rich wiki HTML: import `toRichDescription(rawHtml)` from [`apps/web/src/lol/_shared/static/rich-description.ts`](../../../apps/web/src/lol/_shared/static/rich-description.ts) — it wires sanitiser + image proxy + flip-template unwrap into one call. Width: `max-w-sm` for items, `max-w-xs` for abilities; anything tighter cramps the inline icons.

If a new wiki template pattern shows up (drift on existing fixtures, or a new template that mangles): add a canonical fixture to [`rich-description.snapshots.test.ts`](../../../apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts). The pre-process step lives in `rich-description.ts` (see `unwrapFlipTemplate`); add another stripper there for new wiki-specific quirks, not in the shared sanitiser.

Plain-text `description` stays alongside `descriptionRich` on the hooks because abilities use a lazy fetch — the tooltip needs something to render while HTML is pending.

## Surfaces that intentionally kept plain text

- `SummonerSpellIcon` and `KeystoneIcon` — 4-line summaries; inline icons would be visual noise at this density.

## Original options (kept for context)

The motivation, approach options A/B, and the decision to go with A are preserved in the auto-memory entry `project_rich_descriptions.md` (per-machine) and in the commit messages above. The short version: B (custom wikitext-to-React parser) would carry its own per-template maintenance surface; A piggybacks on wiki's own render path and stays current automatically.
