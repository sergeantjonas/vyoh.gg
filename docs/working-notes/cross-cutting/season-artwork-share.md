# Generative season artwork + shareable recap chapters (F1)

**Status:** Active — ridge chosen 2026-08-09, shared generator + recap hero band shipped the same day; next is chunk 3, the OG share cards.

One arc covering two halves that halve each other's cost: a deterministic artwork generator seeded from the owner's season match data, surfacing as (a) an editorial hero layer on the LoL recap route and (b) the background of shareable per-chapter OG cards — feature candidate F1 from [feature-candidates-2026-06.md](feature-candidates-2026-06.md), artwork spec from [visual-differentiation-pool.md](visual-differentiation-pool.md), prioritised in the 2026-08-01 payoff queue.

## Decisions

- **Hero surface is `/lol/$accountSlug/recap`**, not `/`. The artwork is LoL-seeded, and `/` is cross-stream synthesis only (repo convention). A cross-stream variant on `/` is a possible later arc, not this one.
- **Share scope starts with the flagship pair**: the Ahri subject chapter and the Conclusion chapter. Other chapters follow the same shape once the pattern holds.
- **Constraints (from the pool note, non-negotiable):** deterministic — same season data in, same artwork out; static output, no rAF loop; palette drawn from existing champion accent colors (`championTheme().dominantHex`) and neutral app tokens, no new color system; aesthetic target is data-art prints, not shader demos; cards show owner-public data only.
- **The gate is rendered output.** If none of the metaphors earn a place, the F1 share bridge still proceeds using the existing splash/hero visual language, and the generator half is dropped without a replacement.
- **Verdict (2026-08-09): ridge.** Chosen for narrative fit — the win/loss walk carries a real season arc, works at both hero and OG aspect ratios, and using one artwork on both surfaces gives the share loop continuity (the card teases the image the click-through delivers). Weave is the reserve if ridge reads too chart-like on the live page, and a candidate for per-chapter differentiation later; not built now. Knots dropped — weakest at OG dimensions.

## Chunks

0. **Metaphor prototypes** — render 2–3 candidates from the real match window as static SVGs, owner judges the images. *(done — ridge chosen)*
1. **Shared generator** — `renderSeasonRidge()` in [packages/shared/src/lol/season-artwork.ts](../../../packages/shared/src/lol/season-artwork.ts) (flat file per the lol-domain layout, not the planned `artwork/` folder — one metaphor shipped, a folder earns itself if weave ever lands). Pure function `SeasonArtworkMatch[] → SVG string`, transparent by default with an opt-in solid background (hero band vs OG card), colors resolved by the caller, tests pin determinism + the malformed-hex guard. Verified pixel-identical to the judged prototype against the real 564-match window through the api's resvg. *(done 2026-08-09)*
2. **Recap hero band** — `RecapSeasonThread` in [apps/web/src/lol/recap/recap-season-thread.tsx](../../../apps/web/src/lol/recap/recap-season-thread.tsx), mounted between the header and the rank arc on `/lol/$accountSlug/recap`. Editorial bare band (eyebrow → artwork → caption cascade; the artwork's hero entrance is a left-to-right `clip-path` draw-on, 1.4 s), mirrored skeleton, `role="img"` + label, axe in the component test. Owns its own `useCachedMatchesWindow(account, 2000)` fetch — the recap layout window defaults to 20 matches, so the "already in the Query cache" assumption from chunk 0 was wrong; 2000 shares the champion table's cache key, and per-chapter fetches were already the recap idiom (`useDuos(account, 200)`). All queues, remakes excluded, sorted oldest→first — same projection as the judged prototype. Perf: new `lol-recap` probe scenario + budget row (this route had none; the `recap` scenario measures `/`); a with/without-band control pinned the route's ~2.3 s load-raster floor to the splash + frosted chapters, with the band adding nothing measurable and lowering the load layer count (25–27 vs 30–31) by pushing chapters below the fold. *(done 2026-08-09)*
3. **OG share cards** — `renderRecapChapterCard` in `og-card.ts`, composition in `og.service.ts`, controller route + DTO for the flagship pair, artwork as card background; verify with curl against the running api.
4. **Share affordance** — per-chapter share button, WebShare API with clipboard/download fallback; tests + axe in the same commit.
5. **Palette verb** — `share …` grammar in the shared parser + palette groups; update the chunk list in [command-palette.md](command-palette.md).

## Chunk 0 — what was built and what it found

Harness: a scratchpad Node script (not committed) reading the real cached-matches window — `GET /lol/summoners/euw1/Vyoh/Ahri/matches/cached?start=0&count=2000` → 565 matches, 564 after `remake` filtering, 106 distinct champions, 2024-06-01 → 2026-08-01. Champion colors from `champion-assets.json` dominantHex (the same source `championTheme()` reads). Rendered to PNG via the api's own `@resvg/resvg-js` to preview exactly what the OG pipeline would emit.

Three metaphors, all deterministic (the only "randomness" is an FNV hash of `matchId`):

- **Ridge** — the season as one thread: cumulative win/loss walk, one segment per match colored by the champion played; knots mark the five highest-kill games. The walk shape carries a real narrative (the 2024 loss-streak descent, the two-year climb back).
- **Weave** — win/loss rhythm as a woven selvage: one thin warp thread per match, wins rise above the midline, losses hang below, length is game duration, color is champion; halos on the five best-KDA games.
- **Knots** — the season as a beaded ring: matches placed in play order around a circle, wins drift outward, losses inward, knot size is kills; first-blood games get a ring stroke, best-KDA games a halo.

Findings that bind later chunks:

- **`Strawberry_*` aliases (Swarm mode) must be normalised to the base champion** before the color lookup, or every Swarm game renders fallback grey. *(Resolved in chunk 2 with zero new code: `championTheme()` already routes through `normalizeChampionAlias`, which strips the prefix — pinned by a component test.)*
- **Real-time angular/x placement clumps into session blobs** with dead gaps between play sessions. Play-order (index) spacing is what reads as a continuous artifact; time can modulate, not place.
- **Zero-kill games produce near-invisible marks** in any kill-scaled encoding — acceptable in Knots (the thread shows through, reads as quiet stretches) but a floor on mark size is worth keeping.
- **Payload/DOM weight is the chunk-2 risk, not render cost**: at 564 matches the SVGs weigh 50–83 kB and carry ~600 elements each. *(Measured in chunk 2: the inline SVG rasters once and the `lol-recap` probe couldn't distinguish the route with the band from without — no window cap needed.)*
- ~~The recap page already holds match data via its existing hooks~~ — wrong: the recap layout window defaults to **20 matches** (`DEFAULT_COUNT` in the `$accountSlug` layout), far too short for the walk. The band owns a `useCachedMatchesWindow(account, 2000)` fetch instead, sharing the champion table's cache key; per-chapter fetches were already the recap idiom.
- resvg renders all three cleanly at 1200×630, so the same SVG string works as an OG card background without rework.
