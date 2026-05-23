# Frontend 2026 KB — refresh queue

**Status:** Active — tracks which domain files in `~/.claude/knowledge/frontend-2026/` have had a "newer alternatives + deferred-by-default + stack picker" refresh as part of vyoh.gg's library/stack evaluation work, and which are next.

Companion to [frontend-2026-gaps.md](frontend-2026-gaps.md) (which tracks gaps in the project's adoption of KB recommendations) and [library-shortlist.md](library-shortlist.md) (which tracks per-library decisions in the project). This file tracks gaps in the **KB itself** — the upstream documentation that those other notes consult.

The KB lives at `~/.claude/knowledge/frontend-2026/` (cross-project), but the work of refreshing it has happened during this project's library/stack evaluation sessions, so the queue tracking lives here.

---

## What "the exercise" is

When a domain file gets a refresh pass, the output is:

1. **Newer alternatives surveyed** — what's gained traction since the file was last calibrated (new libraries, paid tiers, registries, runtime entrants). Each gets a short entry: what it is, when it wins over the current default, when it loses.
2. **Deferred-by-default decisions made explicit** — for each "trendy thing future sessions will ask about," document why it's deferred and the **specific triggers** that would flip the call. The Motion+ pattern (paid tier, three concrete reconsider triggers) is the template — see [`~/.claude/knowledge/frontend-2026/03-motion.md` §2.8].
3. **Aesthetic / opinion guidance where relevant** — calm-aesthetic test, "adopt as a system vs cherry-pick" rules, "don't add unless documented trigger fires."
4. **Stack picker contribution where the domain feeds into one** — the KB README's "Quick stack picker by project shape" table should get a row update or new column when domain choices change.
5. **Cross-references both ways** — KB domain file ↔ KB README ↔ this project's working notes (`library-shortlist.md`, `frontend-2026-gaps.md`, `elevation-arcs.md`). Domain file is the source of truth; README surfaces the decision; project notes inherit.

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
| 05 | frameworks | 🟡 **Tier 1 — do next (after 15)** | — | Meta-framework choice is the highest-stakes single decision. Refresh: Next 16 PPR maturity, TanStack Start 1.x status, RedwoodSDK / Smith landing, Waku gaining ground, Million.js compiler status, "is Astro still right for content vs Next static rendering?". Pairs naturally with 15 because SSR boundary interacts with realtime architecture. |
| 06 | performance | ⏸️ deferred | — | Speculation Rules, PPR, bfcache mostly spec-driven. Schedule citation refresh when Chrome stable bumps Speculation Rules support. |
| 07 | build-tooling | 🟡 **Tier 1 — do third** | — | Refresh: Rolldown-in-Vite-8 status, Turbopack vs Rspack vs Webpack-legacy, **oxc / oxlint** challenging Biome on lint+format slot, Bun-as-runtime vs Bun-as-installer vs Node 22+ vs Deno 2 (give this the Motion+ deferred-by-default treatment), monorepo tools (Turborepo / Nx / Moon). |
| 08 | typescript | ⏸️ skip (spec-driven) | — | TS 7 / Corsa status is the main update. Citation refresh when Corsa hits beta/GA. |
| 09 | accessibility | ⏸️ skip (spec-driven) | — | WCAG 3 status, EAA compliance dates, screen-reader matrix. Citation refresh annually or when WCAG 3 candidate-recommendation lands. |
| 10 | testing | 🔵 **Tier 2** | — | Vitest 4 / Playwright are stable. Visual regression has new entrants worth ranking: Chromatic vs Percy vs Argos vs Lost Pixel. Storybook 9 + test-runner integration shifting. Lower variance than Tier 1. |
| 11 | i18n | ⏸️ skip (mostly spec-driven) | — | ICU MessageFormat 2, Intl APIs. Citation refresh when MF2 GA lands. |
| 12 | security | ⏸️ skip (spec-driven) | — | CSP, Trusted Types, SBOM, provenance. Citation refresh when OWASP top 10 updates. |
| 13 | seo | ⏸️ light refresh worth doing | — | AI crawler landscape (ChatGPT-Search, Perplexity, ClaudeBot tokens) shifts faster than W3C specs. Not Tier 1 because the moves are small and additive, but worth a 30-min sweep when convenient. |
| 14 | observability | ⏸️ deferred | — | Sentry / PostHog space stable. New entrants (Highlight, OpenReplay, Datadog RUM evolution) worth a note but lower variance. |
| 15 | realtime-state-forms | 🔴 **Tier 1 — do first** | — | **Biggest unfinished one.** Local-first / sync-engine space is the hottest area in 2026: TanStack DB (launched 2025), Electric SQL, InstantDB, Convex, Triplit, Jazz, Y.js, Automerge — overlapping pitches, real architectural lock-in, easy to pick wrong. Realtime transport (SSE vs WebSocket vs WebTransport) shifting as WebTransport Safari support lands. State libs (Zustand / Jotai / Valtio / Legend-State) need a 2026 slot-matrix. Highest variance in cost-of-wrong-decision. |
| 16 | web-platform-apis | ⏸️ skip (spec-driven) | — | WebGPU, View Transitions, OPFS, WebTransport. Citation refresh when major browser ships a new capability. |
| 17 | cross-platform-edge-auth | 🔵 **Tier 2** | — | Tauri 2.x, Expo SDK 53+, Capacitor 7, Better Auth maturity, passkeys-everywhere status. Edge platforms (Cloudflare Workers vs Vercel Functions vs Deno Deploy vs Bun + Hetzner) deserve a per-shape picker like the one in README. Pick up naturally when this project's owner-auth working note gets reopened — natural timing. |

## Suggested order

1. **15 — realtime-state-forms** *(Tier 1)*
   The local-first / sync-engine landscape changes monthly and the cost of picking the wrong sync engine (e.g. committing to Electric SQL then needing Convex's reactivity model, or building on Zustand-as-server-state when TanStack Query is the right slot) is days-to-weeks of refactor. Start here.

2. **05 — frameworks** *(Tier 1)*
   Pairs naturally with 15 because realtime architecture interacts with SSR boundary (RSC + sync engines, hydration cost on collaborative surfaces). Meta-framework picks compound — refresh after 15 so the sync-engine ranking is fresh when evaluating "which framework integrates cleanly with which sync engine."

3. **07 — build-tooling** *(Tier 1)*
   Independent of 15/05, lower stakes, easy win. Good "fresh-context" session — doesn't need 15 or 05 loaded.

4. **17 — cross-platform-edge-auth** *(Tier 2)*
   Pick up opportunistically when [owner-auth.md](owner-auth.md) gets reopened or the [hosting.md](hosting.md) decisions firm up. Don't do it speculatively.

5. **10 — testing** *(Tier 2)*
   Lowest variance among the queue. Visual-regression ranking is the main payoff. Pick up when a project's testing strategy is being scoped.

6. **13 — seo** *(light refresh)*
   30-min sweep when convenient. AI crawler tokens are the moving piece.

After Tier 1 is done (15 / 05 / 07), the bulk of the high-variance KB churn is captured. Tier 2 + skips can rotate on slower cadence.

## How to start a refresh session

When picking up one of the queued domains:

1. Read this file's row for the domain to anchor scope.
2. Read the current KB domain file at `~/.claude/knowledge/frontend-2026/<NN>-<name>.md` (use `limit`/`offset` — they're 5-7K words each).
3. Survey what's changed since the file's `last_compiled` date: new libraries, paid-tier launches, runtime entrants, registry growth. Web search where useful — primary sources only (vendor release notes, MDN, caniuse, GitHub release pages).
4. Identify deferred-by-default candidates — anything trendy that future sessions will ask about — and write each with concrete reconsider triggers.
5. Update the KB README cross-cutting recommendations or stack picker if the domain feeds into them.
6. Update this file's row: flip status to ✅, add `last_refresh` date, summarize what changed in notes.
7. If the refresh produced project-side decisions, update [library-shortlist.md](library-shortlist.md) and/or [frontend-2026-gaps.md](frontend-2026-gaps.md) so the project's adoption stays consistent with the KB.

The Motion / design-systems refresh (2026-05-23) is the template — three KB files touched (domain + README), with cross-references both directions, and project-side [library-shortlist.md](library-shortlist.md) updated to match. Reference `~/.claude/knowledge/frontend-2026/03-motion.md` §2.7-§2.8 and `~/.claude/knowledge/frontend-2026/02-design-systems.md` §8 "Animated-component registries" for shape.

## What this file is NOT

- **Not** a citation-date tracker for the KB. Citation refreshes are a separate cadence; track those per-file in each KB domain's frontmatter (`last_compiled`).
- **Not** the KB itself. The KB at `~/.claude/knowledge/frontend-2026/` is cross-project; this file is a project-scoped queue of work this project's sessions have committed to doing in it.
- **Not** auto-loaded into every session. Reference it explicitly when planning a KB refresh session.
