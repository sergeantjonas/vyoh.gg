# Frontend 2026 — domain sweep queue

**Status:** Active — tracks which frontend-2026 domains have had a **project-audit-then-KB-refresh sweep** as part of vyoh.gg's library/stack evaluation work, and which are next.

> ⚠️ **The exercise is two phases. The order matters. Do NOT skip Phase 1.**
>
> **Phase 1 — Audit the current project** against the KB and 2026 standards in the domain. What are we using? What's stale? What's weird-for-2026? Where does our adoption diverge from the KB's recommendations? This is the load-bearing first step.
>
> **Phase 2 — Distill outward.** Update project-side notes with concrete findings ([frontend-2026-gaps.md](frontend-2026-gaps.md), [quick-wins.md](quick-wins.md), [library-shortlist.md](library-shortlist.md)). THEN extract cross-project KB updates (newer alternatives, deferred-by-default triggers, stack-picker rows) at `~/.claude/knowledge/frontend-2026/` so future sessions on new projects inherit what we learned.

**Why this order matters.** Skipping Phase 1 and jumping straight to "survey newer libraries in this domain" produces generic library research with no project grounding — recommendations come out vague and disconnected from real friction. The Motion / design-systems sweep (2026-05-23) worked **because it started from "examine the CSS and animations used in this app"** — the project audit surfaced the concrete pain points (no `@layer`, doubled scrollbar styling, three stale quick-wins entries) that made the library-alternatives discussion meaningful and the "what to defer" calls grounded in actual code.

If a future session reads only the Phase 2 deliverables (the KB updates, the deferred-by-default triggers, the stack picker) and tries to reproduce them without doing Phase 1 first, the output will be a shallow "what's hot in 2026" list with no useful project decisions. The whole point of pairing them is that Phase 1 produces the questions Phase 2 answers.

Companion files:
- [frontend-2026-gaps.md](frontend-2026-gaps.md) — Phase 1 output: gaps in *this project's* adoption of KB recommendations.
- [library-shortlist.md](library-shortlist.md) — Phase 1 output: per-library decisions in this project.
- [quick-wins.md](quick-wins.md) — Phase 1 output: atomic improvements surfaced by audits.
- `~/.claude/knowledge/frontend-2026/` — Phase 2 output destination: the cross-project KB.

---

## What "the sweep" produces

A complete sweep touches **both layers**. A sweep that produces only KB-side output (or only project-side output) is incomplete.

### Phase 1 — Project audit (project-side artifacts)

1. **Audit the current project's adoption** of the domain. Read source files, grep for the patterns the KB recommends, inspect package.json, identify what's missing, what's stale, what's weird for 2026. Produce a concrete finding list with file:line references.
2. **Update [frontend-2026-gaps.md](frontend-2026-gaps.md)** with project-side gaps — things *this project* should fix to align with the KB. Each gap gets motivation / tension / effort / slot, per the existing Round 1–3 pattern in that file.
3. **Update [quick-wins.md](quick-wins.md)** with atomic improvements (one-commit each) surfaced by the audit. Remove entries that the audit revealed are already shipped (the 2026-05-23 sweep removed three stale entries).
4. **Update [library-shortlist.md](library-shortlist.md)** with per-library decisions the audit produced — including cross-references to relevant [elevation-arcs.md](elevation-arcs.md) entries when the library is a candidate primitive for a planned arc.

### Phase 2 — KB refresh (cross-project artifacts at `~/.claude/knowledge/frontend-2026/`)

5. **Newer alternatives surveyed** in the KB domain file — what's gained traction since the file was last calibrated. Frame the survey around the friction Phase 1 surfaced ("we need X — what's the 2026 answer?"), not generic "what's trendy in domain Y?". Each entry gets when-right / when-wrong / hard-rules.
6. **Deferred-by-default decisions** made explicit — for each "trendy thing future sessions will ask about," document why it's deferred and the **specific triggers** that would flip the call. The Motion+ pattern (paid tier, three concrete reconsider triggers) is the template — see [`~/.claude/knowledge/frontend-2026/03-motion.md` §2.8].
7. **Aesthetic / opinion guidance** where relevant — calm-aesthetic test, "adopt as a system vs cherry-pick" rules, "don't add unless documented trigger fires."
8. **Stack picker contribution** to the KB README's "Quick stack picker by project shape" table if the domain feeds into it (row update or new column).
9. **Cross-references both ways** — KB domain file ↔ KB README ↔ project working notes from Phase 1. Domain file is the source of truth; README surfaces the decision; project notes inherit.

## Tiering rationale

**Tier 1** = domains with **high library-choice variance and significant cost-of-wrong-decision**. These are where future sessions are most likely to make a regrettable call without updated guidance.

**Tier 2** = domains with moderate churn — worth a lighter pass but the cost-of-wrong-decision is lower or recoverable.

**Skip** = domains where the content is primarily spec-driven (W3C / TC39 / WCAG / TS compiler). For these, a periodic **citation-date refresh** is more useful than a library-alternatives sweep. Schedule those independently when major spec milestones land.

## Status

| # | File | Status | Last refresh | Notes |
|---|---|---|---|---|
| 01 | css-and-styling | ⏸️ paired with 02/03 below | 2026-05-23 (indirect) | Got indirect treatment via the vyoh.gg CSS audit; no dedicated pass yet. Tailwind v4, Panda, vanilla-extract, StyleX landscape stable. Low priority. |
| 02 | design-systems | ✅ refreshed | 2026-05-23 | Added animated-component registries subsection (Magic UI / Aceternity / react-bits / Cult UI / OriginUI) with calm-aesthetic test in §8. |
| 03 | motion | ✅ refreshed | 2026-05-23 | Added §2.7 Lenis (smooth-scroll engine, when-right/when-wrong/hard-rules) and §2.8 timeline editors (GSAP / theatre.js / Motion+ deferred-by-default with explicit triggers). README Motion bullet updated. |
| 04 | react-internals | ⏸️ deferred | — | React Compiler 1.0 is current; less library-churn than Tier 1 domains. Revisit if React 20 lands or RSC patterns shift materially. |
| 05 | frameworks | ✅ refreshed | 2026-05-23 | Project-first sweep + KB refresh. Project outputs: Round 5 in frontend-2026-gaps.md (Gap #15 zero route loaders, Gap #16 per-route head() only one site + localhost-bug in og:image URL), new Framework section in library-shortlist.md (TanStack Start parked-active, Next/RR7/Astro/Waku/Million.js/SvelteKit/Nuxt/SolidStart/Qwik rejected with rationale, RedwoodSDK parked for next refresh). KB outputs: §2 Migration considerations + loader-as-forward-compatible-migration-prep pattern + head()/loader pairing pattern, §9 RedwoodSDK / Smith candidate-for-next-refresh stub, §12 per-route metadata absolute-URL gotcha (covers head()/metadata/frontmatter/meta/useHead). |
| 06 | performance | ⏸️ deferred | — | Speculation Rules, PPR, bfcache mostly spec-driven. Schedule citation refresh when Chrome stable bumps Speculation Rules support. |
| 07 | build-tooling | ✅ refreshed | 2026-05-23 | Project-first sweep + KB refresh. Project outputs: Round 6 in frontend-2026-gaps.md (Gap 17 Biome 1.9→2.x, Gap 18 no pnpm catalogs despite 3-site duplicate pins, Gap 19 missing `sideEffects: false` on `@vyoh/shared` barrel), 2 quick-wins (explicit `build.target`, `sideEffects: false` one-liner), new "Build tooling — evaluated alternatives" section in library-shortlist.md (Rolldown standalone, Rspack/Rsbuild, Turbopack, Bun runtime/installer, Deno 2, Turborepo/Nx/Moon, Oxlint, Changesets, tsup). KB outputs: §1.2 Rolldown-native `@rolldown/plugin-babel` for React Compiler, §1.6 Bun deferred-by-default with three triggers + Anthropic caveat + Deno 2 treatment, §3.3 sideEffects on workspace-internal packages, §5.1 catalogs trigger (2+ workspace pins), §5.2 task-runner threshold table + positioning-vs-engineering callout, new §11 Lint and format (Biome 2 / Oxlint / ESLint slot-split with picker), README defaults updated for Build / Lint+format / Package manager / Monorepo / always-skip lists. |
| 08 | typescript | ⏸️ skip (spec-driven) | — | TS 7 / Corsa status is the main update. Citation refresh when Corsa hits beta/GA. |
| 09 | accessibility | ⏸️ skip (spec-driven) | — | WCAG 3 status, EAA compliance dates, screen-reader matrix. Citation refresh annually or when WCAG 3 candidate-recommendation lands. |
| 10 | testing | ✅ refreshed | 2026-05-24 | Project-first sweep + KB refresh. Project outputs: Round 7 in frontend-2026-gaps.md (Gaps 20–27: MSW gap with 22 hand-rolled fetch-stub sites, no visual regression despite splash-parity hard rule, no E2E tier, Storybook deferred, coverage thresholds gate `lines` only, no `test.projects`, no user-event, api include-pattern inconsistency), 3 testing-hygiene quick-wins, new "Testing — evaluated alternatives" section in library-shortlist.md with full visual-regression ranking (Playwright/Vitest in-tree picked; Chromatic/Argos/Percy/Lost Pixel rejected with project-shape rationale; Storybook 9/fast-check/Stryker/Fishery parked with triggers). KB outputs: §7 visual regression rewritten with per-entrant when-right/when-wrong/hard-rules + two-question decision tree (reviewer presence → tool family; Storybook presence → which SaaS), §6 MSW adoption-trigger (5+ files threshold for `vi.stubGlobal("fetch", ...)` reinvention), §5 Storybook deferred-by-default "don't retrofit, pair with next UI-arc" trigger, §14 recommended-stack visual row rewritten reviewer-driven, README decision table gains "Visual regression — which tool?" row + sharpened MSW + Storybook rows, Portfolio shape Tests cell expanded with MSW trigger + in-tree visual regression. |
| 11 | i18n | ⏸️ skip (mostly spec-driven) | — | ICU MessageFormat 2, Intl APIs. Citation refresh when MF2 GA lands. |
| 12 | security | ⏸️ skip (spec-driven) | — | CSP, Trusted Types, SBOM, provenance. Citation refresh when OWASP top 10 updates. |
| 13 | seo | ⏸️ light refresh worth doing | — | AI crawler landscape (ChatGPT-Search, Perplexity, ClaudeBot tokens) shifts faster than W3C specs. Not Tier 1 because the moves are small and additive, but worth a 30-min sweep when convenient. |
| 14 | observability | ⏸️ deferred | — | Sentry / PostHog space stable. New entrants (Highlight, OpenReplay, Datadog RUM evolution) worth a note but lower variance. |
| 15 | realtime-state-forms | ✅ refreshed | 2026-05-23 | Project-first sweep + KB refresh. Project outputs: Gap #14 (per-query `staleTime: Infinity` for patch-keyed static metadata), library-shortlist State/realtime/forms section (Zustand/Jotai/Valtio/Legend-State, RHF/Conform/TanStack Form, sync engines all parked with triggers), live-presence-chip EventSource auth gotcha, tanstack-start-migration persistQueryClient alternative. KB outputs: §1.2 EventSource header-auth gotcha + fetch/ReadableStream fallback, §2.1 persistQueryClient-vs-SSR-loaders trade-off, §2.6 Legend-State v3 entry, §2.7 decision-table row + sharpened "loses when" notes, §3.9–§3.13 new entries (Convex promoted, InstantDB, Triplit, Jazz + PowerSync/Loro/TinyBase one-liners), §3.15 decision-table rows for all new entries. |
| 16 | web-platform-apis | ⏸️ skip (spec-driven) | — | WebGPU, View Transitions, OPFS, WebTransport. Citation refresh when major browser ships a new capability. |
| 17 | cross-platform-edge-auth | 🔵 **Tier 2** | — | Tauri 2.x, Expo SDK 53+, Capacitor 7, Better Auth maturity, passkeys-everywhere status. Edge platforms (Cloudflare Workers vs Vercel Functions vs Deno Deploy vs Bun + Hetzner) deserve a per-shape picker like the one in README. Pick up naturally when this project's owner-auth working note gets reopened — natural timing. |

## Suggested order

1. **17 — cross-platform-edge-auth** *(Tier 2)*
   Pick up opportunistically when [owner-auth.md](owner-auth.md) gets reopened or the [hosting.md](hosting.md) decisions firm up. Don't do it speculatively.

2. **13 — seo** *(light refresh)*
   30-min sweep when convenient. AI crawler tokens are the moving piece.

Tier 1 is complete (15 / 05 / 07 all ✅ refreshed 2026-05-23). Tier 2 testing (10) is now ✅ refreshed 2026-05-24. Only Tier 2 cross-platform-edge-auth and the light SEO refresh remain in the active queue; everything else is deferred or spec-driven.

## How to start a sweep session

When picking up one of the queued domains, work the two phases in order. Do **not** start Phase 2 before Phase 1 has produced concrete findings.

### Phase 1 — Audit the project (start here, always)

1. **Read this file's row** for the domain to anchor scope, then read the current KB domain file at `~/.claude/knowledge/frontend-2026/<NN>-<name>.md` (use `limit`/`offset` — they're 5-7K words each). The KB file tells you what 2026 standards look like in this domain; that's the rubric for the audit.
2. **Audit the current project against the rubric.** Concretely:
   - `ugrep` for the patterns the KB recommends (cascade layers, subgrid, container queries, etc. depending on the domain).
   - Read the relevant source files (`apps/web/src/...`, `apps/api/src/...`, `packages/shared/src/...`).
   - Inspect [apps/web/package.json](../../../apps/web/package.json) and [apps/api/package.json](../../../apps/api/package.json) for missing-or-misplaced dependencies.
   - Note what's missing, what's stale (already shipped but documented as todo), what's weird-for-2026, what KB-recommended primitives are unused.
3. **Write up Phase 1 findings into the project working notes:**
   - **[frontend-2026-gaps.md](frontend-2026-gaps.md)** — new Round (e.g. "Round 4") with adoption gaps. Each gap gets the existing motivation / tension / effort / slot shape.
   - **[quick-wins.md](quick-wins.md)** — atomic improvements (one-commit each); remove any entries the audit revealed as already shipped.
   - **[library-shortlist.md](library-shortlist.md)** — new per-library entries the audit surfaced; cross-link to [elevation-arcs.md](elevation-arcs.md) when relevant.
4. **Stop and review with the owner before starting Phase 2.** Phase 1 findings are themselves valuable and may produce follow-up work that takes priority over the KB refresh. Don't burn through both phases in one shot without a checkpoint.

### Phase 2 — Refresh the KB (only after Phase 1 lands)

5. **Survey what's new** in the domain since the KB file's `last_compiled` date: new libraries, paid-tier launches, runtime entrants, registry growth. **Frame the survey around the friction Phase 1 surfaced**, not generic "what's trendy in this domain?". The audit findings are the questions; this step finds the 2026 answers.
6. **Web search where useful** — primary sources only (vendor release notes, MDN, caniuse, GitHub release pages). Avoid blog-post aggregations.
7. **Identify deferred-by-default candidates** — anything trendy that future sessions will ask about — and write each with concrete reconsider triggers. Motion+ in `03-motion.md §2.8` is the template (paid tier, three explicit triggers).
8. **Update the KB domain file** with the new entries (when-right / when-wrong / hard-rules).
9. **Update the KB README** cross-cutting recommendations or stack picker if the domain feeds into them.
10. **Update this file's row**: flip status to ✅, add `last_refresh` date, summarize what changed in the Notes column.
11. **Commit project-side and KB-side changes separately** if doing both in one session — they have different review audiences.

### Reference template

The Motion / design-systems sweep (2026-05-23) is the worked template. Phase 1 audited vyoh.gg's CSS, animations, HTML, and libraries against the KB → produced **Round 3 in [frontend-2026-gaps.md](frontend-2026-gaps.md)** (Gaps 10–13: cascade layers, subgrid, `@scope`, head baseline extras, plus a weird-for-2026 patterns subsection), **cleanup of [quick-wins.md](quick-wins.md)** (removed three stale entries, reframed mask-image as "audit other horizontal scrollers", added `text-wrap: pretty` and `linear()` easing), and **library entries in [library-shortlist.md](library-shortlist.md)** with cross-references to elevation arcs. Phase 2 then distilled findings into KB-side: `03-motion.md` §2.7 (Lenis) + §2.8 (timeline editors + Motion+ deferred-by-default), `02-design-systems.md` §8 (animated-component registries with calm-aesthetic test), README Motion bullet + new "Quick stack picker by project shape" section.

If a future session produces Phase 2 KB updates without a Phase 1 paper trail in this project's working notes, that sweep is incomplete and should be flagged for redo.

## What this file is NOT

- **Not** a Phase 1 output. Phase 1 findings (concrete project gaps, atomic improvements, library decisions) belong in [frontend-2026-gaps.md](frontend-2026-gaps.md), [quick-wins.md](quick-wins.md), and [library-shortlist.md](library-shortlist.md) — not here. This file only tracks **which domains have been swept** and **what's next**.
- **Not** a Phase 2 output either. Phase 2 deliverables (newer-alternatives entries, deferred-by-default triggers, stack picker updates) live in the KB at `~/.claude/knowledge/frontend-2026/`. This file points at them; it doesn't carry them.
- **Not** a citation-date tracker for the KB. Citation refreshes are a separate cadence; track those per-file in each KB domain's frontmatter (`last_compiled`).
- **Not** auto-loaded into every session. Reference it explicitly when planning a sweep session.
