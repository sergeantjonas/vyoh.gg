# Game-detail enrichment — directions index

**Status:** Index — backlog of enrichment leads for `/steam/game/$appid`. Not a tracked execution arc on its own; consolidates per-game-detail items previously scattered across sister notes and adds the personal-time + trailers directions surfaced post-2026-05-26 description-image-rendering ship.

The `/steam/game/$appid` surface elevated meaningfully once [description-image-rendering.md](./description-image-rendering.md) (A1–A5) shipped inline `<video>` clips in the about-block. That richness exposed a structural question — **does the editorial half (about, screenshots, trailers) deserve to be the landing, with the playthrough half (achievements, unlock timeline, sessions) split into its own tab?** — and surfaced a backlog of directions worth tracking together rather than scattered across three sister notes.

This note owns the directions backlog only. When a chunk picks up, file its execution plan in the natural destination note (api-surface-survey for new endpoints, motion-backlog for animation polish, etc.) and flip the row here to a pointer.

Sister notes — read these for items already filed elsewhere:

- [api-surface-survey.md](./api-surface-survey.md) — untapped Steam Web API endpoints. Several explicitly call out the game-detail page as their landing surface (A2 user-stats, A3 top achievements, A4 in-Steam notes, A7 news feed).
- [library-card-enrichment.md](./library-card-enrichment.md) — `IStoreBrowseService/GetItems` field harvest. Chunks 10–12 are backlogged game-detail items (languages, demo links, bundle expansion).
- [steam-integration.md](./steam-integration.md) candidate board — small leads that haven't graduated to their own arc yet.
- [player-portrait.md](./player-portrait.md) — adjacent surface (profile-level cross-game characterisation). Concepts overlap; surface does not.

---

## Structural question, pending

**Single long page vs editorial-landing + playthrough-tab.** The about + screenshots + (future) trailers form an editorial "what is this game" surface. Achievements + unlock timeline + (future) per-game session histogram form a personal "what have I done in it" surface. The single-page model works while it's all stacked, but a tab split — modelled on the proven match-detail `Recap / Your game / Timeline` pattern — would give each half room to grow without burying the other.

Decide which tab is the default before scoping. For the *owner's* day-to-day use, playthrough is probably the more-visited surface; for the *portfolio* framing, editorial is the wow-on-land slot. The two answers conflict.

Resolution gate: once two or more chunks below land that meaningfully increase scroll length on either half, revisit this question before adding a third.

---

## Items in flight from sister notes

Pointers only — execution plans live in the linked notes.

### Editorial / publisher signal

- **Trailers (`trailers.highlights[].trailer_480p` / `trailer_max`)** — same content-hashed `<mp4>/<webm>/<poster>` shape as the `extras` we just wired. The proxy ([img.controller.ts:steamDescriptionAsset](../../../apps/api/src/img/img.controller.ts)), sanitiser opt-in ([sanitize-rich-html.ts § allowVideo](../../../packages/shared/src/lol/sanitize-rich-html.ts)), and reduce-motion swap all already work. The remaining work is a URL rewriter for the trailer path shape + a `<TrailerReel>` consumer on `/steam/game/$appid`. Near-free win post-A1–A5; **single highest-leverage editorial item.** Lives separately from [microtrailer-hover-preview.md](../cross-cutting/microtrailer-hover-preview.md) — that one is library-tile hover; this is in-page editorial.
- **Demo discoverability** — `related_items.demos` / `demo_appid` / `standalone_demo_appid`. → [library-card-enrichment.md Chunk 11](./library-card-enrichment.md).
- **Supported languages chip** — niche; only worth surfacing once. → [library-card-enrichment.md Chunk 10](./library-card-enrichment.md).
- **Bundle expansion** — `included_items.included_apps`. Defer until owner has bundle entries. → [library-card-enrichment.md Chunk 12](./library-card-enrichment.md).
- **In-Steam game notes** — `IGameNotesService/GetGameNotes`. Owner-authored editorial content; perfect "Player's note" sidebar if any exist. **Probe before scoping** — only valuable if the owner actually writes Steam notes. → [api-surface-survey.md Chunk A4](./api-surface-survey.md).
- **Game news feed** — `ISteamNews/GetNewsForApp`. "Patch notes from 3 days ago" context strip. → [api-surface-survey.md Chunk A7](./api-surface-survey.md).

### Owner data / playthrough signal

- **Top rarest achievements per game** — `IPlayerService/GetTopAchievementsForGames`. Pre-computed by Steam, saves a join. Surfaces the *flex* (rarest unlocks the owner has on this title). → [api-surface-survey.md Chunk A3](./api-surface-survey.md).
- **Per-game custom user stats** — `ISteamUserStats/GetUserStatsForGame`. Quantitative career stats (kills, distance travelled, time-of-day) beyond binary achievements. Game-specific schema — works best on a handful of titles, but the ones it does work on become a distinct surface. → [api-surface-survey.md Chunk A2](./api-surface-survey.md).

---

## New directions, not yet filed elsewhere

### Personal-time storytelling

Differentiates the page from Steam's own storefront, which only ever shows *publisher-driven* signal. The data is already in the DB from owned-games sync + play sessions; the consumer surfaces are what's missing.

- **First played / last played strip** — narrate the arc: "Picked up Jun 2023 · Last played Mar 2025 · 8 sessions across 11 months." Especially evocative for long-tail titles the owner returned to after a gap. Uses `firstSeenAt` (owned-games) + `rtimeLastPlayed` (already populated per `steam-integration.md` C-2). One-card chip, simple and high-density.
- **Session histogram for this title** — when (hour of day, day of week) does the owner actually play *this game*? Two-dimensional heatmap or two-row strip (hour-of-day on top, day-of-week underneath). Distinct from the profile-level chronotype ([player-portrait.md](./player-portrait.md)) because it's per-game; reveals whether this title is "the after-work weeknight game" or "the Sunday morning game."
- **Replay arcs** — gap detection in session data. "Played for 3 weeks in late 2023, didn't touch until Dec 2024 — then 12 sessions in 10 days." Steam doesn't visualise this; it's the most narratively interesting per-game shape we can derive.
- **Achievement unlock timeline density** — when did the owner do the bulk of these unlocks? A small sparkline on top of the existing unlock timeline showing density per week. Reveals "binge unlocker" vs "long-tail completionist" personality per title. Cheap extension of an already-shipped surface.
- **Completion percentile vs library** — given the owner's library, where does *this* game's completion rank? "Top 5% of your library by achievement completion" or "Bottom decile — you bounced off." Self-aware in the same way [player-portrait.md](./player-portrait.md)'s anti-portrait is.
- **Playtime vs Steam global average** — am I a binge player or completionist *relative to the broader playerbase*? `GetCurrentPlayerCount` is too coarse, but `IPlayerService/GetRecentlyPlayedGames` + community wisdom hints work. Speculative — confirm a data source before scoping.

### Surface-shaping ideas (not data-driven)

- **Editorial verdict card** — owner-written one-line take on the game, rendered prominently. Authored offline (markdown frontmatter on the appid), surfaces in the editorial half. Only interesting once the owner has actually written a few — but each one written makes the page distinctly *personal*. Adjacent to the in-Steam notes idea (A4) but owner-controlled and rich-text rather than constrained to Steam's note format.
- **Visual hero composition** — wider hero with logo-on-hero layout (Steam library itself does this on the storefront). The hero is already proxied; the layout work is CSS-only. Defer until/unless the editorial-landing tab split lands (it would benefit the editorial tab much more than the current stacked view).

### Cross-stream synthesis (intentionally bounded)

Per [repo-conventions.md § Per-stream routes; / is synthesis-only](../../repo-conventions.md), cross-stream content lives on `/`, not on `/steam/game/$appid`. Examples that look tempting but don't belong here:

- "I played this for 30 hours while LoL was on a hiatus" — synthesis surface, belongs on `/`.
- "I listened to Y while playing this" — Spotify cross-stream, belongs on `/` if/when that integration lands.

Documented here so a future session doesn't re-propose them.

---

## How to use this note

- **When scoping a new session for game-detail enrichment**, read this index first to see what's already filed where. Pick the most leverage item for the time budget.
- **When a chunk lands**, file its execution detail in the natural destination note (this note stays a pointer index) and flip the row above to a one-line shipped-pointer.
- **When promoting one of the new directions** above to an actual tracked arc, give it its own working note and update the pointer here.
- **If the structural tab-split question is being decided**, land that decision in this note's "Structural question" section before scoping the chunk that triggered it.

## Pointer hygiene

Indexed in [open-work.md](../open-work.md) under Steam surfaces. When the first chunk picks up, leave the open-work entry as "Game-detail enrichment — directions index" so the surface stays discoverable across sessions; don't rename to the active chunk title.
