# Parked work index

**Status:** Index — canonical list of deliberately-paused items and their trigger conditions.

One-line pointers to work that was scoped, evaluated, and intentionally set aside — not abandoned, not in flight. Read this when looking for "what could we revisit when the mood strikes" without re-scanning every note for `parked` strings.

**Inclusion rule:** items here are *deliberately parked* — they passed initial scoping and were paused for a stated reason (cost, sequencing, dependency, marginal payoff). Items that were rejected outright belong in their owning note's decision log, not here. Items that are *next-up open work* belong in [open-work.md](open-work.md), not here.

**Maintenance rule:** when a parked item is revived (promoted to active work), closed as won't-do, or made obsolete, edit this file in the same commit that records the change. The detail lives in the owning note; this index only carries the one-line hook and trigger condition.

---

## Active parked items

### Storage / data layer

- **Match cache storage Tiers 1B + 2 + 3** — global field stripping on potentially-useful fields, then zstd BYTEA, then zstd dictionary. Tier 1A (owner-only retention) promoted to active work 2026-05-16 — see [open-work.md](open-work.md). These three remain deferred until DB size becomes a cost/quota concern *or* feature scope on Profile / Matches / Trends / Champions / Match detail feels stable. Tiers 0/4/5 explicitly remain safe-anytime. → [match-cache-storage.md](match-cache-storage.md)

### Match depth / Phase B + C remainders

- **Build-order component-collapse-into-completed-item** — requires per-item component-tree resolution against the items dataset + runtime matching against timeline build events. Closed as won't-do 2026-05-10; revisit if a clean dataset surfaces. → [match-depth-roadmap.md decision log](match-depth-roadmap.md#decision-log-update-as-we-go)
- **Build-order hover-to-highlight-components** — same dependency family as component-collapse above. Parked indefinitely 2026-05-10. → [match-depth-roadmap.md decision log](match-depth-roadmap.md#decision-log-update-as-we-go)
- **Boot tier-1 → tier-2 collapse in build order** — meaningful complexity for marginal readability gain; consumables toggle already handles main clutter. Closed as won't-do 2026-05-10. → [match-depth-roadmap.md decision log](match-depth-roadmap.md#decision-log-update-as-we-go)
- **Soul drake element type from Match-V5** — endpoint doesn't expose dragon type on `team.objectives`; would need Phase B timeline events. Parked 2026-05-10. → [match-depth-roadmap.md decision log](match-depth-roadmap.md#decision-log-update-as-we-go)

### Riot rate-limit follow-ups

- **Per-account cache TTL self-healing** — auto-tighten/loosen Bottleneck reservoir per account based on observed 429 cadence. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)
- **Re-derive `reservoirIncreaseInterval` for prod-tier key** — current values are dev-tier calibrated; revisit when prod key lands. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)
- **Parallel-account sync fairness** — only matters if accounts ever run in parallel; today they're serialized. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)

### Self-portrait surfaces (not chosen as next tile)

- **You-vs-you comparison surface** — same axes, two time windows. Owner flagged as reasonable but lower-priority than career-arc / tilt-protection / aesthetic-responses; revisit after those prove out. → [self-portrait-surfaces.md](self-portrait-surfaces.md)

### Motion / polish

- **Magnetic hover on key buttons** — cursor proximity pulls the button. High gimmick risk; one or two hero CTAs at most. Revisit only when other polish is complete. → [motion-backlog.md](motion-backlog.md)
- **First-visit cascade reveal across Trends layout** — header → summary → chart → list staggered cascade with per-session suppression. Parked alongside the shipped Trends entrance. → [motion-backlog.md](motion-backlog.md)

### Library / dependency picks

- **Recharts → visx consolidation** — 77 kB lazy chunk; both libraries coexist by design (visx for non-stock viz, Recharts for stock cases). Not a "park then ship" — this is a deliberate co-existence. → [library-shortlist.md](library-shortlist.md)
- **~22 parked library evaluations** — alternative routers, data-table libs, animation libs, charting libs, etc. that were considered and set aside. Bundled here rather than enumerated; the shortlist note is the source of truth. → [library-shortlist.md](library-shortlist.md)

### Case study / write-up tail

- **Production-tier API key behaviour, per-account TTL self-healing, parallel-account fairness as a case-study angle** — third pass, gated on the underlying engineering becoming real concerns. → [case-study-topics.md](case-study-topics.md)

---

## Pre-deploy (not parked, deliberately sequenced)

These aren't parked — they're a separate sequence gated on the pre-launch sweep. Listed here for completeness so the reader doesn't conflate "waiting for hosting" with "indefinitely paused":

- **Owner auth (GitHub OAuth + `OwnerGuard`)** → [owner-auth.md](owner-auth.md)
- **CORS hardening, prod env vars, hosting choice** → [hosting.md](hosting.md)

The full pre-launch sweep is one deliberate arc, not background drift. See [open-work.md](open-work.md) for current state.

---

## Revival checklist

When picking a parked item back up:

1. Read the original decision context (linked note) — the trigger condition might still hold, in which case keep it parked.
2. Confirm the dependency or cost reason that drove the park is actually resolved.
3. Promote to [open-work.md](open-work.md) with a one-line state.
4. Edit this file in the same commit that records the revival — remove the entry or move it under a "Revived" header if the history matters.
