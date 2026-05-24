# Safari View Transitions snapshot cost on Steam pages

**Status:** Shipped 2026-05-24. Pairs with [section-shell-vt-migration.md](section-shell-vt-migration.md). Documents a multi-session debugging arc that diagnosed why router-level View Transitions felt smooth in Chrome / Firefox but produced visible chop on Safari/iOS when navigating between Steam sibling tabs, and the WebKit-only bypass + CSS-slide-substitute pattern that ships as the fix.

Read this when: scoping perf work on any Steam route, adding a new section that uses the VT slide pattern, deciding whether to ship a feature behind an engine gate, or onboarding to the Steam section's quirks.

KB anchors: [03-motion.md §3](~/.claude/knowledge/frontend-2026/03-motion.md). MDN: <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>.

---

## Symptom

After the SectionShell → VT migration shipped, Chrome and Firefox handled the section-level slide smoothly. Safari (macOS) and iOS Safari produced visible chop on every intra-Steam tab navigation (Profile ↔ Library ↔ Wishlist ↔ Achievements). LoL section navigation was always smooth on Safari, so the cost was scoped to Steam content specifically. The user-perceived effect was a multi-hundred-millisecond stutter that ate the slide animation.

Adjacent observations during the hunt:
- Wishlist as nav *source* was uniquely snappy on Safari; leaving any other Steam page was choppy.
- Bypassing the virtualizer on achievements made achievements → \* snappy.
- Upgrading TanStack Virtual to the new measurement-storms-1382× release didn't change the user-felt chop.

These observations pointed us repeatedly at the *content* of `<main>` rather than at the VT machinery itself, sending the early investigation down false leads.

---

## Diagnosis

The cost lives in **WebKit's `document.startViewTransition` snapshot capture**, not in the slide animation, not in the virtualizer, and not in any single CSS property.

When `startViewTransition` runs, the browser captures a bitmap of the OLD `<main data-vt-main>` state, awaits the React commit, captures a bitmap of the NEW state, then animates between them via `::view-transition-old/new/group` pseudos. Chrome's Blink and Firefox's WebRender perform the capture + composite work largely on the compositor thread. **WebKit performs more of this on the main thread** — and on Steam-shaped DOM (every Library tile is an `isolate` stacking context with a rest-state shadow, Profile mounts chips with `blur-sm` + `backdrop-blur-sm`, Achievements has a virtualized feed with shadowed cards), the capture + flatten work runs long enough to contend with React commits and produce per-frame chop.

LoL section content is structurally lighter at snapshot time (`m.div` opacity wraps over comparatively flat row layouts, fewer stacking contexts, no `backdrop-blur` on individual items), so the same VT machinery is fine on the same engine on the same machine for LoL. The differential is the *content being captured*, not the VT call itself.

### What ruled out the false leads

Each hypothesis was tested with a targeted code change and an empirical re-test in the Safari Frames timeline before being discarded:

1. **Animated profile background video** — `pause()` during VT (`route-transition-bus.ts`), no perceptible change.
2. **`blur-[2px]` on the static backdrop image** — diagnostic flag `DROP_BACKDROP_BLUR`, no change.
3. **Entire `SteamProfileBackdrop` layer** — temporarily rendered nothing under `BackdropPortal`, no change.
4. **Tile/row rest-state `perspective(...)` composite layers** — moved to `:hover` only, marginal.
5. **`blur-sm` on the hidden hero-anchor img per tile** — removed, marginal.
6. **TanStack Virtual measurement / teardown** — bumped to `3.13.25` (claims 1382× faster measurement storms), no change.
7. **Achievements virtualizer specifically** — bypassed entirely, achievements → \* became snappy. Initially read as "the virtualizer is the cost"; later understood as "the simpler post-removal DOM made the OLD snapshot cheaper to capture."
8. **CSS group animation override `::view-transition-group(vt-main) { animation: none }`** — documented WebKit issue about sync width/height main-thread cost. No change. This proved the cost lives in *capture*, not in the *animation* phase that runs after capture.

The honest read at the end of the chase: every CSS-level optimization helps marginally but none cross the gap. The cost is in a code path inside WebKit (snapshot capture of complex layer trees) that app-level changes cannot fully reach.

---

## What shipped

A two-part fix:

### 1. WebKit-only bypass of router VT for intra-Steam navs

In [`apps/web/src/lib/navigation-type.ts`](../../../apps/web/src/lib/navigation-type.ts), the `/steam` branch returns `false` when `isWebKit()` is true, skipping `document.startViewTransition` entirely for sibling-tab navs on Safari. Chrome and Firefox continue to get the real VT slide. The bypass is engine-gated by `navigator.vendor === "Apple Computer, Inc."` (see [`apps/web/src/lib/is-webkit.ts`](../../../apps/web/src/lib/is-webkit.ts)) which also catches iOS Chrome/Firefox (both wrap WebKit on iOS).

### 2. Compositor-only CSS slide as the UX substitute

Without VT, Safari users would otherwise see an instant content swap with no animation. To preserve the navigation read, [`apps/web/src/steam/use-safari-slide-direction.ts`](../../../apps/web/src/steam/use-safari-slide-direction.ts) computes the would-be slide direction from the pathname delta (mirroring the same tab-order logic that drives the real VT slide for other engines). [`apps/web/src/routes/steam.tsx`](../../../apps/web/src/routes/steam.tsx) wraps `<Outlet />` in a keyed div with `safari-slide-in-from-{left,right}` when direction is known.

The keyframes (`apps/web/src/styles/view-transitions.css`) deliberately diverge from the VT slide keyframes:

- **No opacity fade.** Real VT animates both OLD (sliding out + fading down) and NEW (sliding in + fading up). With only NEW to animate, an opacity-from-zero fade left the destination invisible for the first ~60ms — the slide felt "more careful" than the cross-engine version. Translate-only keeps NEW fully visible from frame 0.
- **48px translate, 220ms, iOS-style easing `cubic-bezier(0.32, 0.72, 0, 1)`.** Tuned by side-by-side comparison against the Chrome VT version. 24px felt too contained inside the centered `max-w-4xl` column; 64px overshot; 48px reads naturally because `<main>`'s `overflow-x: clip` allows the wrapper to extend visually beyond the column edge into the viewport gutters during the slide.

The animation runs purely on the compositor (transform only, no opacity, no layout-affecting properties), so no main-thread contention with React commits.

### Adjacent commits in the same arc

Several smaller WebKit-specific costs were identified and fixed alongside the main diagnosis:

- [tab indicator boxshadow loop dropped](../../../apps/web/src/routes/steam.tsx#L131) — the infinite `boxShadow` keyframe on the active-tab indicator was running on the main thread on every nav, additive to the VT cost.
- [video pause during VT](../../../apps/web/src/steam/profile-backdrop.tsx) — `BackdropVideo` pauses on `onRouteTransitionStart` to stop the per-frame video → blur chain during the snapshot window.
- [@tanstack/react-virtual bumped to 3.13.25](../../../apps/web/package.json) — the upstream perf release didn't fix our specific issue but the scroll hot path improvements are real wins.
- [Tile/row chrome simplifications](../../../apps/web/src/steam/library/library-tile.tsx) — perspective transforms moved to `:hover`, blur dropped from hero anchors, `decoding="async"` added. Each is a marginal gain that compounds.

---

## Lessons learned

These are the meta-lessons from the arc, separate from the technical fix.

### Use instrumentation first, hypothesis second

The early sessions chased plausible-but-wrong hypotheses (backdrop blur, video, blur filters) using only my own theorizing. Once we switched to **Safari Web Inspector → Timelines → Frames** with expanded frame contents, the data immediately revealed concrete cost sources (massive `Transition Start Event Dispatched` storms; 100ms in `Composite`; minor `Paint` time). Hypotheses were verified or killed in minutes rather than hours of speculation.

Corollary: **always have the user re-record after each change** to confirm whether the change moved the metric, instead of inferring from felt smoothness.

### Treat the user's framing as data

Two pivots in the arc came from the user pushing back:

1. "*Lib → achievements is choppy both ways*" — broke my assumption that "TO wishlist is slow"; reframed as "leaving wishlist is uniquely fast", which redirected investigation toward the source-page-unmount path.
2. "*Direction of navigation seems to matter*" — surfaced the asymmetry that ultimately led to the snapshot-capture diagnosis.

Both observations would have been invisible if the user had just said "Safari is slow." Their structured framing of the symptom was more valuable than any single test we ran.

### Research the problem space before deep code dives

We finally tried `WebSearch` mid-arc to look for prior art and immediately found: TanStack Virtual's "biggest perf release in years" (one patch behind us), React's Activity API papers explicitly acknowledging that "*unmount is expensive enough that we built a new API to avoid it*", and a WebKit mailing-list post documenting the exact main-thread cost we were measuring. **Earlier research would have saved sessions of speculation.** The user explicitly called this out: "*we found more information last time we searched, lets not repeat the mistake of not reaching for research fast enough*."

### Don't fight engine differences with CSS

Many of the CSS-level fixes (blur removal, perspective gating, decoding=async) were directionally correct and incrementally helpful, but none closed the gap because the cost lived inside WebKit's snapshot capture pipeline — a code path no CSS property reaches. **The right move for engine-specific perf cliffs is to gate the feature, not to slowly tune CSS toward parity.** Engine-gating preserves the experience for engines that handle it well while shipping a tailored substitute for the one that doesn't.

### Engineering judgment on stopping points

The arc had three plausible stopping points: accept the gap, ship the engine bypass, ship the bypass + CSS substitute. The user pushed past the first two because "*Safari is a popular browser*" and "*we cannot settle*." The discipline payoff was a third option that didn't exist when we started looking — but the path required both perseverance *and* the willingness to abandon dead ends quickly. Both halves matter.

---

## When to apply this pattern elsewhere

The combination — `isWebKit()` gate that returns `false` from `getNavigationType`, paired with a compositor-only CSS slide hooked into the destination route's mount — is reusable for any future section whose content is heavy enough to make WebKit's VT capture chop. Today that's only Steam; tomorrow it might be TFT (queued in [project-history.md](../project-history.md)) or any future surface with similar layer density.

Mechanism notes:
- The `safari-slide-in-from-*` keyframes are not Steam-specific — any section can apply the classes to a keyed wrapper.
- The `useSafariSlideDirection` hook hard-codes the Steam tab order. Generalization (taking a tab-order array as input) is a quick refactor when a second section opts in. Per [repo-conventions](../../repo-conventions.md) "Three similar lines is better than a premature abstraction" — defer until we have a second consumer.
- Gate decisions should be made per section based on measured Safari perf, not pre-emptively across the board: LoL handles the real VT slide fine on Safari and should continue using it.

---

## Files in scope

- `apps/web/src/lib/navigation-type.ts` (WebKit bypass for `/steam`)
- `apps/web/src/lib/is-webkit.ts` (engine detection)
- `apps/web/src/steam/use-safari-slide-direction.ts` (direction computation)
- `apps/web/src/routes/steam.tsx` (Outlet wrapper with CSS class)
- `apps/web/src/styles/view-transitions.css` (Safari slide keyframes + classes)
- `apps/web/src/steam/profile-backdrop.tsx` (video pause during VT)
- `apps/web/src/lib/route-transition-bus.ts` (transition-start signal)

## Related notes

- [section-shell-vt-migration.md](section-shell-vt-migration.md) — the parent arc that brought VT into the router.
- [perf-baseline.md](perf-baseline.md) — Lighthouse / bundle / Vitals baselines.
- [view-transitions-rollout.md](view-transitions-rollout.md) — original VT rollout sweep.
- KB: [03-motion.md §3 (View Transitions API)](~/.claude/knowledge/frontend-2026/03-motion.md).
