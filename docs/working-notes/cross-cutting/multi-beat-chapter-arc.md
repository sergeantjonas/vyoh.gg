# Multi-beat chapter architecture & choreography arc

Architecture + design plan for fixing the multi-beat chapter experience. Replaces the shipped sticky-stage cross-fade direction (`0740849d`, 2026-06-05) which read as mushy, unread-able, with stuck/skip states. Sub-note of [self-portrait-recap-arc.md](./self-portrait-recap-arc.md). Sibling of [r13-exit-dissolve.md](./r13-exit-dissolve.md) and [subject-chapter-design-spec.md](./subject-chapter-design-spec.md) — read both for substrate and design vocabulary.

Earlier title for this note was "Chapter horizontal-pinned scroll." That direction was researched and rejected mid-discussion. The horizontal-track design isn't what makes a chapter exciting; it's just a carrier with its own gotcha pile. The actual leverage is in **per-beat choreography against a clean snap-paged substrate.** Horizontal scroll discussion preserved in `git log` if needed; not duplicated here.

## Status

- 2026-06-05 — research + design landed (this note). No code written. Recommended architecture: sticky chapter masthead in normal flow + flat snap-paged beats below + IntersectionObserver-triggered Motion `animate()` per beat. Standing rule: **all four Steam beats individually art-directed against the choreography toolkit; no shared template, no uniform fade.**

## The symptoms this arc is solving

Owner-reported on the shipped `0740849d` state (2026-06-05):

| Symptom | Root cause |
|---|---|
| Fading doesn't land | Cross-fade overlap window = two beats partially visible, no clear transition moment |
| Content hard to read | Reading text mid-cross-fade at 50% opacity is genuinely hard |
| Stuck in intermediate states | No per-beat snap force = scroll can rest anywhere |
| User can skip content | No `scroll-snap-stop: always` between beats = fast wheel skips multiple beats |
| Doesn't land visually | Cross-fade isn't a transition users have a mental model for |
| Scroll multiple times without anything happening | Tall outer section + subtle opacity change = lots of scroll distance for little response |

These are *structural*, not polish. Recovering by tuning the cross-fade curves doesn't fix them; the medium has to change.

## Recommended architecture

```html
<main scroll-snap-type: y mandatory; scroll-padding-top: var(--masthead-h)>
  <section data-chapter>
    <header data-masthead position: sticky; top: 0; height: var(--masthead-h)>
      eyebrow + logo + chapter title
    </header>
    <article data-beat scroll-snap-align: start; scroll-snap-stop: always;
             height: 100vh; padding-top: var(--masthead-h)>
      beat 0
    </article>
    <article data-beat ...>beat 1</article>
    <article data-beat ...>beat 2</article>
    <article data-beat ...>beat 3</article>
  </section>
  <!-- next chapter same shape -->
</main>
```

Two structural moves carry the weight:

1. **`scroll-padding-top` on the scroll container.** Tells the snap algorithm to offset every snap point by the masthead height. Masthead sticks at viewport top throughout the chapter; each beat snaps with its content top at the masthead boundary. No absolute positioning, no z-index gymnastics, no stacked layers — just normal document flow + sticky + snap-padding. This is what `scroll-padding-top` exists for.

2. **Beats are flat siblings in normal flow.** The shipped architecture stacks all beats as absolutely-positioned layers inside one sticky stage, which structurally forces cross-fade as the only possible transition. Flat siblings with their own snap-stops are independently animatable and don't share viewport space, so the cross-fade medium isn't even possible.

Per-beat motion: **IntersectionObserver fires Motion `animate()`** for that beat's distinct entry choreography. Not scroll-coupled. R-13 v2 documented this as "the whole exit-dissolve" but it never actually shipped — see "Note-vs-code gap" below. The pattern is correct; we just have to actually do it.

What carries forward from today's [chapter-group.tsx](../../apps/web/src/home/recap/chapter-group.tsx):
- `useChapterNudge` for "chapter has entered viewport" — drives masthead reveal.
- `useChapterGroupNudge` context — drives masthead's own animations off chapter presence.
- `useChapterBeatNudge` context — drives per-beat entry cascade off the beat's own IO threshold.
- `prefers-reduced-motion` branch collapsing to a flat vertical stack.

## Choreography is the showcase (the load-bearing layer)

The architecture is invisible plumbing. The reason previous iterations felt boring isn't structural — it's that every beat used uniform motion (fade, blur, scale; same on every beat). The choreography toolkit below has to be applied *with intent per beat*, not stamped from a template.

**Standing rule:** all four Steam beats are individually art-directed. None of them is allowed to be "fade in from below." If two beats end up looking like the same template with different content, the design hasn't landed.

### Toolkit (named primitives, mix-and-match per beat)

1. **Layered parallax stack** (≥3 layers per beat). Background art (subject splash or hero), midground accent shape (geometric form in subject color), foreground copy. Each enters from a different vector with different timing and easing. Background drifts slow from one corner; foreground punches fast from another. Kills the "flat web page" feel.
2. **Subject-as-camera-dolly.** The subject (champion splash, Steam hero capsule, achievement icon) *moves* during the beat — pan, scale, rotate slightly, parallax-shift on mouse. The subject is the focal point that text composes around, not a static portrait next to text. Apple AirPods move.
3. **Typographic kinetics.** Numbers split into digits and tumble in. Headlines split by character/word and stagger with offset Y/X/rotate. Pull-quotes the size of the beat. Editorial scale (text *is* visual, not just label). Where the "magazine spread" feel comes from.
4. **Mask reveals.** Content emerges from behind a moving mask — sweeping geometric shape, the subject's silhouette, an SVG path. Tactile and confident; replaces the boring fade with a "real" transition.
5. **3D card transitions.** `transform-style: preserve-3d` + `perspective` on the parent. Outgoing beat rotates slightly on Y as it exits; incoming rotates in. Subtle (10-15deg), not gimmicky. Physical depth between snap stops.
6. **Ambient loops as signature.** Each beat has one continuous low-amplitude loop — champion idle motion, Steam achievement icon pulse, KDA digits shimmer, particle drift. The "alive between snaps" anti-deadness move. Already partly in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md).
7. **Hard cuts with transition stings.** Instead of soft fade between beats, a brief transition element fires on snap-land — chromatic split frame, sweeping accent line, glitch flash for moment-chapters. Cinema, not webby ease-in-out.
8. **Atmosphere pulse on snap-land.** Existing atmosphere system (tint hue, intensity) shifts color per beat. Already wired; can be more aggressive — bigger hue shifts, brighter intensity bursts on snap-land.
9. **Editorial chrome.** "Beat 02 / 04" page marker, chapter symbol, small subject byline. Persistent magazine-spread chrome layer that animates with the masthead. Anchors the editorial frame.
10. **Masthead is alive too.** Don't just pin a static logo. Eyebrow text counts chapter progress, accent line stretches across the masthead as the chapter loads, color tint picks up the active beat's accent. The "constant" pulses.

### How the toolkit gets used

Each beat picks 4-6 primitives, deliberately. Per-beat choreography intent is design work and gets decided when the beat is being designed (with owner taste input), not pre-specified in this note. The point of the toolkit is that the primitives are *available* and the standing rule is that the choreography has to be art-directed beat-by-beat against them — not that this note dictates the design.

### What "alive" looks like, mapped to the symptoms

| Symptom | Toolkit primitive that addresses it |
|---|---|
| Fading doesn't land | Drop fade entirely. Use mask reveals, 3D card transitions, or hard cuts with stings. |
| Content hard to read | Each beat fully opaque at snap stop; no overlap window. |
| Stuck states | `scroll-snap-stop: always` physically blocks resting between beats. |
| Skip content | Same — snap-stop blocks fast wheel from skipping. |
| Doesn't land visually | Hard cuts + transition stings + atmosphere pulse on snap-land. Each beat reads as a distinct moment. |
| Scroll without feeling | Every snap fires a beat-specific animation. Ambient loop runs continuously between snaps. No quiet runway. |

## Scope

- **Steam chapter** (`apps/web/src/home/recap/steam-chapter.tsx`) — only multi-beat chapter currently using `<ChapterGroup>` + `<ChapterBeat>`. **Migrates first** to the new architecture; all four beats individually art-directed.
- **Ahri chapter** (`apps/web/src/home/recap/ahri-chapter.tsx`) — currently single-pin via `ChapterContainer`. A chunk to migrate it to multi-beat exists in the parent arc and is **on pause until this architecture is proven**. Once the Steam migration ships and the architecture has owner approval, Ahri migration unblocks.
- **Moment chapters** (`lol-moment-chapter.tsx`, `steam-moment-chapter.tsx`) — single-pin, not affected by this arc. Don't touch.
- **`<ChapterContainer>` (single-pin model)** — remains in tree for Ahri/moment chapters; do not delete.

## What was tried before (full audit trail)

Reading the git log and prior notes carefully, almost every individual element of the recommended direction was on screen at some point. The combination wasn't.

### `cb71cc67` (2026-06-03) — "stacked-beat chapter architecture, Steam migration (R-13 redo)"

Introduced flat snap-aligned beats: each `<ChapterBeat>` was its own viewport-tall `<section>` with `scroll-snap-align:start; scroll-snap-stop:always`. Per-beat `useChapterNudge` keyed on visibility. **Structural shape matches this note's recommendation.** Replaced a pin-based multi-beat model that had a "release tail" asymmetry making the last beat feel skippable.

### `771d3326` (2026-06-03) — "chapter-level sticky identity"

Promoted the chapter identity (logo, title) to a sticky element at the `ChapterGroup` level. **Architecturally matches this note's masthead pattern.** Used an absolute wrapper with a sticky child + IntersectionObserver gating visibility against beat 0.

### `43be88fc` (2026-06-03) — "one persistent title card, beat content swaps below"

Refined the sticky identity to always-visible. Owner clarification recorded in the commit body: "treat the logo as the chapter's constant under which beat content swaps, rather than something that gets re-laid out per snap section." **Matches this note's design intent.**

### `b3711bcb` (2026-06-04) — "r-13 exit-dissolve via css animation-timeline on chrome/safari"

The peak prior state. Sticky chapter masthead + flat snap-stop beats + exit-dissolve animation on each beat. Two engine paths: CSS `animation-timeline: view()` on Chrome/Safari, Motion `useScroll` + `useTransform(opacity/blur/scale)` on Firefox. Beats wrapped in 130dvh outer + sticky 100dvh inner — the extra 30dvh was the "scroll runway" for the exit-dissolve animation.

**Differences from this note's recommendation:**
- 130dvh wrappers with sticky inner pin — adds a 30dvh "dead pin runway" per beat. **Suspected source of symptom 6** ("scroll without feeling anything") since the runway is dead time where only a subtle dissolve is playing.
- Exit motion was scroll-coupled, not IO-triggered.
- All beats used the same uniform exit animation. No bespoke per-beat character.

### `0740849d` (2026-06-05) — "rewrite chapter-group as sticky stage with cross-fading beat layers" (today's shipped state)

Threw out the flat snap-stop beats. Beats are now absolutely-positioned layers stacked in one sticky 100dvh stage, cross-fading via chapter-scoped scroll progress. Lost `scroll-snap-stop: always` per beat — directly explains symptoms 3 (stuck) and 4 (skip). **Why** the rewrite happened: not recorded. One-line commit message. Owner doesn't remember the specific blocker on `b3711bcb`.

### Note-vs-code gap (important)

[r13-exit-dissolve.md "Resolution v2"](./r13-exit-dissolve.md#L11) claims the IntersectionObserver + `animate()` pattern was shipped as the final clean answer ("That's the whole exit-dissolve" with a code snippet). **The git log contradicts this.** There is no commit between `b3711bcb` (scroll-coupled exit-dissolve) and `0740849d` (today's cross-fade rewrite). The IO + `animate()` resolution was written down as shipped but **was never actually shipped in code.** When future sessions read that note, they should know: the pattern is real, the resolution v2 narrative isn't.

This note **explicitly recommends finally shipping the IO + `animate()` pattern** as the per-beat motion driver. It's still the right answer; it just has to actually be done.

## Load-bearing unknown to investigate during spike

**Why was `b3711bcb` abandoned?** Owner doesn't remember. The commit message of `0740849d` doesn't say. The structural shape of `b3711bcb` is close to this note's recommendation, so reproducing it risks re-hitting whatever the unknown blocker was. Two leading hypotheses:

1. **The 130dvh pin runway felt dead** ("multiple scroll inputs, nothing happens"). This note's flat 100dvh beats eliminate the runway entirely — addresses this hypothesis directly.
2. **The uniform scroll-coupled exit-dissolve felt mushy despite the snap structure.** This note's IO-triggered per-beat bespoke motion addresses this directly.

If we re-hit some *third* blocker during the spike that explains the abandonment, document it here as a follow-up amendment.

## Cross-engine risk register

1. **R-13 snap-compositor optimization** ([r13-exit-dissolve.md:51](./r13-exit-dissolve.md)) — Chrome/Safari composite the snap-aligned section + its descendants as a single unit during snap interpolation, visually ignoring per-descendant transforms. **Doesn't apply to this design** because IO-triggered `animate()` fires *outside* the snap interpolation window (or composes with it, per R-13 v2's observation: "a 400ms fade running concurrent to the browser's snap motion, content fades to invisible during the snap"). Confirmed clean cross-engine in R-13 v2 testing.
2. **iOS Safari `scroll-snap` momentum** — [WebKit 243582](https://bugs.webkit.org/show_bug.cgi?id=243582), open mid-2026. Momentum suppressed when snap active; swipes lock immediately on lift. Acceptable trade for snap-stop:always preventing skipping. Native to the design.
3. **Firefox macOS trackpad + mandatory snap** — [bugzilla 1737820](https://bugzilla.mozilla.org/show_bug.cgi?id=1744289). Container can get stuck between snap points after short trackpad swipes. Mitigate with `scroll-snap-type: y proximity` on Firefox via `@-moz-document url-prefix(){}`. Engine-gate convention per [repo-conventions.md](../repo-conventions.md).
4. **Sticky-stage measurement gotcha** — any `transform`, `overflow: hidden/auto/scroll`, or `filter` on an ancestor of the chapter section either creates a new containing block (cancels sticky) or interferes with snap. Audit ancestors of `<section data-chapter>` before committing — `__root.tsx`, `<main>` scroll container, recap shell.
5. **Sticky masthead z-index over beat content** — beat content (parallax layers, subject art) must not bleed into the masthead's reserved area. `padding-top: var(--masthead-h)` on each beat reserves the space; visually the masthead sits opaque on top with its own z-index. Test that hero subject art is sized for the *visible* beat area (`100vh - masthead-h`), not the full 100vh of the snap container.

## A11y & reduced-motion

Settled answers from [W3C WAI-ARIA APG Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/):

- Chapter `<section>`: `role="region"` + `aria-roledescription="carousel"` + `aria-label="<chapter name>"`.
- Each `<article data-beat>`: `role="group"` + `aria-roledescription="slide"` + `aria-label="Beat N of M"`.
- **Do not bind arrow keys** to step beats. APG reserves arrows for native scroll. Prev/next via dedicated controls (or `::scroll-button()` if/when added), not arrows.
- Don't trap focus in invisible beats. Focusable inside a non-visible beat stays in tab order; on focus, scroll-into-view with `scroll-margin-top: var(--masthead-h)` for snap alignment.

`prefers-reduced-motion`: collapse to a vertical stack with no snap, no parallax, no transforms — same content, no motion. The reduced-motion branch in today's `<ChapterGroup>` (chapter-group.tsx:126-154) is the right shape; keep it.

## Library decision

**Motion sufficient. No GSAP. No Lenis.**

- Motion v12 `animate()` is WAAPI-backed, compositor-friendly, cancellation-on-reanimate native. Same primitive R-13 v2 advocates.
- IntersectionObserver via Motion's `useInView` (already in stack) — provides `root: mainScrollRef` option so threshold-cross fires against `<main>`'s viewport.
- GSAP ScrollTrigger: would only help if we needed declarative `snap` + timeline grammar. Native snap + IO+animate covers it.
- Lenis: contraindicated per KB `03-motion.md` §3; would hijack native scroll and break the snap.
- CSS `animation-timeline`: not needed for the carrier; beat motion is `animate()`, not scroll-coupled. May still earn its keep for the masthead's "alive" details (accent line stretches, eyebrow progress) as a Chrome/Safari progressive enhancement gated by `@supports`.

## Spike plan

1. Branch from `main`. New `<ChapterMultiBeat>` + `<MultiBeat>` primitives in `apps/web/src/home/recap/` alongside today's `<ChapterGroup>` + `<ChapterBeat>` — leave the existing components in tree for instant rollback.
2. Wire `scroll-padding-top` on `<main>` (or equivalent scroll container) via a CSS variable `--masthead-h`. Audit ancestors of recap section for transform/overflow/filter that would interfere.
3. Implement the architecture: sticky masthead in flow + flat 100dvh snap-stop beats below + IO-triggered Motion `animate()` per beat. Reuse the existing nudge contexts (`useChapterGroupNudge`, `useChapterBeatNudge`).
4. Migrate Steam chapter to the new primitives behind a feature flag (env var or `?layout=multi-beat-v2` query). Single chapter only.
5. **Art-direct all four Steam beats** against the choreography toolkit. Beat-by-beat design intent decided live with owner input. No beat reuses another beat's choreography wholesale. Bespoke per-beat motion is the load-bearing labor — budget for it.
6. Owner reviews on Chrome + Safari + Firefox. If any beat reads as boring, that's a design issue not an architecture issue; iterate on choreography, not the substrate.
7. Once shipped and owner-approved: unblock the parked Ahri-multi-beat chunk in [self-portrait-recap-arc.md](./self-portrait-recap-arc.md). Migrate Ahri to multi-beat using the same architecture + a fresh choreography pass with champion-subject primitives.
8. Once both chapters use the new architecture and the old `<ChapterGroup>` + `<ChapterBeat>` are unused: delete them in a separate cleanup chunk.

**Tests in the same commit** per [feedback_test_alongside_code]:
- Reduced-motion renders flat vertical stack.
- `IntersectionObserver` mock + `animate()` mock verify each beat fires its entry on cross threshold.
- Axe scan against [apps/web/src/components/accessibility.test.tsx](../../apps/web/src/components/accessibility.test.tsx) — carousel ARIA structure passes.
- Snap behavior testable via Playwright (already in stack from R-13 work) for cross-engine verification.

## What this note replaces / doesn't

- **Replaces** the assumption baked into the shipped `0740849d` (sticky stage + cross-fading beat layers). Beats stop being stacked layers; cross-fade is dropped as a transition medium entirely.
- **Replaces** the earlier draft of this note that pitched a horizontal-scroll carrier. That direction was researched then rejected during owner discussion — the carrier doesn't determine excitement, the choreography does.
- **Doesn't replace** [r13-exit-dissolve.md](./r13-exit-dissolve.md). That note's "Resolution v2" claim of shipped IO+animate is misleading (see "Note-vs-code gap"), but Lane 1/2/3 analysis and the snap-compositor finding remain load-bearing. Read it for the constraint, not the resolution.
- **Doesn't replace** [subject-chapter-design-spec.md](./subject-chapter-design-spec.md). That spec defines design vocabulary for *within* a beat — primitives, animation cascade, hover patterns, per-subject hooks. This note is about the *carrier between beats* + the standing rule that every beat must be art-directed individually against that vocabulary.

## Sources

### Primary docs

- [Motion: `animate()`](https://motion.dev/docs/animate) — imperative WAAPI-backed animation, cancellation-on-reanimate
- [Motion: `useInView`](https://motion.dev/docs/use-in-view) — IntersectionObserver hook with `root` option
- [MDN: scroll-padding-top](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding-top) — snap-padding for sticky headers
- [MDN: scroll-snap-stop](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-stop) — Baseline Widely Available since July 2022
- [W3C WAI-ARIA APG Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) — `region` + `group` + `slide` roles

### Browser bug references

- [WebKit 243582](https://bugs.webkit.org/show_bug.cgi?id=243582) — iOS scroll-snap momentum
- [Bugzilla 1737820 / 1744289](https://bugzilla.mozilla.org/show_bug.cgi?id=1744289) — Firefox trackpad + mandatory snap

### Local notes (load-bearing)

- [r13-exit-dissolve.md](./r13-exit-dissolve.md) — Lane analysis; snap-compositor finding; flawed Resolution v2 narrative
- [subject-chapter-design-spec.md](./subject-chapter-design-spec.md) — design vocabulary inside a beat
- [self-portrait-recap-arc.md](./self-portrait-recap-arc.md) — parent arc; contains the parked Ahri-multi-beat chunk
- [repo-conventions.md § Gate engine-specific perf cliffs](../repo-conventions.md) — engine-gate convention for Firefox trackpad mitigation

### Local notes (referenced)

- MEMORY `feedback_engine_gate_perf_cliffs` — bidirectional engine gate
- MEMORY `feedback_scroll_driven_on_compositor_thread` — Motion as the right primitive
- MEMORY `feedback_diff_working_sibling_first` — when porting between two analogous flows, diff the working one before theorizing
- MEMORY `project_subject_chapter_design_spec` — R-2 Ahri shipped 2026-06-01 as single-pin

### Reference sites (visual ceiling for choreography intent)

- [Apple AirPods Pro product pages](https://www.awwwards.com/inspiration/product-scroll-triggered-animation-apple-airpods-pro) — subject-as-camera-dolly per scene
- [Cyd Stumpel Portfolio 2025](https://www.awwwards.com/sites/cyd-stumpel-portfolio-2025) — Awwwards SOTD; per-beat bespoke choreography
- [Lusion v3](https://www.awwwards.com/inspiration/webgl-scroll-navigation-lusion) — Site of the Year 2024
- [Active Theory V6](https://www.awwwards.com/sites/active-theory-v6) — on-snap entrance shimmer; per-beat character
- [Stripe Sessions](https://stripe.com/sessions) annual recaps — typographic kinetics + atmosphere shifts per beat
