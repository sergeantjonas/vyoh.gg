# Steam library-card enrichment — `GetItems` field harvest

**Status:** Active — research session 2026-05-24 probed `IStoreBrowseService/GetItems/v1/` with every `include_*` flag and inventoried the unused fields. This note is the umbrella roadmap; each chunk below links out to the working-note (quick-wins, elevation arc, palette grammar, etc.) where it actually lands.

Premise: the existing [enrichment.service.ts](../../../apps/api/src/steam/enrichment.service.ts) already calls `GetItems` per owned game and writes a `SteamGameEnrichment` row. The current `data_request` only opts into `include_assets`, `include_release`, `include_categories`, `include_tag_count` — but the same endpoint, same rate-limit budget, returns ~12 more field families when more flags flip on. Capturing them is purely "more `include_*: true` + more columns + more projection lines" — no new endpoint, no extra request, no second cache.

Sibling note: [api-surface-survey.md](./api-surface-survey.md) inventories the **rest of the Steam Web API** (Steam level, badges, per-game user stats, profile showcases, game notes, news, top-sellers, etc.) — the chunks there are *new* endpoints rather than additional `include_*` flags on this one. Pick from there once the highest-priority chunks here have landed.

Reference probe: see commit-history search for the 2026-05-24 session — Subverse (appid `1034140`) and Stellar Blade (appid `3489700`) used as the NSFW edge case and the SFW canonical case respectively.

---

## Chunks at a glance

Sized so each row is independently committable. Some chunks land changes in this repo's existing roadmap notes (linked column) rather than introducing a new note; this file is the harvest index, not the destination.

| # | Field family | Lands in | Status |
|---|---|---|---|
| 0 | Schema-level enrichment refactor (umbrella) | this note | ✅ shipped 2026-05-25 (76a6a01) |
| 1 | `basic_info.short_description` → library card tooltip | [quick-wins.md](../cross-cutting/quick-wins.md) | ✅ shipped 2026-05-25 |
| 2 | `platforms.steam_deck_compat_category` chip | [quick-wins.md](../cross-cutting/quick-wins.md) | ✅ shipped 2026-05-25 |
| 3 | `platforms.windows / mac / linux / vr_support` pills | [quick-wins.md](../cross-cutting/quick-wins.md) | ✅ shipped 2026-05-25 |
| 4 | `reviews.summary_filtered` "Very Positive (56k)" chip | [quick-wins.md](../cross-cutting/quick-wins.md) | Planned |
| 5 | `game_rating` ESRB/PEGI chip + descriptors | [quick-wins.md](../cross-cutting/quick-wins.md) | Planned |
| 6 | `basic_info.publishers / developers / franchises` filtering | [command-palette.md](../cross-cutting/command-palette.md) Phase G | Planned |
| 7 | `trailers.highlights[].microtrailer` hover preview | [microtrailer-hover-preview.md](../cross-cutting/microtrailer-hover-preview.md) | Planned (arc) |
| 8 | `full_description_bbcode` → game-detail body | this note (Chunk 8 below) | Planned |
| 9 | `screenshots.all_ages_screenshots[]` → game-detail gallery | this note (Chunk 9 below) | Planned |
| 10 | `supported_languages` → audio/subtitle filter | [steam-integration.md candidate board](./steam-integration.md) | Backlogged |
| 11 | `related_items.demos / demo_appid` → "Try the demo" link | [steam-integration.md candidate board](./steam-integration.md) | Backlogged |
| 12 | `included_items.included_apps` → bundle expansion | [steam-integration.md candidate board](./steam-integration.md) | Backlogged |
| 13 | `assets_without_overrides` → festival-art fallback | this note (notes only) | Noted, no action |
| 14 | `content_descriptorids` → owner-hidden gate | parked — see § "NSFW parked" | Parked |

NSFW parked: descriptor capture is **not** in this roadmap. Owner-decided 2026-05-24 — only one game in the library justifies the work and a manual deny-list would be cheaper. See conversation transcript; if revisited, the chunk shape is in § "NSFW parked" at the bottom.

---

## Chunk 0 — Schema enrichment umbrella

The first chunk that touches enrichment after this note lands should consolidate the "flip more `include_*` flags" change so the per-field chunks below can each focus on its column + projection + render. Keeps the diff for chunks 1-9 small and reviewable.

**Scope:**

- [apps/api/src/steam/steam-client.service.ts](../../../apps/api/src/steam/steam-client.service.ts) — extend `getStoreItemsFull` `data_request` with the union of flags chunks 1-9 will need: `include_basic_info`, `include_platforms`, `include_screenshots`, `include_trailers`, `include_ratings`, `include_reviews`, `include_supported_languages`, `include_full_description`, `include_included_items`. Same rate-limit family.
- [apps/api/src/steam/types.ts](../../../apps/api/src/steam/types.ts) — extend `SteamStoreItemFullRaw` to cover all fields. Mark each field optional (`?:`) since the upstream may omit per item.
- [apps/api/src/steam/enrichment.service.ts](../../../apps/api/src/steam/enrichment.service.ts) — leave `projectEnrichment` untouched. Per-chunk projection lands per-chunk.

**Done when:** schema typings are accurate against a probed Subverse + Stellar Blade response; no behavior change yet; one focused commit.

**Why ship this first:** Chunks 1-9 each become "Prisma migration + 1 line in `projectEnrichment` + render", instead of every chunk also doing the upstream-type plumbing.

---

## Chunk 1 — Short description tooltip

**Field:** `basic_info.short_description` (string, ~150-300 chars typical).

**Render:** Wrap the library-card title (and tile) in a Radix tooltip per the convention in [repo-conventions.md § TooltipPrimitive](../../repo-conventions.md). Body = the short description, two-line clamp, `side="top"`. Optional: also render on the `/steam/game/$appid` page header as a `<p class="text-muted-foreground">` subtitle.

**Why first among the additive chunks:** highest density-of-information win for the least code. Library tiles today carry only the name and playtime — the short description is the single sentence that makes "Stellar Blade" instantly legible as "post-apocalyptic action-adventure" without a click-through.

**Data shape:** add `shortDescription String?` column to `SteamGameEnrichment`; project in `projectEnrichment`; thread through `@vyoh/shared` type. Render gated on `shortDescription != null`.

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk 2 — Steam Deck compat chip

**Field:** `platforms.steam_deck_compat_category` (int: `0` Unknown / `1` Unsupported / `2` Playable / `3` Verified).

**Render:** Small chip on the library card and on `/steam/game/$appid` header. Three rendered states (skip `0` Unknown):
- `3 Verified` — green check, "Deck Verified" label
- `2 Playable` — amber dot, "Deck Playable"
- `1 Unsupported` — neutral cross, "Not on Deck"

Mirrors the [official Steam Deck compatibility badge](https://store.steampowered.com/steamdeck/learnmore) — visitors recognise the visual language immediately.

**Data shape:** `steamDeckCompat Int?` on `SteamGameEnrichment`; `@vyoh/shared` enum mirror; render component in `apps/web/src/steam/_shared/`.

**Bonus context for self-portrait framing:** Steam Deck ownership is a personality signal. A chip per game on the library + a "X% of your playtime is Deck-friendly" derived chip on `/steam` pairs naturally with the existing platform-mix panel (which uses OS-split fields).

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk 3 — Platform pills

**Fields:** `platforms.windows`, `platforms.mac`, `platforms.linux`, `platforms.vr_support` (object — empty `{}` means no VR; non-empty enumerates VR mode flags).

**Render:** Compact OS-icon row on game-detail header (Win/Mac/Linux glyphs, dimmed when false). VR badge separately when `vr_support` has any key.

**Decision pending before pickup:** Does this duplicate `GetOwnedGames`'s `playtime_windows_forever` / `playtime_mac_forever` / `playtime_linux_forever` we already capture? Slight difference: those report owner's *playtime per OS*, not the game's *supported OSs*. A game can be Windows-only but show 0h Mac playtime — the platform pill distinguishes "I haven't played it on Mac" from "it doesn't run on Mac at all." Worth shipping; just call out the distinction in the chip's title/aria.

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk 4 — Review summary chip

**Fields:** `reviews.summary_filtered.{review_count, percent_positive, review_score, review_score_label}` (e.g. Stellar Blade: 56501 reviews, 94% positive, "Very Positive"). `summary_language_specific` is the same shape filtered to the request `language`.

**Render:** Compact chip on game-detail header reading `Very Positive · 56,501`. Color = Steam's own scale (`Overwhelmingly Positive` → emerald, `Very Positive` → green, `Mostly Positive` → lime, `Mixed` → amber, etc.). Instantly recognisable Steam-storefront vocabulary.

**Why valuable for portfolio framing:** the chip is editorial — it shows the owner's library isn't a random pile, it's curated against the consensus. Game-detail pages without this feel anonymous; with it, they feel like Steam-native context.

**Refresh cadence consideration:** review counts move daily for new releases, monthly for older titles. The existing enrichment poller cadence (set by the larger `SteamEnrichmentPoller`, not this chunk to decide) should be fine — reviews shifting from "Very Positive" to "Mostly Positive" is meaningful when it happens but rare. If a more aggressive refresh is needed later, separate from the asset-timestamp cache-buster logic.

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk 5 — ESRB / PEGI rating chip

**Fields:** `game_rating.{type, rating, descriptors, required_age, use_age_gate, image_url}`. Examples:
- Stellar Blade: ESRB M, age 17, descriptors `["Violence", "Blood and Gore", "Suggestive Themes", "Language"]`, `use_age_gate: true`.
- Subverse: `null` (AO-rated games typically skip ESRB submission).

**Render:** Small rating badge near review chip, image from `https://store.cloudflare.steamstatic.com/{image_url}` (or proxy via the existing image pipeline). Descriptor list collapses into a `+4 descriptors` chip; hovering expands the full list via Radix Popover.

**Important footnote — not an NSFW signal.** Subverse returns `game_rating: null` because AO is a retail death sentence and publishers skip ESRB. Means this chip is purely editorial (most games have it, mainstream rating context); it must **not** be wired into any owner-hidden filter logic. The NSFW story stays parked at the bottom of this note.

**Data shape:** `gameRating Json?` on `SteamGameEnrichment` — the shape is small but structured (rating + descriptor list + image_url + age), JSON column avoids a 5-field flat schema for what's effectively one block.

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk 6 — Publisher / developer / franchise palette grammar

**Fields:** `basic_info.publishers[].name`, `basic_info.developers[].name`, `basic_info.franchises[].name` (each is an array of objects with `name` + optional `creator_clan_account_id`).

**Surface:** Extend the ⌘K command palette grammar — this is the right home per [repo-conventions.md § Extend the command palette](../../repo-conventions.md). New verbs:

| Verb | Example | Meaning |
|---|---|---|
| `dev:` | `dev:from-software` | Games developed by FromSoftware |
| `pub:` | `pub:playstation` | Games published by PlayStation Publishing |
| `franchise:` | `franchise:resident-evil` | Games in the Resident Evil franchise |

Multi-occurrence unions (same as `with:` / `vs:` in the LoL grammar). Slug-match against name with `kebabCase(name).includes(kebabCase(query))`.

**Where it lands:** New Phase G in [command-palette.md](../cross-cutting/command-palette.md). Parser extends to a Steam-scoped grammar (parallel to the existing LoL `parseMatchQuery`) in `@vyoh/shared` — per the existing Open question in command-palette.md ("Steam search. Worth a `with:` / `played:` parallel grammar for Steam?"), this chunk is the first concrete answer.

**Data shape:** `publisherNames String[]`, `developerNames String[]`, `franchiseNames String[]` on `SteamGameEnrichment`. Postgres arrays index well for `&&` (overlap) and `@>` (contains) queries when filter scales.

**Why route through palette, not a leaf-page dropdown:** explicit per [repo-conventions.md § Extend the command palette when adding filterable surfaces](../../repo-conventions.md). A "Filter by developer" dropdown on `/steam/library` re-creates the sticky-controls problem that the palette handoff was meant to solve.

**Bonus surface this unlocks:** `/steam/game/$appid` header line "by SHIFT UP Corporation, published by PlayStation Publishing LLC" — pure render off the same captured data, free.

---

## Chunk 7 — Microtrailer hover preview (elevation arc)

**Fields:** `trailers.highlights[].microtrailer[]` — each has `{filename, type}` where `type ∈ {"video/webm", "video/mp4"}` and `filename` is a CDN path like `3489700/2090056095/.../microtrailer.webm`. Steam plays these inline on its storefront grid on hover; they're 6-second silent loops, ~1-2 MB each.

**Promoted to its own arc note:** [microtrailer-hover-preview.md](../cross-cutting/microtrailer-hover-preview.md) — the chunk plan, motion-budget judgments, reduced-motion variant, and per-engine perf concerns live there. Indexed in [elevation-arcs.md](../cross-cutting/elevation-arcs.md) Tier 2.

**Why arc-grade, not quick-win:** touches motion guardrails ([motion-backlog.md](../cross-cutting/motion-backlog.md)), the existing virtualised library list ([library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx) / [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx) — too many concurrent `<video>` elements would blow up GPU memory), and has a real cross-engine perf surface (Safari especially; cf. [safari-vt-snapshot-cost.md](../cross-cutting/safari-vt-snapshot-cost.md)).

---

## Chunk 8 — Full description on game-detail page

**Field:** `full_description_bbcode` — string, ~2-8KB of BBCode markup. Stellar Blade returns 3890 chars.

**Architectural fit:** the existing LoL rich-description pipeline (shipped 2026-05-21, see [[project_rich_descriptions]] auto-memory and [rich-descriptions.md](../lol/rich-descriptions.md)) already sanitises wiki HTML for ability / item tooltips. A BBCode → safe HTML pass slots into the same trust-boundary architecture — different input grammar, same output guarantees (sanitised, image URLs proxied through the existing img pipeline, no inline scripts, no arbitrary CSS).

**BBCode → HTML library:** see [library-shortlist.md](../cross-cutting/library-shortlist.md) — add `xbbcode-parser` / `js-bbcode-parser` / hand-rolled candidate as a library-shortlist entry to evaluate before this chunk lands. Steam's BBCode dialect is a constrained subset ([documented here](https://steamcommunity.com/comment/Recommendation/formattinghelp)) — a parser that handles the actual tags in use (`[h1]`, `[b]`, `[i]`, `[url]`, `[img]`, `[list]`, `[*]`, `[table]`, `[tr]`, `[td]`, `[previewyoutube]`, etc.) is enough; we don't need a full Steam Community parser.

**Trust boundary:** BBCode is publisher-supplied. Treat as untrusted: sanitise output HTML via the same DOMPurify pipeline the LoL wiki HTML uses. `[img]` tags rewritten to `<img>` with `src` rewritten through the image proxy (same pattern as wiki inline icons).

**Render:** `/steam/game/$appid` detail page gets a dedicated "About this game" block. Today the page is sparse — playtime + the (planned) achievement panel + chips. The full description is the missing editorial content that turns a stub page into a real game-detail surface.

**Data shape:** `fullDescriptionBbcode String?` on `SteamGameEnrichment` (raw, sanitisation at render time so updates to the sanitiser don't require re-enrichment); optional precomputed `fullDescriptionHtml String?` as render-time cache if measurement shows the sanitiser is hot enough to matter.

**Refresh cadence:** descriptions update with major content patches / DLC releases. Cache-buster like `assetTimestamp` would catch the typical case; otherwise the existing enrichment-poller cadence is fine.

---

## Chunk 9 — Screenshot gallery on game-detail page

**Fields:** `screenshots.all_ages_screenshots[]` (default render) and `screenshots.mature_content_screenshots[]` (Steam server-side bucket for "behind the maturity gate"). Each screenshot has `{filename, ordinal}` shape — paths CDN-resolve via `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/{filename}` or similar.

**Render:** Image strip + lightbox on `/steam/game/$appid`. Per-image lazy load (`loading="lazy"` + intersection-observer fallback already a pattern in the project).

**Two-bucket decision:**
- **Default render** = `all_ages_screenshots` only. Matches Steam's own storefront default.
- **Mature bucket gate** — render `mature_content_screenshots` only when the page is in owner-authenticated view, or behind an explicit "Show mature screenshots" toggle. This is the orthogonal NSFW handling that doesn't need content-descriptor capture: the **bucket choice is the signal**, no additional descriptor logic needed.
- For a portfolio-public game-detail page, defaulting to `all_ages_screenshots` is the right call; the toggle is the owner's escape hatch.

**Data shape:** `screenshotsAllAges Json?` + `screenshotsMature Json?` (each a small array of `{filename, ordinal}`). Json column over flat arrays because filenames are publisher-supplied strings and ordinal pairs them — denormalising into two columns would lose the pairing.

**Image proxy:** route all screenshot URLs through the existing image-proxy pattern from [steam-integration.md Phase S3 Chunk 3](./steam-integration.md). No new pipeline.

---

## Backlogged (in steam-integration.md candidate board)

These three are small and additive but don't justify chunks of their own. Filed in the [steam-integration.md candidate board](./steam-integration.md) instead so they're picked up alongside related surfaces:

- **Chunk 10 — Supported languages.** Per-game audio/subtitle matrix. Niche but free — palette grammar `audio:french` / `subs:french` if it becomes interesting; otherwise just a `/steam/game/$appid` chip ("English, French, Japanese full audio + 22 subtitles").
- **Chunk 11 — Demo links.** `related_items.demos` / `demo_appid` / `standalone_demo_appid` — when a game has a free demo, link to it from the game-detail header. Discoverability: how many of the owner's wishlisted games have demos they haven't tried?
- **Chunk 12 — Bundle expansion.** `included_items.included_apps` — for a bundle entry (e.g. Resident Evil collection), expand to the list of included games. Niche unless the owner buys lots of bundles; defer until a real use surfaces.

## Noted, no action

- **Chunk 13 — `assets_without_overrides`.** Returns the "default" art with regional/seasonal/festival overrides stripped. Could be a fallback for the image pipeline if a regional override breaks the existing transcode chain. Don't act on this speculatively; revisit if [unified-image-fallback.md](../lol/unified-image-fallback.md)-style coverage gaps surface in Steam art.

---

## NSFW parked

Content descriptors discussion: see conversation transcript 2026-05-24. Decision: not enough volume in the owner's library to justify the descriptor-capture + admin-triage-view + owner-auth-bypass arc for one game (Subverse, appid `1034140`). Manual deny-list would be cheaper. If revisited, the chunk shape is:

1. Add `content_descriptorids` (note: snake-case as returned, project as `contentDescriptorIds: number[]`) to `SteamStoreItemFullRaw`.
2. Prisma migration: `contentDescriptorIds Int[] @default([])` on `SteamGameEnrichment`.
3. One-line projection in `projectEnrichment`.
4. Owner-curated deny-list table or `hiddenByOwner Boolean` column — manual is the truth, descriptors are the triage signal (specifically descriptors `3` and `4` — `1` is too noisy, used by mainstream games for any single suggestive scene).
5. API-layer filter in owned-games / library endpoints, owner-auth bypass.
6. Owner-only "suggested: hide?" badge in admin view, one-click → adds to deny-list.

Reference: `IStoreBrowseService/GetItems` confirmed to return `content_descriptorids` directly (no fallback to legacy `appdetails`). Subverse returns `[1, 2, 3, 4, 5]`. Stellar Blade returns 3 descriptors (likely `[1, 2, 5]` or similar — not `3`/`4`). `game_rating` is **not** a viable alternate signal — Subverse returns `null`.

---

## Cross-cutting decisions

- **Single enrichment refactor or per-chunk?** Chunk 0 lifts all the `include_*` flags + raw-type fields in one commit so chunks 1-9 each touch only the column + projection + render. Alternative is per-chunk flag-flipping, which makes each chunk smaller but duplicates the upstream-type plumbing 9 times.
- **Refresh cadence.** Most of these fields (`short_description`, `publishers`, `developers`, `platforms`, `game_rating`, `screenshots`, `full_description_bbcode`) rarely change. Review counts, trailer lists, and `assetTimestamp` cache-buster paths shift more often. The existing `enrichedAt` upsert in `enrichment.service.ts` is fine for now; if a specific field needs a more aggressive refresh, the chunk that ships that field decides its own cadence.
- **Migration burden.** Each chunk that adds a column ships its own Prisma migration. Re-running the enrichment poller across the existing library (the upsert is idempotent) backfills.
- **Where the new render code lives.** `apps/web/src/steam/_shared/` for chips (Deck compat, review summary, ESRB) that appear on multiple surfaces. Per-page for one-off composition (`/steam/game/$appid` "About" block, screenshot gallery, full description body).

---

## How to use this note

- This is the **harvest index**, not the execution log. When a chunk is picked up, file the actual chunk plan in the linked destination note (quick-wins.md / command-palette.md / microtrailer-hover-preview.md / etc.), and flip the table row above to ✅ shipped `<date>` with the destination commit.
- Chunk 0 should land before any of chunks 1-9 to keep their diffs small.
- Chunks 1-5 are quick-wins — each a single commit, no preamble.
- Chunk 6 needs alignment with the [command-palette.md](../cross-cutting/command-palette.md) plan first.
- Chunk 7 is arc-grade — see [microtrailer-hover-preview.md](../cross-cutting/microtrailer-hover-preview.md).
- Chunks 8-9 are medium — each its own commit, no umbrella refactor needed beyond Chunk 0.
