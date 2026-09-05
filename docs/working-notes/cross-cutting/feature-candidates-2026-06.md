# Feature candidates — 2026-06-11 audit

**Status:** Active — candidate list from the whole-app audit; promote items individually into [open-work.md](../open-work.md) when picked. Two audit suggestions already live in [vnext-ideas.md](vnext-ideas.md) and stay owned there (see "Overlap map" at the bottom).

Parent index: [audit-2026-06-11.md](audit-2026-06-11.md). Ordering reflects leverage for the portfolio framing (each integration is a case study; `/` is synthesis-only per [repo-conventions.md](../../repo-conventions.md)).

## F1 — Shareable recap chapters (highest leverage)

The Satori+Resvg OG pipeline ([og-image-pipeline.md](og-image-pipeline.md)) and the Wrapped-style `/` ([self-portrait-recap-arc.md](self-portrait-recap-arc.md)) both exist; what's missing is the user-facing bridge: a "share this chapter" affordance that renders a **chapter-specific** card (Ahri chapter, signature game, duo-of-the-year) and hands it to the WebShare API. This is the concrete shape of two already-open threads — the og-pipeline note's descoped "owner share affordance" and the still-open "WebShare API (share button UX shape)" idea. Every share is portfolio marketing. Scope: new OG endpoint variant(s) keyed by chapter, share button per chapter following the subject-chapter design-spec interaction patterns, palette verb (`share …`) per the [palette convention](../../repo-conventions.md#extend-the-command-palette-when-adding-filterable-surfaces).

## F2 — `/code` stream (GitHub + WakaTime)

[repo-conventions.md](../../repo-conventions.md) already reserves the route ("future streams get their own — `/code` for GitHub + WakaTime"). Strongest freelance-positioning move available: the gaming dashboard becomes a self-portrait that also shows engineering activity, and the chronotype synthesis on `/` gets its second real stream (commits × games is exactly the cross-stream verdict `/` was designed for). Before scoping: read [api-client-consolidation.md](api-client-consolidation.md) (standing instruction before any new upstream integration) and follow the per-stream route rules — `/code` owns its subtree, `/` gets at most one curated highlight. This is a multi-session arc; needs its own working note + chunk plan when picked.

## F3 — Achievement-hunting planner ("nearest 100%")

**Promoted 2026-09-05** → [steam/achievement-completion-planner.md](../steam/achievement-completion-planner.md); the scoring there replaces the "count × average rarity" sketch below.

All data exists server-side already: per-game completion and global rarity ([global-rarity poller](../../../apps/api/src/steam/global-rarity.poller.ts)). Rank owned games by remaining-achievement count × average rarity to surface "3 achievements from 100%, all common". Turns stored Steam data into an actionable surface with **zero new upstream calls**. Natural home: `/steam/achievements` section; palette grammar extension (`100% candidates`) in the same change. Cross-check [steam-api-unused-data.md](steam-api-unused-data.md) for adjacent fields worth surfacing in the same pass.

## F4 — Steam wishlist price-watch

Rider on the in-flight wishlist-upcoming work (`docs/working-notes/steam/wishlist-upcoming.md`): record price snapshots during the existing wishlist poll, surface deltas / discount badges on the wishlist surface. Pure derivative of data already polled hourly-ish; the only new cost is a small price-snapshot table. Scope it as an extension of that note's arc rather than a standalone — promote into the wishlist note when that arc lands its base shape.

## Overlap map — already owned elsewhere

- **"On this day" flashback tile on `/`** → already tracked as **"Same day last year"** in [vnext-ideas.md](vnext-ideas.md) (unpromoted top-tier). The audit independently re-derived it; treat that as a +1 signal for promotion, not a new entry.
- **Match journaling (owner-auth'd notes feeding recap detectors)** → already tracked as **match annotations** in [vnext-ideas.md](vnext-ideas.md). Audit addendum worth carrying over when promoted: annotations could partially unblock the R-7i secondary detectors that are parked pending real activity patterns ([self-portrait-recap-arc.md](self-portrait-recap-arc.md)) by providing explicit self-labelled signal.
