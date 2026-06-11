# `/lab` — experiments section

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Promote only when ≥2 exhibits exist or are in flight — a one-exhibit lab reads as a stub.

## Why

The calm aesthetic — correctly — keeps rejecting loud showcases: [library-shortlist.md](library-shortlist.md) parks r3f ("high gimmick risk"), ogl shaders, Rive; [quick-wins.md](quick-wins.md) calls Houdini PaintWorklet "research-y"; [motion-backlog.md](motion-backlog.md) parks magnetic hover. But "can do bleeding-edge graphics/platform work" is real freelance signal currently filtered out entirely. A `/lab` route resolves the tension **spatially**: lab pages are exempt from the calm test, the main app never is. Parked-as-gimmick ideas get a legitimate home instead of a graveyard.

## Shape

- **Route:** `/lab` index + one route per exhibit, each lazy-loaded and fully code-split — an exhibit's deps must never land in main-app chunks. Section root gets `useScrollResetOnNav` per the [scroll convention](../../repo-conventions.md#scroll-to-top-is-layered-between-root-and-section-roots) once it has children.
- **Exhibit candidates already on file:** Houdini paint worklet; ogl/WebGPU shader ambient (the deferred half of [ambient-home-hero.md](ambient-home-hero.md)); the [Angular bridge](angular-react-bridge.md) as a live embed (only if the companion-repo route proves insufficient); generative-artwork drafts from [visual-differentiation-pool.md](visual-differentiation-pool.md) before one graduates to the recap.
- **Each exhibit ships with its own "how it works" blurb** — the lab is showcase *and* write-up surface, feeding [case-study reader](case-study-reader.md) material.
- **Discovery:** linked from the [colophon](colophon-engineering-surface.md)/footer only, not main nav. The lab must not dilute the calm first impression; it's for the visitor who's already digging.

## Rules (the part worth writing down now)

1. **Exempt from the calm test, NOT from perf budgets.** Every exhibit route gets a perf-probe scenario and budget row per [repo-conventions.md](../../repo-conventions.md#layer-count--paint-budget-per-route-scenario) — a janky lab disproves the exact competence it exists to demonstrate. Heavy exhibits gate behind explicit interaction (click-to-start), never autoplay.
2. **Artifacts only, no editorial upkeep.** The self-portrait brainstorm rejected hand-maintained surfaces (`/uses`, anti-resume — see [vnext-ideas.md](vnext-ideas.md#low-priority--explicitly-deferred)) because they rot. The lab dodges that only if every exhibit is a finished artifact that exists anyway — the moment an exhibit needs recurring content maintenance, it violates the founding rule.
3. **Graduation path:** an exhibit that passes the calm test in practice can be promoted into the main app (the generative artwork → recap hero path); the lab page then documents the evolution.

## Risks / open questions

- Brand dilution if over-linked — mitigated by footer-only discovery, but verify the OG/sitemap story doesn't accidentally make `/lab` a top search entry.
- Reduced-motion/reduced-transparency must still be honored even in loud exhibits (a11y is not an aesthetic preference).
- Open: does `/lab` justify itself before 2 exhibits exist? Cheapest start: build the first exhibit as a lab *route* without an index page, add the index at exhibit #2.
