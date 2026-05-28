# Microtrailer hover-preview on Steam library tiles

**Status:** Chunk 1 shipped 2026-05-28 (b242811). Chunk 2 next. Surfaced from the 2026-05-24 `IStoreBrowseService/GetItems` field-harvest session ([library-card-enrichment.md Chunk 7](../steam/library-card-enrichment.md)). Tier 2 of the [elevation-arcs.md](./elevation-arcs.md) index. Indexed there and in [motion-backlog.md](./motion-backlog.md).

The pitch: when you hover a library row or tile, the existing right-side hovercard's media slot plays the game's 6-second silent microtrailer in place of its current static screenshot rotation. The hovercard is already a deliberate "preview this game" surface; the trailer just makes that preview move. Library row/capsule artwork stays untouched — the visual identity work that just shipped (dominantHex theming, hero-flip, face-aware crop) keeps its weight.

**Why hovercard instead of tile-level (2026-05-28 redesign):** earlier draft of this arc put the trailer on the tile itself. Walking through the actual list/grid screenshots and reading the hovercard code, the right surface is the existing hovercard:

- Hovercard hover is **deliberate** (sustained cursor on one row/tile), so the "rapid mouseover spawns 30 short-lived video elements" problem from the tile-level plan never materialises.
- Radix already **singleton-enforces** the hovercard (one open at a time, unmounts on close). No `use-microtrailer-slot` context/hook needed.
- The hovercard slot is **16:9-ish** (`aspect-[2/1]`), matching the microtrailer's native shape (854×480). The grid view's `library_capsule` is portrait — putting a 16:9 video there would mean letterbox or crop, both visually wrong.
- The hovercard is the **same component** for list and grid view — one integration site instead of two.
- Touch users get no hovercard today; no regression introduced.

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
- `screenshot_medium` — poster frame for the reduced-motion fallback and the `<video>` `poster` attribute.
- `trailer_name` — "Full Launch trailer" etc., used for `aria-label`.
- `adaptive_trailers` — DASH/HLS streams for the eventual game-detail trailer modal (out of scope for this arc; see [library-card-enrichment.md Chunk 7 → game-detail extension](../steam/library-card-enrichment.md)).

---

## Architecture

### Where it renders

- **Hovercard inside `/steam/library`** (both virtualised list and grid). Single integration site: [library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx). Library tile artwork is unchanged.
- **`/steam/game/$appid`** — optional follow-up. Small "▶ Preview" pill anchored to the hero banner (bottom-right), click swaps static `library_hero` → looping microtrailer with crossfade. Deferred to Chunk 4 (optional); shippable independently.

The hovercard `LibraryTileHovercardContent` already owns:
- A 2:1 media slot stacked over a `library_hero` base layer with a `header.jpg` fallback.
- A screenshot query (`useGameScreenshots`) that fires on first hover and cross-fades through screenshots every `SCREENSHOT_ROTATION_MS`.
- Title, short description, time-played stats below the media slot.

### Integration shape

When the hovered game has a microtrailer:
1. **Skip the screenshot rotation entirely.** The `useEffect` setting up the interval gates on the same `microtrailerWebm != null` check.
2. **Replace the screenshot stack with a single `<video autoplay muted loop playsinline>`** mounted over the hero base. Sources: webm first, mp4 second, `<source>` order picks the first decodable codec per UA. `poster` attribute uses `microtrailerPoster`.
3. **Aspect handling**: slot is 2:1, video is 16:9. `object-cover` crops ~6% top/bottom — preferred to the letterbox alternative.
4. **Cross-fade behaviour**: the existing pattern (hero base → media layer on `onLoadedData`) carries through. The hovercard's hero "snaps in first" rule still applies (no fade from black on initial mount).
5. **`aria-label`** from `trailer_name` on the `<video>`. The hovercard's link wrapping (if any) keeps owning navigation.

When the game has no microtrailer:
- Existing screenshot rotation runs unchanged. Same hook, same intervals, same scrim.

### Concurrency

Radix's hovercard primitive only mounts content while open and unmounts on close. Only one hovercard is ever open at a time. So at most one `<video>` element exists at a time, and it's torn down the moment the hovercard closes — the singleton invariant is enforced by the host primitive, not by app code.

No `use-microtrailer-slot` hook needed. No context. No claim/release semantics.

### Reduced motion

`prefers-reduced-motion: reduce` → render an `<img src={microtrailerPoster}>` in place of the `<video>`. Same slot, same aspect handling, no rotation, no crossfade. Registers in [reduced-motion-replacements.md](./reduced-motion-replacements.md) when shipped.

### Asset proxying

Microtrailer URLs go through the existing image-proxy pipeline pattern — see [steam-integration.md Phase S3 Chunk 3](../steam/steam-integration.md). Don't hotlink Steam CDN from the browser; route through the API to:
1. Decouple from Steam CDN URL drift (the `?t=` cache-buster pattern still applies, captured via `assetTimestamp`).
2. Preserve the existing CSP `media-src` discipline (single origin).
3. Allow future caching at the API layer if needed.

The img controller might need a `media` cousin for `video/webm` + `video/mp4` content-types. Decide at Chunk 2 scoping whether to extend `img.controller.ts` or fork a `media.controller.ts`. Lean: extend, with the controller branched on content-type.

---

## Motion guardrails (from elevation-arcs.md / motion-backlog.md)

- **Bold OK, loud not OK.** A silent microtrailer playing inside a deliberate-hover hovercard is bold — the hovercard is the user's stated "I want to know more about this game" surface. It would be loud if the trailer played on row hover before the hovercard opened, or auto-played on viewport entry.
- **No confetti, no slot-machine, no tacky gradients.** The microtrailers themselves are publisher-supplied; we have no control over their content. The crossfade is the only motion this arc adds — pure CSS opacity, no spring.
- **Calm aesthetic wins.** The existing hovercard's open delay (Radix `openDelay`) is the calm-vs-twitchy lever and is already tuned. No new debounce introduced.
- **Reduced-motion variant.** Static poster image, never mount `<video>`. Documented in the [reduced-motion-replacements.md](./reduced-motion-replacements.md) audit.

---

## Engine-perf considerations

Per [feedback_engine_gate_perf_cliffs](./safari-vt-snapshot-cost.md) — Safari/WebKit has historically been the cliff. For this redesigned shape:

- **Hardware video decode** — both WebKit and Blink hardware-decode H.264 reliably; AV1 hardware decode is Apple-Silicon-only on Safari (M1+), Linux WebKit and older Macs fall back to software. Use webm (likely VP9/AV1 inside) as the primary `<source>`, mp4/H.264 as the universal fallback in `<source>` order. Browser picks the first decodable.
- **Composite-only crossfade** — `<video>` already paints onto its own GPU surface; the fade between hero and video is a CSS `opacity` transition on stacked elements, not a `filter` or `mix-blend-mode` operation. Keep both in the composite-only family.
- **Hovercard lifecycle absorbs decoder cost** — the `<video>` only ever mounts inside an open hovercard, so the decoder is set up during deliberate hover rather than during library scroll. The earlier concern about Safari's snapshot cost during scroll + concurrent video decode is structurally gone.
- **No interaction with VT.** The library-tile VT (existing single-element morph, shipped 2026-05-24, [view-transitions-rollout.md](./view-transitions-rollout.md)) does the hero/logo continuity into game-detail. Hovercard auto-closes before navigation, so no overlap.

If Safari still turns out to be a cliff (e.g. hover-decode-hover-decode burst across rapid hovers), apply the same `isWebKit()` gate as the Steam VT bypass — show the static poster on WebKit, full microtrailers on Blink/Gecko. Don't pre-emptively gate; measure first.

---

## Data layer

- Per-game `microtrailerWebm` + `microtrailerMp4` + `microtrailerPoster` + `microtrailerName` fields on `SteamGameEnrichment` (flat columns, nullable strings — Chunk 1 shipped).
- **Exposed on `SteamOwnedGame`**, not the `useGameScreenshots` query. The microtrailer is library-shaped row metadata (lives with the row, available before hover), and threading it through `SteamOwnedGame` keeps the game-detail screenshot strip's query response at zero diff — the strip doesn't consume `SteamOwnedGame` so it never sees the new fields.
- Field captured via [library-card-enrichment.md Chunk 0](../steam/library-card-enrichment.md) (umbrella `include_trailers: true` flip, already shipped).
- Backfill: re-run the enrichment poller across the library. Idempotent upsert. ~167 games (current owned count) × ~1s per `GetItems` batch of 50 = under 5 minutes wall time.
- **Cache-buster:** publishers occasionally re-upload trailer files; the `asset_url_format` ?t= timestamp already drives the existing asset refresh. Trailer paths share the same upstream timestamp, so the existing refresh logic catches updates for free.

---

## Chunk plan

1. ✅ **Chunk 1 — Enrichment capture + types** (shipped 2026-05-28, commit b242811). Added `microtrailerWebm`/`Mp4`/`Poster`/`Name` to `SteamGameEnrichment` + projection + 4 unit tests on `projectEnrichment`.
2. **Chunk 2 — API surface.** Thread the 4 microtrailer fields through `SteamOwnedGame` (api response → `@vyoh/shared` type → web consumer). Image-proxy extension for `video/webm` + `video/mp4` content-types (decide extend `img.controller.ts` vs fork `media.controller.ts` at scoping). Tests on the api side; type-only assertion on the shared package.
3. **Chunk 3 — Hovercard integration.** In [library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx): branch once on `game.microtrailerWebm != null`. Branch A renders `<video autoplay muted loop playsinline poster={poster}>` over the hero base, sources webm + mp4, `aria-label={trailerName}`, skips the rotation `useEffect`. Branch B keeps today's screenshot rotation. `prefers-reduced-motion` collapses Branch A to `<img src={poster}>`. Axe scan addition to the existing hovercard test. Per [repo-conventions.md § Testing](../../repo-conventions.md), tests live in the same commit.
4. **Chunk 4 (optional) — Game-detail "▶ Preview" pill.** Page-local component on `/steam/game/$appid`. Pill anchored bottom-right of the hero banner, gated on `microtrailerWebm != null`. Click swaps the hero from static `library_hero` to `<video muted loop playsinline>` with a 200ms crossfade; same pill toggles to "✕" to dismiss. Default state stays static so the library→game-detail VT morph on the `steam-game-${appid}-hero` anchor lands cleanly every time. `prefers-reduced-motion` doesn't suppress the pill itself (the click is explicit consent), but the crossfade collapses to a hard cut. Independent of Chunks 2/3; can ship separately whenever the polish budget allows.

---

## Acceptance criteria

- **C1 (shipped):** library tiles render today's static art exactly as before; the enrichment row gains the new fields; one focused commit (b242811).
- **C2:** the 4 microtrailer fields surface on `SteamOwnedGame` end-to-end (api → shared → web). The game-detail screenshot strip's query response is byte-identical to before. The image-proxy serves `video/webm` and `video/mp4` content-types with appropriate Cache-Control.
- **C3:** hovering a library row or tile opens the hovercard as today; if the game has a microtrailer, the media slot plays a 6-second silent looping `<video>` instead of the screenshot rotation; reduced-motion users see a static `<img>` of `microtrailerPoster` in the same slot. Games without a microtrailer fall back to the existing rotation, unchanged. Axe scan clean. Closing the hovercard tears down the `<video>` synchronously (Radix-driven).
- **C4 (optional):** game-detail hero shows the "▶ Preview" pill when a microtrailer exists; clicking crossfades to the looping video and toggles the pill to "✕"; dismissing restores the static hero. VT morph from library row → game-detail still lands on the static `library_hero` as today.

---

## Staged path

The microtrailer is the entry-level rung of a longer trailer story:

1. **This arc — microtrailer in the hovercard.** Hover-driven, deliberate, singleton-by-construction. 6-second silent loops, ~1-2 MB each, no player infrastructure beyond `<video muted loop playsinline>`.
2. **Optional Chunk 4 — game-detail "▶ Preview" pill.** Same asset, opt-in surface on game-detail.
3. **Follow-up arc — `adaptive_trailers` modal on game-detail.** When the "▶ Preview" pill no longer satisfies (users want the full trailer, with audio, at native resolution), upgrade the click target to open a modal with a DASH/HLS player consuming `highlights[0].adaptive_trailers`. The pill becomes the entry point; pill placement, gating, and crossfade all carry over.
4. **Optional further rung — screenshot lightbox.** Already exists in [game-screenshot-strip.tsx](../../../apps/web/src/steam/game/game-screenshot-strip.tsx); call out as the precedent for the trailer modal's chrome.

Shipping rung 1 first keeps the data layer ([library-card-enrichment.md Chunk 0](../steam/library-card-enrichment.md) already flipped `include_trailers: true`) doing double duty: every captured microtrailer is the source of both surfaces.

---

## Out of scope (capture for follow-ups)

- **Tile-level reveal.** Considered and rejected on 2026-05-28 in favour of the hovercard slot — see § the pitch / why hovercard reasoning. Could revisit if a future redesign drops the hovercard entirely; until then, library tiles stay static.
- **Tap-to-preview on touch.** Long-press → preview overlay. Mobile-specific UX, defer until iPad case-study work. The hovercard itself doesn't fire on touch today, so touch users see no change.
- **Audio toggle.** Microtrailers are silent by design; not relevant. Becomes relevant in the `adaptive_trailers` modal rung — that's where an audio control makes sense.
- **Predictive preload.** No "preload the next likely hovered tile" speculation. The hovercard's open delay already paces requests; staying simple.

---

## References

- [library-card-enrichment.md](../steam/library-card-enrichment.md) — umbrella roadmap, this arc is Chunk 7 there.
- [elevation-arcs.md](./elevation-arcs.md) — Tier 2 index entry.
- [motion-backlog.md](./motion-backlog.md) — cross-listed under High impact (steam library).
- [safari-vt-snapshot-cost.md](./safari-vt-snapshot-cost.md) — engine-cliff handling pattern if Safari needs `isWebKit()` gate.
- [reduced-motion-replacements.md](./reduced-motion-replacements.md) — owner of the per-surface reduced-motion audit; this arc registers its replacement variant there when shipped.
- [view-transitions-rollout.md](./view-transitions-rollout.md) — existing tile VT; hovercard auto-closes pre-navigation.
- [library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) — the integration site.
