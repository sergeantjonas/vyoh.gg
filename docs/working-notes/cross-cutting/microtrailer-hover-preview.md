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

- **`/steam/library`** — both the virtualised list and grid variants ([library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx), [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx)).
- **`/steam`** landing — the `OwnedGamesChip` / recently-played strip is too small for microtrailers to read; defer until UX proves it adds anything.
- **`/steam/game/$appid`** — NOT this arc. That page gets the full `adaptive_trailers` modal (separate arc).

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
3. **Chunk 3 — Tile-level integration in the virtualised list.** `library-list-virtual.tsx` tile wraps in a `<MicrotrailerSlot>` component that consumes the singleton hook. Hover handler with 200ms debounce. Cross-fade between poster and `<video>`. `prefers-reduced-motion` shortcut. Axe scan (per [repo-conventions.md § Testing](../../repo-conventions.md)) — the `<video>` needs `aria-label` from `trailer_name`, the surrounding link still owns navigation.
4. **Chunk 4 — Grid variant.** Apply to `library-grid-virtual.tsx`. Same component, different tile shape. Should be a pure visual port.
5. **Chunk 5 — Polish + telemetry.** Web Vitals impact measurement (does INP regress on library hover?). Bandwidth budget audit (count how many microtrailers a typical session loads). Optional: cap microtrailers-per-session to N to prevent runaway bandwidth on enthusiastic scroll-hover sessions.

---

## Acceptance criteria

- **C1:** library tiles render today's static art exactly as before; the enrichment row gains the new fields; one focused commit.
- **C2:** the singleton hook ships with unit tests covering claim, release, hand-off, double-claim race.
- **C3:** hovering a tile after 200ms swaps in a 6-second silent looping microtrailer with a 200ms cross-fade; hovering a second tile cuts the first; leaving disposes the `<video>`; reduced-motion users see only the poster. Axe scan clean.
- **C4:** same behavior in the grid view.
- **C5:** Lighthouse INP on `/steam/library` stays within 10% of baseline; bandwidth-per-session has a documented ceiling.

---

## Out of scope (capture for follow-ups)

- **Game-detail full trailer modal.** Uses `adaptive_trailers` (DASH/HLS) not microtrailers. Separate arc — would slot well after this one lands.
- **Tap-to-preview on touch.** Long-press → preview overlay. Mobile-specific UX, defer until iPad case-study work.
- **Screenshot fan-out on hover.** If microtrailer is missing (some older games), could fan a few screenshots instead. Defer; not every tile needs animation.
- **Audio toggle.** Microtrailers are silent by design; not relevant.

---

## References

- [library-card-enrichment.md](../steam/library-card-enrichment.md) — umbrella roadmap, this arc is Chunk 7 there.
- [elevation-arcs.md](./elevation-arcs.md) — Tier 2 index entry.
- [motion-backlog.md](./motion-backlog.md) — cross-listed under High impact (steam library).
- [safari-vt-snapshot-cost.md](./safari-vt-snapshot-cost.md) — engine-cliff handling pattern if Safari needs `isWebKit()` gate.
- [reduced-motion-replacements.md](./reduced-motion-replacements.md) — owner of the per-surface reduced-motion audit; this arc registers its replacement variant there when shipped.
- [view-transitions-rollout.md](./view-transitions-rollout.md) — existing tile VT; hover suppression during transitions.
- [repo-conventions.md § Virtualize only when…](../../repo-conventions.md) — informs the grid/list virtualiser interactions.
