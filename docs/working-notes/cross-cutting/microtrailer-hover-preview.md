# Microtrailer hover-preview on Steam library tiles

**Status:** Planned arc — surfaced from the 2026-05-24 `IStoreBrowseService/GetItems` field-harvest session ([library-card-enrichment.md Chunk 7](../steam/library-card-enrichment.md)). Tier 2 of the [elevation-arcs.md](./elevation-arcs.md) index. Indexed there and in [motion-backlog.md](./motion-backlog.md).

The pitch: on hover, a Steam library tile reveals the game's official 6-second silent microtrailer in place, looping until the cursor leaves. This is literally what the Steam storefront grid does on its own homepage — applying it to the owner's *personal* library makes the surface feel as native as Steam itself, while turning the library into a much more visually alive browsing surface.

---

## What we're working with

`trailers.highlights[].microtrailer[]` returns:

```json
{
  "microtrailer": [
    { "filename": "3489700/2090056095/.../microtrailer.webm", "type": "video/webm" },
    { "filename": "3489700/2090056095/.../microtrailer.mp4",  "type": "video/mp4"  }
  ]
}
```

- 6-second silent loops, ~1-2 MB each (~300-500 KB webm, larger mp4 fallback).
- `highlights[]` is an array; index `[0]` is the launch trailer in most cases. We use `[0]` only; lower-priority trailers stay unused.
- CDN-served via `https://cdn.cloudflare.steamstatic.com/steam/apps/{filename}` style. Webm should be preferred (smaller, AV1 support); mp4 is the Safari/legacy fallback handled by `<source>` order in `<video>`.

The `highlights[0]` also exposes:
- `screenshot_medium` / `screenshot_full` — poster frame to render before hover / when reduced-motion is active.
- `trailer_name` — "Full Launch trailer" etc., useful for `aria-label` and tooltip on tap surfaces.
- `adaptive_trailers` — DASH/HLS streams for the eventual game-detail trailer modal (out of scope for this arc; see [library-card-enrichment.md Chunk 7 → game-detail extension](../steam/library-card-enrichment.md)).

---

## Architecture

### Where it renders

- **`/steam/library`** — both the virtualised list and grid variants ([library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx), [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx)). Hover-armed autoplay.
- **`/steam`** landing — the `OwnedGamesChip` / recently-played strip is too small for microtrailers to read; defer until UX proves it adds anything.
- **`/steam/game/$appid`** — small "▶ Preview" pill anchored to the hero banner (bottom-right, opposite the existing logo overlay). Click opts the user into a hero crossfade from static `library_hero` to the looping microtrailer; the same pill toggles to "✕" to dismiss back to the static hero. Opt-in deliberately — autoplay on a page the user is dwelling on reads as restless, and opt-in keeps the existing library→game-detail view-transition morph landing cleanly on the static hero every time. The full-fidelity `adaptive_trailers` modal (DASH/HLS, audio, native resolution) is the staged follow-up — see § Staged path.

### Lifecycle

Hover-only on pointer devices. On touch, microtrailers stay static — autoplay on scroll would burn battery and bandwidth without intent.

Per-tile state machine:
1. **Idle** — render the poster frame (`screenshot_medium` or the existing `library_capsule` art, whichever reads cleaner).
2. **Hover armed** — after 200ms hover (debounce against scroll-by-cursor jitter), preload `microtrailer.webm` via `<video preload="metadata">`. Start playing once `canplaythrough` fires.
3. **Hover active** — `<video autoplay muted loop playsinline>` swaps in over the poster with a 200ms cross-fade.
4. **Hover lost** — fade back to poster, dispose the `<video>` element (don't keep it mounted; see § Concurrency budget).

`prefers-reduced-motion` collapses steps 2-4 — render the poster only, never mount video.

### Concurrency budget

This is the load-bearing constraint that makes this arc-grade instead of quick-win. A library tile grid renders 20-40 cards in the viewport at any time. If every hover spawns a `<video>`, hover-scrolling across the grid leaves dozens of decoded video buffers in GPU memory — Chromium will start hard-tearing-down after ~75 concurrent `<video>` elements ([known limit](https://chromestatus.com/feature/5764438100279296)), Safari is stricter (~16), Firefox sits between.

Rules:
- **At most one microtrailer playing at a time across the whole grid.** The hovered tile owns the slot; new hover → previous tile fades out, video disposed, new tile takes over.
- **Cleanup is synchronous on hover-out.** `<video>` element unmounts; `URL.revokeObjectURL()` if we ever blob-cache (we shouldn't); `videoEl.src = ''; videoEl.load();` to release decoder.
- **No preloading except the hovered tile.** No "predict the next hover" speculative preloads — first version stays simple.

Implementation note: hoist the "currently playing tile" into a context near the virtualiser, so the singleton enforcement doesn't depend on prop-drilling through the grid lanes.

The game-detail "▶ Preview" pill is outside this budget — only one game-detail page renders at a time, single `<video>` element, opt-in by click. No singleton hook needed there; the page-local component owns its own play/stop state.

### Hovercard popover coexistence

The existing [library-tile-hovercard](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) rotates `screenshots` through its hero strip with a 2.5s interval. When the underlying tile starts playing a microtrailer, two motion sources fire at the same time on the same hover gesture — the in-tile trailer playback and the popover screenshot rotation, visually adjacent. Reads as noisy.

Rule: when the tile has a microtrailer available, the popover's hero strip stays on the static `library_hero` and the rotation is suppressed. The microtrailer IS the moving signal; the popover becomes the info-dense companion (title, lifetime/2-week/last-played, short description). Screenshot rotation remains the popover behaviour for games **without** a microtrailer — the rotation becomes the no-trailer fallback path rather than a parallel feature.

Implementation: the hovercard component reads the same enrichment field the tile uses (`microtrailerWebm != null`) and branches once at render. No shared state needed.

### Asset proxying

Microtrailer URLs go through the existing image-proxy pipeline pattern — see [steam-integration.md Phase S3 Chunk 3](../steam/steam-integration.md). Don't hotlink Steam CDN from the browser; route through the API to:
1. Decouple from Steam CDN URL drift (the `?t=` cache-buster pattern still applies, captured via `assetTimestamp`).
2. Preserve the existing CSP `media-src` discipline (single origin).
3. Allow future caching at the API layer if needed.

The img controller might need a `media` cousin for `video/webm` + `video/mp4` content-types. Decide at scoping time whether to extend `img.controller.ts` or fork a `media.controller.ts`. Lean: extend, with the controller logic gated on content-type.

---

## Motion guardrails (from elevation-arcs.md / motion-backlog.md)

- **Bold OK, loud not OK.** A silent microtrailer that smoothly cross-fades on a 200ms debounced hover is bold (visible craft, no other personal-library surface does this). It would be loud if it auto-played on viewport entry, used audio, or played multiple tiles simultaneously.
- **No confetti, no slot-machine, no tacky gradients.** The microtrailers themselves are publisher-supplied; we have no control over their content. The cross-fade is the only motion this arc adds — pure CSS, no spring.
- **Calm aesthetic wins.** 200ms hover debounce is the calm-vs-twitchy lever. If user testing (just the owner) flags it as too eager, dial up to 350ms. Too sluggish, dial down to 120ms.
- **Reduced-motion variant.** Static poster frame, never mount `<video>`. Documented in the [reduced-motion-replacements.md](./reduced-motion-replacements.md) audit.

---

## Engine-perf considerations

Per [feedback_engine_gate_perf_cliffs](../../../docs/working-notes/cross-cutting/safari-vt-snapshot-cost.md) — Safari/WebKit has historically been the cliff. For microtrailers specifically:

- **Hardware video decode** — both WebKit and Blink hardware-decode H.264 reliably; AV1 hardware decode is Apple-Silicon-only on Safari (M1+), Linux WebKit and older Macs fall back to software. Use webm (likely VP9/AV1 inside) as the primary `<source>`, mp4/H.264 as the universal fallback in `<source>` order. Browser picks the first decodable.
- **Composite-only** — `<video>` already paints onto its own GPU surface; the cross-fade between poster and video should be a CSS `opacity` transition on stacked elements, not a CSS `filter` or `mix-blend-mode` operation. Keep both in the composite-only family.
- **No interaction with VT.** The library-tile VT (existing single-element morph, shipped 2026-05-24, [view-transitions-rollout.md](./view-transitions-rollout.md)) does the hero/logo continuity into game-detail. Microtrailer hover state is suppressed during VT and resumes after the transition finishes — the existing `getNavigationType` gate already covers this implicitly if the hover handler reads `document.startViewTransition`'s `ready` promise. Worth a test.
- **Cross-fade vs hard cut.** A hard cut at hover-on saves the cross-fade entirely; could be a measurable Safari-perf win if the cross-fade ever turns out to interact poorly with the existing tile motion. Default to cross-fade; A/B against hard cut if Safari measurement flags it.

If Safari turns out to be a cliff anyway (snapshot cost during library scroll + video decode contention), apply the same `isWebKit()` gate as the Steam VT bypass — show static posters on WebKit, full microtrailers on Blink/Gecko. Don't pre-emptively gate; measure first.

---

## Data layer

- Per-game `microtrailerWebm` + `microtrailerMp4` + `microtrailerPoster` fields on `SteamGameEnrichment` (or a single `trailers Json` column — TBD at chunk-1 time; flat is easier to render, JSON is easier to evolve).
- Field captured via [library-card-enrichment.md Chunk 0](../steam/library-card-enrichment.md) (umbrella `include_trailers: true` flip).
- Backfill: re-run the enrichment poller across the library. Idempotent upsert. ~167 games (current owned count) × ~1s per `GetItems` batch of 50 = under 5 minutes wall time.
- **Cache-buster:** publishers occasionally re-upload trailer files; the `asset_url_format` ?t= timestamp already drives the existing asset refresh. Trailer paths share the same upstream timestamp, so the existing refresh logic catches updates for free.

---

## Chunk plan

1. **Chunk 1 — Enrichment capture + types.** Land after [library-card-enrichment.md Chunk 0](../steam/library-card-enrichment.md). Add `microtrailerWebm`, `microtrailerMp4`, `microtrailerPoster`, `microtrailerName` fields to `SteamGameEnrichment` + `projectEnrichment`. Migration + projection only; no render yet. Test: a probed-fixture-driven unit test on `projectEnrichment` asserts the fields populate from the raw trailer block.
2. **Chunk 2 — Singleton hover-player primitive.** New `apps/web/src/steam/library/use-microtrailer-slot.ts` context + hook enforcing the "one playing tile at a time" invariant. Pure state, no render. Tested in isolation via React Testing Library — claim/release semantics, hand-off between tiles, cleanup on unmount.
3. **Chunk 3 — Tile-level integration in the virtualised list.** `library-list-virtual.tsx` tile wraps in a `<MicrotrailerSlot>` component that consumes the singleton hook. Hover handler with 200ms debounce. Cross-fade between poster and `<video>`. `prefers-reduced-motion` shortcut. Same change suppresses the hovercard's screenshot rotation when the tile has a microtrailer (per § Hovercard popover coexistence). Axe scan (per [repo-conventions.md § Testing](../../repo-conventions.md)) — the `<video>` needs `aria-label` from `trailer_name`, the surrounding link still owns navigation.
4. **Chunk 4 — Grid variant.** Apply to `library-grid-virtual.tsx`. Same component, different tile shape. Should be a pure visual port.
5. **Chunk 5 — Game-detail "▶ Preview" pill.** Page-local component on `/steam/game/$appid` (no singleton hook — single page, single video). Pill anchored bottom-right of the hero banner, gated on `microtrailerWebm != null`. Click swaps the hero from static `library_hero` to `<video muted loop playsinline>` with a 200ms crossfade; same pill toggles to "✕" to dismiss. Default state stays static so the library→game-detail VT morph on the `steam-game-${appid}-hero` anchor lands cleanly every time. `prefers-reduced-motion` doesn't suppress the pill itself (the click is explicit consent), but the crossfade collapses to a hard cut for that branch. One commit, no library-side coupling.
6. **Chunk 6 — Polish + telemetry.** Web Vitals impact measurement (does INP regress on library hover? does the game-detail page TTFB / LCP shift when the trailer asset is preloaded vs lazy?). Bandwidth budget audit (count how many microtrailers a typical session loads across both surfaces). Optional: cap microtrailers-per-session to N to prevent runaway bandwidth on enthusiastic scroll-hover sessions.

---

## Acceptance criteria

- **C1:** library tiles render today's static art exactly as before; the enrichment row gains the new fields; one focused commit.
- **C2:** the singleton hook ships with unit tests covering claim, release, hand-off, double-claim race.
- **C3:** hovering a tile after 200ms swaps in a 6-second silent looping microtrailer with a 200ms cross-fade; hovering a second tile cuts the first; leaving disposes the `<video>`; reduced-motion users see only the poster. Hovercard popover stops rotating screenshots when the tile has a trailer (static `library_hero` instead). Axe scan clean.
- **C4:** same behavior in the grid view.
- **C5:** game-detail hero shows the "▶ Preview" pill when a microtrailer exists; clicking crossfades to the looping video and toggles the pill to "✕"; dismissing restores the static hero. VT morph from library row → game-detail still lands on the static `library_hero` as today (default-static is the contract).
- **C6:** Lighthouse INP on `/steam/library` stays within 10% of baseline; game-detail LCP doesn't regress (the pill is opt-in so the trailer asset isn't preloaded); bandwidth-per-session has a documented ceiling.

---

## Staged path

The microtrailer is the entry-level rung of a longer trailer story:

1. **This arc — microtrailer everywhere it fits.** Library hover (auto on hover) + game-detail "▶ Preview" pill (opt-in click). 6-second silent loops, ~1-2 MB each, no player infrastructure beyond `<video muted loop playsinline>`.
2. **Follow-up arc — `adaptive_trailers` modal on game-detail.** When the "▶ Preview" pill no longer satisfies (users want the full trailer, with audio, at native resolution), upgrade the click target to open a modal with a DASH/HLS player consuming `highlights[0].adaptive_trailers`. The pill becomes the entry point — "▶ Preview" stays as the label or upgrades to "▶ Watch trailer" depending on which path is taken. The pill placement, the hero crossfade, the gating on `microtrailerWebm != null` (or a richer "trailer available" check) all carry over; only the click handler changes.
3. **Optional further rung — screenshot lightbox.** Already exists in [game-screenshot-strip.tsx](../../../apps/web/src/steam/game/game-screenshot-strip.tsx); call out as the precedent for the trailer modal's chrome.

Shipping rung 1 first keeps the data layer ([library-card-enrichment.md Chunk 0](../steam/library-card-enrichment.md) already flipped `include_trailers: true`) doing double duty: every captured microtrailer is the source of both surfaces.

---

## Out of scope (capture for follow-ups)

- **Tap-to-preview on touch.** Long-press → preview overlay. Mobile-specific UX, defer until iPad case-study work.
- **Screenshot fan-out on hover.** If microtrailer is missing (some older games), could fan a few screenshots instead. Defer; not every tile needs animation. Note that the [library-tile-hovercard](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) popover already rotates screenshots — this is about the *tile itself* fanning, distinct from the popover rotation.
- **Audio toggle.** Microtrailers are silent by design; not relevant. Becomes relevant in the `adaptive_trailers` modal rung — that's where an audio control makes sense.

---

## References

- [library-card-enrichment.md](../steam/library-card-enrichment.md) — umbrella roadmap, this arc is Chunk 7 there.
- [elevation-arcs.md](./elevation-arcs.md) — Tier 2 index entry.
- [motion-backlog.md](./motion-backlog.md) — cross-listed under High impact (steam library).
- [safari-vt-snapshot-cost.md](./safari-vt-snapshot-cost.md) — engine-cliff handling pattern if Safari needs `isWebKit()` gate.
- [reduced-motion-replacements.md](./reduced-motion-replacements.md) — owner of the per-surface reduced-motion audit; this arc registers its replacement variant there when shipped.
- [view-transitions-rollout.md](./view-transitions-rollout.md) — existing tile VT; hover suppression during transitions.
- [repo-conventions.md § Virtualize only when…](../../repo-conventions.md) — informs the grid/list virtualiser interactions.
