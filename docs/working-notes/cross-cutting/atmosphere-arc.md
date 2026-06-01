# Atmosphere arc

**Status:** ✅ Substrate shipped 2026-06-01 (A-1 / A-2 / A-2a). A-3 through A-10 superseded by [self-portrait-recap-arc.md](self-portrait-recap-arc.md) (2026-06-01). This doc stays live as the substrate's design record; the recap arc is where active work continues.

**Shipped substrate (A-1 / A-2 / A-2a):**
- `AtmosphereProvider` + `AtmosphereLayer` + `useAtmosphereClaim` ([apps/web/src/home/atmosphere/](../../apps/web/src/home/atmosphere/)) — ref-counted claim management, proximity-weighted scroll-driven blend, MotionValue plumbing, CSS custom property publication (`--atmosphere-tint-h`, `--atmosphere-intensity`).
- `AmbientHero` migrated to claim-only renderer ([ambient-hero.tsx](../../apps/web/src/home/ambient-hero.tsx)) — claims the hero band's time-of-day palette + intensity. Canvas drift + pointer parallax intentionally not migrated (polish-pass concern, see [motion-backlog.md](motion-backlog.md) if revisited).
- Orb consumes atmosphere CSS vars ([motion.css](../../apps/web/src/styles/motion.css)) — halo + sparkle hues read `--atmosphere-tint-h`, intensity reads `--atmosphere-intensity`. Tint hue sourced from `palette.layers[1]` (palette accent) so the halo reads as the complement of the dominant bg layer — keeps contrast against every time-of-day.
- Palette retune (2026-06-01) — `layers[1]` cx pulled inward (0.78→0.68 dawn, 0.80→0.70 elsewhere), alpha ~25% down. `VIGNETTE_MASK` tightened to `ellipse 65% × 90%` with a 25→100% fade. Eliminates corner bleed at full-viewport, validated against all four time-of-day looks.

**Why superseded:** Three rounds of iteration on A-3's framing (single Steam band → assets as background → editorial chapters with multi-band recaps) converged on a model meaningfully bigger than the original chunk plan. A-3 onward is restructured as the recap arc, which builds on this substrate. ADR-2 (no recognizable imagery) explicitly retired in the recap arc — the seam class that motivated it was killed by ADR-3 (this arc), so light-blur assets become the showcase instead of being filtered to ambient color.

**Successor to** [landing-showcase-arc.md](landing-showcase-arc.md) D4-3 through D4-6. Built on top of [motion-choreography-arc.md](motion-choreography-arc.md) (every shipped chunk inherited the motion vocabulary).

**Premise:** the landing page is a continuous atmospheric experience driven by recent activity. Bands of editorial content sit over one shared atmosphere layer that morphs as the user scrolls toward each band. Band ordering itself is data-driven — the stream the owner has been most active in this week leads; the runner-up follows; cross-stream rhythm bands close. Every visit reads as a current self-portrait.

This arc supersedes the per-band-backdrop-image approach that [landing-showcase-arc.md](landing-showcase-arc.md) D4-2 originally attempted. That approach hit a fundamental seam-between-bands problem during D4-2 shipping (documented in the 2026-05-31 conversation, preserved below): every adjacent pair of bands creates a visible boundary because the eye reads a fade-to-bg-and-back-from-bg gap as a horizontal band, regardless of how soft the gradients are. The atmosphere arc resolves this by making the atmosphere a single continuous layer (no per-band backdrop), with bands as typographic editorial moments on top.

---

## Brainstorm-preservation: what we landed on (2026-05-31 conversation)

Multi-hour conversation on the landing-showcase D4-2 banding problem led to this arc. Key decisions preserved here so future-self can pick up without conversation context:

1. **The seam is a band-boundary problem, not a Steam-band-specific problem.** Every D4-3+ band would have recreated it. Per-band soft-entry gradients can't eliminate it; they just move the perceptual edge. Confirmed by ~4 iteration attempts during D4-2 shipping (mask shape, mask center, box extension, isolation removal — none of which closed the gap).

2. **The seam disappears only when there's no boundary** — when atmosphere is *continuous across bands*. This rules out per-band backdrop images and rules in a shared atmosphere layer.

3. **Owner's creative reframe (2026-05-31):** "Use scrolling to shift the backdrop to be consistent with what we are scrolling TO." Scroll position drives atmosphere claim interpolation. Initial state = time-of-day glow (current AmbientHero). As user scrolls toward a band, atmosphere morphs toward that band's claim. Each band declares an atmosphere claim (Steam game atmosphere, LoL champion atmosphere, dimmed time-of-day glow, etc.).

4. **Owner's content reframe:** band ordering itself is data-driven. If LoL has been dominant this week, LoL band leads; if Steam, Steam band leads. Page literally reads differently week-to-week as a function of actual activity. Strong portfolio narrative ("this page IS me right now").

5. **Implementation path: pure JS via `motion/react`, NOT CSS scroll-timeline.** Verified via WebSearch + MDN (May 2026 — see ADR-1 below): Firefox stable does not support `animation-timeline` natively; even behind the `layout.css.scroll-driven-animations.enabled` flag, `timeline-scope` is not implemented (a load-bearing piece for the named-timelines architecture we'd otherwise have used). Pure-JS via motion's `useScroll` + `useTransform` + `MotionValue` avoids re-renders, runs in all browsers identically, lets owner-on-Firefox develop on the same code path that ships. Performance delta is moderate for this workload. When perf data later justifies, CSS scroll-timeline can layer in as an enhancement for browsers that support it — but the JS path is the contract.

6. **Pattern parity with `SplashProvider`.** The ref-counted-claim pattern from [splash-backdrop.tsx](../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) is the architectural blueprint. `AtmosphereProvider` extends this — bands claim atmosphere via `useAtmosphereClaim()`, last-claim-wins by scroll position, atmosphere layer reads active claims and interpolates between them.

7. **No per-band recognizable imagery.** The "Resident Evil 4 hero image" attempt during D4-2 hit irreducible problems (intruded on heading, created hard mask edges, no mask shape could make it tasteful). The atmosphere claim instead carries *abstracted* visual data: palette (oklch coords for the AmbientHero's existing gradient system), optional image at heavy blur (reads as atmospheric color, not as recognizable game art — see brainstorm failure mode "Leon's face in my heading"), intensity multiplier. Recognizable game art lives on per-stream routes (`/steam/game/$appid`), not on `/`.

8. **Reduced-motion + Safari path: snap, not morph.** Both code paths use the same atmosphere claim infrastructure, but the morph interpolation is replaced with an instant transition (CSS `transition` on the atmosphere CSS custom properties, ~200ms ease-out) at band boundaries. Same final state, no scroll-coupled interpolation. Engine-gate consistent with [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) precedent.

9. **Low-activity / flat-week strategy** (the "rainy week" problem). The page must not feel empty when the owner hasn't played much. See "Low-activity strategy" section below for the five rules.

10. **Register: Linear / Resend restrained.** Confirmed 2026-05-31. Atmosphere morphs are subtle (palette shift + intensity modulation + blurred-image alpha shift), not Apple/igloo cinematic. Owner-named reference points: [linear.app](https://linear.app), [resend.com](https://resend.com).

11. **Motion arc as foundation.** [motion-choreography-arc.md](motion-choreography-arc.md) ships first. Every atmosphere band uses the editorial heading + section stagger vocabulary from that arc. The atmosphere arc doesn't define its own entrance choreography — it inherits.

---

## Architecture

### Claim infrastructure (parity with `SplashProvider`)

```ts
// apps/web/src/home/atmosphere/atmosphere-provider.tsx (new)
type AtmosphereClaim = {
  palette: AmbientPalette; // reuse existing palette structure from ambient-hero.tsx
  image?: string;          // optional heavily-blurred image URL
  intensity: number;       // 0..1, multiplies palette chroma
};

const AtmosphereContext = createContext<{
  acquire: (ref: HTMLElement, claim: AtmosphereClaim) => () => void;
} | null>(null);

export function AtmosphereProvider({ children }: { children: ReactNode }) {
  const claims = useRef(new Map<number, { ref: HTMLElement; claim: AtmosphereClaim }>());
  // Ref-counted claim management mirroring useRefCountedClaim's acquire-returns-cleanup
  // shape ([apps/web/src/_shared/backdrop/use-ref-counted-claim.ts](../../apps/web/src/_shared/backdrop/use-ref-counted-claim.ts)).
  // acquire() returns a disposer; strict-mode double-mount produces symmetric
  // increment/decrement pairs, no stale-claim risk.
  return (
    <AtmosphereContext.Provider value={...}>
      {children}
      <AtmosphereLayer claims={claims} />
    </AtmosphereContext.Provider>
  );
}

export function useAtmosphereClaim(
  ref: RefObject<HTMLElement>,
  claim: AtmosphereClaim
) {
  // Reuses useRefCountedClaim shape — child-claims-win nesting, automatic
  // cleanup on unmount via the acquire-returns-disposer pattern.
}
```

### Layer rendering (no React renders during scroll)

```ts
function AtmosphereLayer({ claims }: { claims: Map<...> }) {
  // Per-claim element-relative progress via useScroll's target + offset API.
  // For each claim's ref: useScroll({ target: ref, offset: ["start end", "end start"] })
  // returns a 0→1 progress as the band crosses the viewport — strictly preferred
  // over computing proximity from raw scrollY against bounding boxes.
  // Per-frame inside motion's rAF loop (NOT a React render):
  // 1. Each claim contributes a target-relative progress MotionValue.
  // 2. Compute proximity weight per claim from its progress (peak near 0.5).
  // 3. Interpolate palette / intensity / image-alpha as MotionValues.
  // 4. Write to CSS custom properties on the layer element.

  return (
    <motion.div
      className="atmosphere-layer"
      style={{
        "--atmosphere-palette": paletteMotionValue,
        "--atmosphere-image-alpha": imageAlphaMotionValue,
        // ...
      }}
    />
  );
}
```

The atmosphere layer subscribes to scroll progress once via `useScroll`. The interpolation logic runs in `useMotionValueEvent` or via `useTransform`, both of which write to `MotionValue`s outside React's render cycle. CSS custom properties carry the values to the DOM.

### Stream dominance scoring (drives band ordering)

```ts
// apps/web/src/home/use-dominant-stream.ts (new)
const lolScore = (matches7d * 1.0 + matches14d * 0.3) * recencyDecay(lastMatch);
const steamScore = (unlocks7d * 1.0 + playtime7d_hours * 0.5) * recencyDecay(lastUnlock);

// Returns ordered list: ["lol", "steam"] or ["steam", "lol"] or null (rhythm leads)
```

If both scores below `MIN_THRESHOLD`, return `null` → rhythm bands lead, activity bands demoted to a compressed strip below.

### Band inventory

Each band declares its atmosphere claim via `useAtmosphereClaim`. Six bands total:

| # | Band | Atmosphere claim | Data source |
|---|---|---|---|
| 1 | Identity / hero | `{ palette: timeOfDayPalette, intensity: activity }` | `useHomeActivityIntensity` (existing) |
| 2 | Lead stream | `{ palette: streamTinted, image: signature?.blurredUrl, intensity }` | dominant-stream score |
| 3 | Followup stream | same shape, runner-up | runner-up score |
| 4 | Rhythm (chronotype + day-split) | `{ palette: dimmedTimeOfDay, image: undefined, intensity: dropped }` | chronotype data |
| 5 | Volume (weekly totals + streak) | inherits rhythm claim's tail | weekly aggregates |
| 6 | Footer (site-meta) | `null` → atmosphere fades to uniform bg | build/domain |

Rhythm bands (4, 5) intentionally don't carry their own image — the chart commands. Open decision: do they inherit the previous band's tail at lower intensity, or carry their own dimmed time-of-day claim? See open decisions.

---

## Chunk plan

Status legend: ✅ shipped | ❌ superseded by [self-portrait-recap-arc.md](self-portrait-recap-arc.md). Most chunks below were absorbed into the recap arc — the recap maps are noted inline.

**✅ A-1. Atmosphere claim infrastructure.** Build `AtmosphereProvider`, `AtmosphereLayer`, `useAtmosphereClaim` in [apps/web/src/home/atmosphere/](../../apps/web/src/home/atmosphere/) (new directory). Pattern after [splash-backdrop.tsx](../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx). Includes ref-counted claim management, scroll-driven proximity weighting via `useScroll` + `useTransform`, MotionValue plumbing to CSS custom properties (no React re-renders per scroll tick). Test coverage: claim ownership semantics, scroll-driven interpolation correctness, reduced-motion snap path. **No visible UI change yet** — the provider mounts but no band claims yet. Files: new `atmosphere-provider.tsx`, `atmosphere-layer.tsx`, `use-atmosphere-claim.ts` + tests.

**✅ A-2. Hero migrates to atmosphere claim.** [AmbientHero](../../apps/web/src/home/ambient-hero.tsx) becomes the *initial* atmosphere claim instead of rendering its own backdrop. The visual output is identical when no other band has claimed (which is true on first paint, before scroll). Files: [ambient-hero.tsx](../../apps/web/src/home/ambient-hero.tsx), [routes/index.tsx](../../apps/web/src/routes/index.tsx) (provider mount). **Proves the architecture has no visual regression at default.**

**✅ A-2a. Orb consumes atmosphere claim (mood-ring beat).** Once A-2 writes `--atmosphere-palette` / `--atmosphere-intensity` from the hero claim, [OrbMark](../../apps/web/src/home/orb-mark.tsx) reads them: halo gradients reference the palette CSS variables instead of hardcoded blues, halo opacity multiplies by `var(--atmosphere-intensity)`, wisp stroke colors tint from the palette. ~15 lines of diff, no structural changes. **Visible result**: orb becomes the literal mood ring for the page — time-of-day palette in the halo, activity intensity modulates pulse depth. After A-3+ ships, the orb halo automatically tints toward Steam/LoL palettes as those bands approach viewport — zero further orb edits required because the atmosphere layer is now morphing the same CSS variables the orb already reads. Files: [orb-mark.tsx](../../apps/web/src/home/orb-mark.tsx). **Note**: a 2026-05-31 attempt to refactor the orb's SVG turbulence + wisps into a conic-ring + CSS sparkles "while we were here" produced a visually worse orb (lost the character that turbulence + arcing wisps give) and was reverted. A second pass the same day landed a surgical perf cut that preserved every visual element: halo + sparkle loops moved off the Motion main thread into CSS `@keyframes`, `feTurbulence` + `feDisplacementMap` `<animate>` children dropped (noise computed once at filter init instead of every frame), `numOctaves` lowered 2 → 1. Wisps + filter pipeline + halo composition + sparkle paths all unchanged. Future perf work on the orb should follow that pattern — preserve the visual layers, target the per-frame work behind them.

**❌ A-3. Steam band re-introduces as claim-only.** Superseded — recap arc R-3 (Steam subject chapter) rebuilds the band as a multi-band chapter with `"Playing X lately"` copy framing, light-blur game-hero bg, unlocks + stats + screenshots rotator. Original framing as a single claim-only band became too thin after iteration.

**❌ A-4. LoL band as claim-only.** Superseded — recap arc R-2 (Ahri subject chapter) replaces this with the multi-band Ahri chapter (skin rotation in the bg, recent sessions strip, trends band, standout-moment card). Bento tile removals still happen but as part of R-5 (conclusion refactor).

**❌ A-5. Stream-dominance reordering.** Superseded — recap arc R-4 (`useChapters()` selection) generalises this from "two streams" to "N chapters scored by recency-decayed activity," interleaved across streams. Score formula moves from `useDominantStream` to `useChapters`.

**❌ A-6. Chronotype as full-width band with rhythm claim.** Superseded — recap arc R-5 (conclusion refactor) keeps chronotype as a full-width band but inside the conclusion region (after the last chapter unpins), not interleaved between activity bands.

**❌ A-7. Volume / rhythm cleanup band.** Superseded — recap arc R-5 collapses volume + rhythm into a tight "lifetime totals strip" inside the conclusion. Most of the bento volume tiles retire entirely; what's left is a chip-row closer.

**❌ A-8. Site-meta footer.** Superseded — recap arc R-5 owns the bento retirement + footer chips. Same intent, different chunk number.

**❌ A-9. Low-activity fallback states.** Superseded — recap arc generalises this into recency-decayed scoring with `> FLOOR` inclusion (no fixed window). Editorial copy adapts per age bucket (see recap arc § "Honest recency framing"). The five rules in "Low-activity strategy" below still apply as design intent; they're realised by the recap arc's scoring + framing rather than per-band fallback chains.

**❌ A-10. Engine-gate Safari and reduced-motion to the snap path.** Superseded — recap arc R-11 (engine-gate). Same engine-gate strategy expanded to cover chapter pin + signature beats + skin rotation (more surface area than the original A-10 scope contemplated). ADR-4 carried over with broadened scope.

---

## Low-activity strategy (the rainy-week problem)

Five rules govern fallback behavior. Implemented in A-9.

1. **Atmosphere never goes flat.** Time-of-day claim is the floor; activity intensity modulates it, never gates it. A 0-activity week still has hero atmosphere at minimum intensity.

2. **Rhythm bands are structural, not event-based.** Chronotype shows the user's pattern even when this week's events are sparse. Weekly totals shows the count even if it's "1 match, 0 unlocks". These bands never feel empty — their data is the pattern, not the event.

3. **Each event band has a graceful fallback chain.** Examples:
   - "Latest unlock (3h ago)" → "Latest unlock (12d ago)" → "Last unlock: TF2 hat trick, 47d ago" → "No unlocks this season".
   - "Last match: Standout win on Ahri (3h ago)" → "Last match (12d ago)" → "Last 30 days: 12 matches, 58% wins" → "Quiet stretch; lifetime 51% on 4.2k matches".

4. **Quietness becomes editorial copy.** "Quiet week — TFT pre-season prep" or "Steam summer hiatus" as honest framings. The bands literally *say* "quiet week" — on-brand for the self-portrait thesis.

5. **Order shifts on flat weeks.** If `dominantStreamScore < FLAT_THRESHOLD` for both streams, `useDominantStream` returns `null` → rhythm bands lead the page, activity bands demote to a compressed strip below. The page tells a different story but still tells one.

---

## Architecture decision records

### ADR-1: Pure JS via motion/react, not CSS scroll-timeline

**Date:** 2026-05-31.

**Context:** Owner's primary browser is Firefox. Verified via WebSearch + MDN: Firefox stable does not support `animation-timeline` natively (versions 110-current are "Disabled by default"); the `layout.css.scroll-driven-animations.enabled` flag enables most properties but `timeline-scope` is not implemented at all. `timeline-scope` is the property we'd use to scope named view-timelines to a common ancestor (the architecture for the atmosphere layer reading multiple band timelines without being a descendant of each). The cleanest CSS-only version is not reachable in Firefox by flag-flipping alone.

**Decision:** Use motion/react's `useScroll` + `useTransform` + `MotionValue` for scroll-coupled interpolation. CSS path may layer in as enhancement if perf data later justifies, but the JS path is the contract.

**Consequences:** one code path to test/maintain, owner develops on same path that ships, modest main-thread cost during scroll (acceptable for this workload — single atmosphere layer, not dozens of parallax elements). When MotionValues drive CSS custom properties via `useMotionValueEvent`, no React re-renders fire during scroll.

**Sources:** [caniuse animation-timeline (May 2026)](https://caniuse.com/mdn-css_properties_animation-timeline), [Experimental features in Firefox — MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features), [Scroll-driven animation timelines — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines).

### ADR-2: No per-band recognizable imagery, only heavily-blurred atmospheric color

**Date:** 2026-05-31. **Retired:** 2026-06-01 — see [self-portrait-recap-arc.md § ADR refresh](self-portrait-recap-arc.md). The seam class this ADR was hedging against was killed by ADR-3 (continuous-atmosphere substrate); the composition failure ("Leon's face in the heading") turned out to be an art-direction problem solved by directional masks + off-center asset positioning + per-claim blur, not an architecture problem. The recap arc ships recognizable imagery as a chapter feature.

**Context:** D4-2 shipping attempted full-bleed game-hero image as Steam band backdrop. Created irreducible seam at band boundaries (eye reads the "image emerging from background gradient" transition as a horizontal band regardless of mask shape, and the recognizable image — Leon's face from Resident Evil 4 — intruded compositionally into the heading area). Four iteration attempts during D4-2 failed to land an acceptable visual; final disposition was to strip the image entirely in the interim.

**Decision:** Atmosphere claims may carry an image URL, but the atmosphere layer applies heavy blur (`filter: blur(60-80px)`) and treats the result as ambient color, not as recognizable imagery. Recognizable game art lives on per-stream routes (`/steam/game/$appid`), not on `/`.

**Consequences:** the "Leon's face in the heading" failure mode is structurally impossible. Image visibility tradeoff is absorbed by blur magnitude. The atmospheric layer feels game-tinted without being game-explicit.

### ADR-3: Continuous atmosphere instead of per-band backdrops

**Date:** 2026-05-31.

**Context:** See brainstorm-preservation #1 and #2. Multi-hour debugging during D4-2 confirmed the seam class is unsolvable with per-band backdrops; only structural elimination works.

**Decision:** One atmosphere layer behind the whole page, claims drive its state, no band has its own backdrop element. Bands become typographic editorial moments on top of the shared atmosphere.

**Consequences:** seam class structurally eliminated; bands become editorial content layers, not visual containers; atmosphere becomes data-driven (claim system) rather than section-driven (per-section backdrop).

### ADR-4: Snap, not morph, under reduced-motion and on Safari

**Date:** 2026-05-31.

**Context:** Per [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md), Safari's compositing pipeline struggles with scroll-coupled atmospheric work on this codebase's DOM. Reduced-motion contract requires a meaningful substitute, not a disable.

**Decision:** Both Safari and reduced-motion paths use the same atmosphere claim infrastructure, but the morph interpolation is replaced with an instant CSS transition (~200ms ease-out) at band boundaries. Same final state, no scroll-coupled interpolation.

**Consequences:** Safari users see all the same atmosphere states, just discrete instead of interpolated. Reduced-motion users see honest substitutes per the standing reduced-motion-replacements rule.

---

## Open decisions

Most of this arc's open decisions either resolved during the shipped substrate (A-1/A-2/A-2a) or moved to the recap arc when the framing pivoted. Status legend: ✅ resolved | ➡️ moved to recap | 🕒 still deferred.

1. **➡️ Rhythm-band claim shape.** Moved to recap arc R-5 (conclusion refactor). The recap arc puts chronotype + lifetime totals inside the conclusion region with a single atmospheric claim, not chained as "rhythm bands" between activity bands.

2. **➡️ Stream dominance weights.** Moved to recap arc R-4 (`useChapters` scoring). Generalised from two-stream dominance to N-chapter scoring with recency decay; weights tune during R-4 against real activity data.

3. **➡️ `FLAT_THRESHOLD` and `MIN_INTENSITY` constants.** Moved to recap arc — the recap's `FLOOR` threshold (chapter inclusion gate) subsumes `FLAT_THRESHOLD`. Atmosphere intensity floor stays at the substrate's default-0.5 baseline; no flat-week threshold needed under the recap-arc's chapter model.

4. **🕒 TFT activity.** Still deferred to TFT integration scoping. When TFT lands, the open question shifts: does it surface as its own subject chapters (Steam-like, per-set), or fold into the LoL chapter? Decided when TFT integration is scoped.

5. **➡️ Image blur magnitude.** Moved to recap arc — per-claim blur is now a chapter-type concern (heavy for atmosphere claims, light 4–8px for asset claims). Specific values land in recap arc R-12 (editorial pass).

6. **✅ Scroll progress source.** Resolved in A-1 — uses `mainScrollRef` (the `<main>` element) via manual scroll listener (not `useScroll({ container })`, which throws on unhydrated container in tests). See [atmosphere-layer.tsx](../../apps/web/src/home/atmosphere/atmosphere-layer.tsx) docblock for the why.

7. **✅ Atmosphere layer DOM location.** Resolved in A-1 — portaled to `document.body` via [`BackdropPortal`](../../apps/web/src/_shared/backdrop/backdrop-portal.tsx) for parity with the existing splash backdrop pattern. Clean isolation from route content; route container's overflow doesn't clip the layer.

8. **➡️ Hero scroll-hint enrichment + per-band recurrence.** Partially resolved + moved. The clickable chevron shipped 2026-06-01 (commit `74679587`). Enrichment + per-band recurrence move to recap arc R-8 (caret-clicks-advance-by-chapter), where the unit of advance becomes a chapter, not a viewport, and the chevron's "more below" affordance can adapt to the next chapter's eyebrow. The original "stay anonymous through A-9" default is moot — the recap arc's chapter framing makes per-chapter caret semantics the natural answer.

---

## Cross-references

- [motion-choreography-arc.md](motion-choreography-arc.md) — foundation arc; every band inherits its motion vocabulary.
- [landing-showcase-arc.md](landing-showcase-arc.md) — D4-3 through D4-6 superseded by this arc. D4-1 hero stands; D4-2 interim strip is a holding state until A-3 reintroduces Steam band as claim-only.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — Safari compositing-cost precedent; snap-not-morph path follows this engine-gate pattern.
- [splash-backdrop.tsx](../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) — architectural blueprint for ref-counted claims.
- [reduced-motion-replacements.md](reduced-motion-replacements.md) — reduced-motion contract this arc inherits.
- [`~/.claude/knowledge/frontend-2026/03-motion.md`](~/.claude/knowledge/frontend-2026/03-motion.md) §4 (scroll-driven vs. IntersectionObserver), §2.7 (Lenis — explicitly NOT used), §2.5 (motion library overview) — KB references.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — broader self-portrait direction; this arc is the surface where data-driven self-portrait lands.
- [perf-baseline.md](perf-baseline.md) — measure before/after on landing page; atmosphere layer must not regress LCP/INP.
- [accent-color-system.md](accent-color-system.md) — atmosphere claims may drive accent token shifts; verify integration during A-2.
- [repo-conventions.md § synthesis-only on `/`](../../repo-conventions.md) — band content must respect the cross-stream synthesis convention; per-stream depth lives on per-stream routes.
- [orb-mark.tsx](../../apps/web/src/home/orb-mark.tsx) — A-2a consumer of `--atmosphere-palette` / `--atmosphere-intensity`. Pure colour-source swap on existing halos/wisps; no structural orb changes. See A-2a note for the 2026-05-31 reverted refactor that proved structural changes can't ship "while we were here" without a separate visual review.
