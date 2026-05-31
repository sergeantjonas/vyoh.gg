# Motion choreography arc

**Status:** Active 2026-05-31. Foundational arc for the editorial register of the app. Lands the motion vocabulary that subsequent arcs ([atmosphere-arc.md](atmosphere-arc.md), future cinematic surfaces) inherit. Landing-page-first scope; propagation to `/lol` and `/steam` routes happens in followup arcs after the vocabulary is proven on the landing page.

**Order:** ships *before* [atmosphere-arc.md](atmosphere-arc.md) so every band in atmosphere arc inherits the motion vocabulary automatically. Confirmed 2026-05-31.

---

## Premise

The app is positioned as a visual-first portfolio piece (per the self-portrait framing in CLAUDE.md and auto-memory). Reviewer-on-`/` first-impression is the load-bearing surface. Today, that surface fails the register check — content *appears* rather than *arrives*.

**The gap is audit-able:**

- Only three components in the app actively enter the page: [`OrbMark`](../../apps/web/src/home/orb-mark.tsx) (opacity + scale + blur-clear — well executed, owns its reduced-motion contract); [`RecapSignatureGame`](../../apps/web/src/lol/recap/recap-signature-game.tsx) (opacity + Y-translate — flagged 2026-05-31 by owner as standing out as the odd-one-out in the bento *because nothing else animates in*); and the global `<m.div key={scope}>` in [routes/__root.tsx](../../apps/web/src/routes/__root.tsx) (a single 0.35s opacity fade applied identically to every route's entire content — quiet enough to barely register).
- Every other surface — headlines, eyebrows, meta, cards, lists, charts — appears statically.

**Reference register (owner-named, 2026-05-31):** [linear.app](https://linear.app) and [resend.com](https://resend.com). Both ship disciplined editorial motion: word-stagger headline reveals, eyebrows fading in before headlines land, supporting content cascading via Motion's `whileInView`. Crucially, both commit to *one* motion vocabulary applied everywhere — no "and here's the rest, statically rendered" section.

What we need: that same disciplined vocabulary, applied consistently. Editorial-restrained (Linear / Resend), not Awwwards-y (igloo / bruno-simon — explicitly out of register).

---

## Architecture

### Three primitives, one vocabulary

1. **`<EditorialHeading>` primitive.** Wraps text content with the word-stagger reveal. Configurable magnitude (Y-translate distance, stagger interval, total duration). Single primitive that every editorial headline in the app uses. Replaces ad-hoc `<h1>` / `<h2>` headlines where motion is wanted.

2. **Section-level stagger variants.** A common stagger pattern (eyebrow → headline → meta → body) implemented as motion variants on the section parent. Children inherit the parent's stagger via motion's variant cascade. Per [03-motion.md § 5.1 in the frontend-2026 KB](~/.claude/knowledge/frontend-2026/03-motion.md): variants are the canonical declarative-choreography pattern.

3. **`whileInView` adoption convention.** Below-the-fold content animates in on viewport entry, not just on route mount. Uses Motion's built-in `whileInView` — no IntersectionObserver wiring required at the call site.

### Reduced-motion contract

Hard requirement, not a soft preference. Per [reduced-motion-replacements.md](reduced-motion-replacements.md) (shipped standing rule): every entrance gets a *replacement*, not a disable.

| Entrance | Active variant | Reduced-motion replacement |
|---|---|---|
| Editorial heading | Word stagger, Y-translate + opacity | Opacity-only fade at 150ms |
| Section stagger | Eyebrow → headline → meta cascade | All-at-once opacity fade at 150ms |
| Bento `whileInView` | Y-translate + opacity per tile on entry | Static (no animation, immediate render) |

`OrbMark` already implements this contract correctly — its `reducedMotion` ref-branch is the pattern to align with.

### Existing patterns to extend, not replace

- `OrbMark` entrance is correct as-is. Don't rewrite it; align primitives to its existing reduced-motion contract.
- `RecapSignatureGame`'s entrance (`initial={{ opacity: 0, y: 32 }}`) becomes a call site of the new variants once they exist. The motion arc doesn't change its behavior, just the source of the variants.
- Global `<m.div key={scope}>` opacity fade in `__root.tsx` stays for cross-section route transitions (scope-change reset still needs it). The motion arc supplements it; it doesn't replace it. Section-level entrance choreography happens *inside* the route's content.

### Performance contract

- Transforms (`translateY`, `scale`) + opacity + a small `filter: blur()` (≤8px radius) for the Linear-style soft clear. No `width`/`height`/`backdrop-filter` during entrance.
- `will-change: transform, opacity, filter` is **pinned** (inline `style`) on per-word spans inside `<EditorialHeading>` and on motion section children. Motion's auto-`will-change` is per-animation-frame and was insufficient — without pre-promotion, Firefox stutters as later words enter the cascade (sub-pixel anti-aliased text re-rasters when transformed without a pre-allocated layer). Linear's hero uses the same pin. Memory cost is bounded (a handful of heading-sized layers per page).
- **No `text-shadow` on any element that participates in the entrance cascade.** `text-shadow` forces full text re-raster on every transform frame in Firefox and Chrome, even on elements with composite layers. The landing eyebrow's earlier two-layer drop+glow shadow was the prime jank source. If text needs contrast over a busy background, prefer a backdrop tile, gradient, or opaque text color over `text-shadow`.
- Stagger intervals tuned to land entire headline within ~850ms on the hero (6-word 2-line headline at `large` magnitude). The earlier 500ms target was aspirational; for editorial register we accept ~700–900ms so word durations don't feel jolty. The cascade is intentionally tightened from M-1 placeholders (see open decision #1) to keep overlap low — too many simultaneously-tweening words competes for the frame budget even on Firefox.

---

## Chunk plan

**M-1. Editorial headline primitive.** Build `<EditorialHeading>` in [apps/web/src/components/ui/](../../apps/web/src/components/ui/). Props: `as` (tag, defaults `h1`), `magnitude` (small / medium / large, controls Y-translate distance and stagger interval), reduced-motion handled internally via `useReducedMotion`. Word-stagger reveal via motion variants. Uses React 19 ref-as-prop (regular `ref` prop, no `forwardRef`) — atmosphere arc consumers will need refs for `useScroll`/measurement plumbing. Files: new `editorial-heading.tsx` + `editorial-heading.test.tsx`. **No call-site changes yet** — primitive ships behind no consumer.

**M-2. Section stagger variants.** Define section-level stagger vocabulary as exported motion variants from [apps/web/src/components/ui/](../../apps/web/src/components/ui/) (new `section-variants.ts` or similar). Pattern: parent variant with `staggerChildren`, child variants for `eyebrow`, `headline`, `meta`, `body`. Single test (variant correctness via Motion's test utilities). **No call-site changes yet.**

**M-3. Landing hero applies the vocabulary.** Replace [landing-heading.tsx](../../apps/web/src/home/landing-heading.tsx)'s static heading with `<EditorialHeading>`. Add section variants to the hero `<section>` so the orb, eyebrow ("vyoh.gg"), and split headline ("A self-portrait, / in League and Steam.") stagger in coordination. Replaces what currently lands as a static block. Files: [landing-heading.tsx](../../apps/web/src/home/landing-heading.tsx) + test update. **First user-visible chunk.**

**M-4. Replace global route fade with content-aware enter.** In [routes/__root.tsx](../../apps/web/src/routes/__root.tsx), the existing `<m.div key={scope}>` 0.35s opacity fade stays for cross-section transitions. But the *initial mount* of the landing page now defers entrance choreography to the landing's own variants, not the global fade. Mechanism: skip the global fade when the route owns its own entry (e.g., via a router-context flag the route sets on mount). Files: [__root.tsx](../../apps/web/src/routes/__root.tsx), landing route.

**M-5. `whileInView` adoption on the bento.** Bento tiles on the landing page stagger in as they enter viewport (not just on initial mount). Below-the-fold tiles wait for the user to scroll. Uses motion's `whileInView` with consistent margin/threshold. Single test per tile (or shared test harness). Files: bento tiles in [apps/web/src/home/](../../apps/web/src/home/) (most of them). **Note:** when atmosphere arc lands and retires bento tiles, the `whileInView` adoption pattern transfers to the editorial bands directly — same call site, same primitive.

**M-6. Align `RecapSignatureGame` call-site to the new vocabulary.** The component's local motion props become call-site variants instead. Cleanup chunk — proves the vocabulary subsumes the existing ad-hoc pattern. Files: [recap-signature-game.tsx](../../apps/web/src/lol/recap/recap-signature-game.tsx).

**M-7 (followup, separate arc).** Propagate vocabulary to `/lol/$accountSlug/*` and `/steam/*` routes. **Out of scope for this arc** per the landing-first scope decision (2026-05-31). Tracked as standalone followups so each route's editorial register can be tuned independently.

---

## Open decisions

1. **Stagger magnitude defaults.** ~~Locked 2026-05-31 during M-3.~~ Re-tuned 2026-05-31 after owner review felt the hero "too fast, should feel deliberate." `<EditorialHeading>` ships three magnitudes, each `{ y, stagger, duration, blur }`:
   - `small`: `{ 6, 0.025s, 0.4s, 4px }` — for inline accents (`<h3>` / `<h4>`).
   - `medium`: `{ 10, 0.04s, 0.45s, 6px }` — default; section-level `<h2>` / `<h3>` headlines.
   - `large`: `{ 14, 0.08s, 0.85s, 8px }` — hero / `<h1>` only.
   The landing hero uses `large` with a 6-word 2-line headline, landing in ~1.25s — each word lingers entering, so it reads as a deliberate Linear/Resend-grade reveal rather than a snap-in. Earlier ~0.85s pacing read as too brisk for an editorial headline at this size. Tune again only if owner review flags drag, but bias toward keeping headlines slow — the per-word duration is where the "deliberate" feeling lives.
2. **`whileInView` thresholds.** Default `amount: "some"` — fires when any pixel enters the viewport, not at 50%. Tune via `viewport={{ amount, margin }}`. To fire *earlier* than viewport entry, use a *positive* rootMargin-style string (e.g. `margin: "0px 0px 10% 0px"` extends the trigger box downward); a negative margin shrinks the box and delays firing. For long bento tiles / charts where the default `"some"` fires too eagerly on first pixel, switch to `amount: 0.25` or `amount: "all"` depending on the surface. Tune during M-5.
3. **First-visit vs return-visit choreography.** Should the first-ever visit get extra theatre (longer durations, more drama)? Linear doesn't differentiate. Default: same vocabulary for both. Revisit only if owner review on first visit reads as "fine but I want more drama once."
4. **Primitive home.** `apps/web/src/components/ui/` matches shadcn convention (other ui primitives live there). Confirm during M-1.

---

## Cross-references

- [atmosphere-arc.md](atmosphere-arc.md) — consumes this arc's vocabulary; every atmosphere band uses the editorial heading + section stagger by default.
- [landing-showcase-arc.md](landing-showcase-arc.md) — D4-3 through D4-6 superseded by atmosphere arc; D4-1 hero stands; D4-2 in interim-strip state. See banner at top of that note.
- [reduced-motion-replacements.md](reduced-motion-replacements.md) — standing reduced-motion rule this arc inherits.
- [`~/.claude/knowledge/frontend-2026/03-motion.md`](~/.claude/knowledge/frontend-2026/03-motion.md) §5.1 (variants), §4 (when to use scroll-driven vs. IntersectionObserver) — KB references.
- [motion-backlog.md](motion-backlog.md) — entries here may be subsumed by this arc; review when reopening.
