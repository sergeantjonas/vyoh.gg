# Parked work index

**Status:** Index — canonical list of deliberately-paused items and their trigger conditions.

One-line pointers to work that was scoped, evaluated, and intentionally set aside — not abandoned, not in flight. Read this when looking for "what could we revisit when the mood strikes" without re-scanning every note for `parked` strings.

**Inclusion rule:** items here are *deliberately parked* — they passed initial scoping and were paused for a stated reason (cost, sequencing, dependency, marginal payoff). Items that were rejected outright belong in their owning note's decision log, not here. Items that are *next-up open work* belong in [open-work.md](open-work.md), not here.

**Maintenance rule:** when a parked item is revived (promoted to active work), closed as won't-do, or made obsolete, edit this file in the same commit that records the change. The detail lives in the owning note; this index only carries the one-line hook and trigger condition.

---

## Active parked items

### Storage / data layer

- **Match cache storage Tiers 1B + 2 + 3** — global field stripping on potentially-useful fields, then zstd BYTEA, then zstd dictionary. Tier 1A (owner-only retention) promoted to active work 2026-05-16 — see [open-work.md](open-work.md). These three remain deferred until DB size becomes a cost/quota concern *or* feature scope on Profile / Matches / Trends / Champions / Match detail feels stable. Tiers 0/4/5 explicitly remain safe-anytime. → [match-cache-storage.md](lol/match-cache-storage.md)

### Match depth / Phase B + C remainders

- **Build-order component-collapse-into-completed-item** — requires per-item component-tree resolution against the items dataset + runtime matching against timeline build events. Closed as won't-do 2026-05-10; revisit if a clean dataset surfaces. → [match-depth-roadmap.md decision log](lol/match-depth-roadmap.md#decision-log-update-as-we-go)
- **Build-order hover-to-highlight-components** — same dependency family as component-collapse above. Parked indefinitely 2026-05-10. → [match-depth-roadmap.md decision log](lol/match-depth-roadmap.md#decision-log-update-as-we-go)
- **Boot tier-1 → tier-2 collapse in build order** — meaningful complexity for marginal readability gain; consumables toggle already handles main clutter. Closed as won't-do 2026-05-10. → [match-depth-roadmap.md decision log](lol/match-depth-roadmap.md#decision-log-update-as-we-go)
- **Soul drake element type from Match-V5** — endpoint doesn't expose dragon type on `team.objectives`; would need Phase B timeline events. Parked 2026-05-10. → [match-depth-roadmap.md decision log](lol/match-depth-roadmap.md#decision-log-update-as-we-go)

### Riot rate-limit follow-ups

- **Per-account cache TTL self-healing** — auto-tighten/loosen Bottleneck reservoir per account based on observed 429 cadence. → [riot-investigation-2026-05-07.md](lol/riot-investigation-2026-05-07.md)
- **Re-derive `reservoirIncreaseInterval` for prod-tier key** — current values are dev-tier calibrated; revisit when prod key lands. → [riot-investigation-2026-05-07.md](lol/riot-investigation-2026-05-07.md)
- **Parallel-account sync fairness** — only matters if accounts ever run in parallel; today they're serialized. → [riot-investigation-2026-05-07.md](lol/riot-investigation-2026-05-07.md)

### Self-portrait surfaces (not chosen as next tile)

- **You-vs-you comparison surface** — same axes, two time windows. I flagged this as reasonable but lower-priority than career-arc / tilt-protection / aesthetic-responses; revisit after those prove out. → [self-portrait-surfaces.md](cross-cutting/self-portrait-surfaces.md)

### LoL owner-data — surface-specific tiers

- **Champion-detail owner-data tier** — 5 bundled tiles (lane dominance peaks, skillshot accuracy, rune WR correlation, spell usage ratio, CC contribution). Parked 2026-05-21 because Champion detail has no planned arc on the books. Trigger: next dedicated Champion-detail polish/expansion pass, or one tile growing legs and pulling the others. Lift all 5 together — they share aggregation work and the surface deserves one design pass. → [lol-owner-data-features.md § Champion-detail tier](lol/lol-owner-data-features.md#champion-detail-owner-data-tier)
- **Objective presence tile** — `dragonTakedowns`/`baronTakedowns`/`riftHeraldTakedowns` per role/champion. Parked 2026-05-21: my role mix has too few jungle games to justify a top-level Profile tile. Trigger: sustained 30%+ of games in jungle. → [lol-owner-data-features.md § overflow](lol/lol-owner-data-features.md#profile-narrative-tier--overflow)
- **Support effectiveness tile** — `effectiveHealAndShielding` for enchanter games. Parked 2026-05-21: I don't main support. Trigger: sustained 30%+ of games in support/enchanter. → [lol-owner-data-features.md § overflow](lol/lol-owner-data-features.md#profile-narrative-tier--overflow)

### LoL signal calibration

- **Personal-baselines PB4** — cross-tile anomaly aggregator. Parked 2026-05-20: PB1+PB2+PB3 shipped 2026-05-14 but no new personal-baseline tiles have shipped since. Trigger: 2–3 more personal-baseline tiles shipped past the current PB1–PB3 set. → [personal-baselines.md](lol/personal-baselines.md)

### Motion / polish

- **Magnetic hover on key buttons** — cursor proximity pulls the button. High gimmick risk; one or two hero CTAs at most. Revisit only when other polish is complete. → [motion-backlog.md](cross-cutting/motion-backlog.md)
- **First-visit cascade reveal across Trends layout** — header → summary → chart → list staggered cascade with per-session suppression. Parked alongside the shipped Trends entrance. → [motion-backlog.md](cross-cutting/motion-backlog.md)
- **Optional UI audio — warm-acoustic v2 (curated `.ogg` samples)** — synth v1 shipped 2026-06-11 ([optional-ui-audio.md](cross-cutting/optional-ui-audio.md)) with 8-slot Web Audio recipes. Warm-acoustic v2 was the original spec: sourced/edited acoustic samples (wooden plucks, glass bells, soft breath) layered behind the same bus. Trigger: real user feedback that synth tones read as cold/cheap, or a free block to curate ~8 CC samples + run an A/B against synth. Swap is at the recipe layer; bus + hook + toggle + call-sites are stable. → [optional-ui-audio.md § Sound vocabulary](cross-cutting/optional-ui-audio.md#sound-vocabulary)

### Library / dependency picks

- **Recharts → visx consolidation** — 77 kB lazy chunk; both libraries coexist by design (visx for non-stock viz, Recharts for stock cases). Not a "park then ship" — this is a deliberate co-existence. → [library-shortlist.md](cross-cutting/library-shortlist.md)
- **~22 parked library evaluations** — alternative routers, data-table libs, animation libs, charting libs, etc. that were considered and set aside. Bundled here rather than enumerated; the shortlist note is the source of truth. → [library-shortlist.md](cross-cutting/library-shortlist.md)

### Structural / hygiene

- **LoL service trio god-class watch (D1)** — [`lol.service.ts`](../../apps/api/src/lol/lol.service.ts) (1026L), [`lol-static-sync.service.ts`](../../apps/api/src/lol/lol-static-sync.service.ts) (1076L), [`lol-analytics.service.ts`](../../apps/api/src/lol/lol-analytics.service.ts) (1059L). Trigger: any new arc that would extend one of these past ~1250L (new analytics dimension, new static sync source, new core-service orchestration responsibility). Likely-splits sketched in the note. Standing watch — do NOT pre-emptively split. **The trigger fired once and was actioned:** `lol-analytics.service.ts` reached 1443L and was split on 2026-07-26, moving the five `championKey`-scoped methods to [`lol-champion-analytics.service.ts`](../../apps/api/src/lol/lol-champion-analytics.service.ts) (423L) and leaving 1059L behind. The watch stands for all three files. → [project-hygiene-2026-05-31.md § D1](cross-cutting/project-hygiene-2026-05-31.md)
- ~~**API response DTOs as shared types (D4)**~~ — **closed 2026-07-26, premise was stale.** Its trigger fired (the route-loader pilot) and measuring first showed the target shape already shipped: 0 of 61 web fetch sites infer, 58 already import the response type from `@vyoh/shared`. The residual 6 sites are now a sub-session item in [open-work.md](open-work.md). → [project-hygiene-2026-05-31.md § D4](cross-cutting/project-hygiene-2026-05-31.md)

### Runtime validation

- **Runtime validation of API response payloads** — `class-validator` guards request params only ([apps/api/src/main.ts](../../apps/api/src/main.ts)); no response body is validated at either end, and the workspace has no zod/valibot/arktype. Types are compile-time only, so a shape that drifts at runtime (upstream Riot/Steam change, a cache row written by an older schema) surfaces as an undefined-access crash rather than a caught error. Deliberately not adopted: it costs a dependency and a parse at every boundary to defend against a failure that has not happened. **Trigger: a real payload-shape incident**, or adopting a schema lib for another reason (forms, env parsing) that makes the marginal cost near-zero. Surfaced by the D4 closure audit 2026-07-26. → [project-hygiene-2026-05-31.md § D4](cross-cutting/project-hygiene-2026-05-31.md)

### Case study / write-up tail

- **Production-tier API key behaviour, per-account TTL self-healing, parallel-account fairness as a case-study angle** — third pass, gated on the underlying engineering becoming real concerns. → [case-study-topics.md](cross-cutting/case-study-topics.md)

---

## Pre-deploy (not parked, deliberately sequenced)

These aren't parked — they're a separate sequence gated on the pre-launch sweep. Listed here for completeness so the reader doesn't conflate "waiting for hosting" with "indefinitely paused":

- **Owner auth (GitHub OAuth + `OwnerGuard`)** → [owner-auth.md](ops/owner-auth.md)
- **CORS hardening, prod env vars, backups** → [hosting.md](ops/hosting.md)
- ~~TanStack Start + SSR migration~~ — shipped 2026-07-27 → [tanstack-start-migration.md](cross-cutting/tanstack-start-migration.md)

The full pre-launch sweep is one deliberate arc, not background drift; its canonical gate list is [ops/pre-launch-sweep.md](ops/pre-launch-sweep.md), with current state in [open-work.md](open-work.md).

---

## Revival checklist

When picking a parked item back up:

1. Read the original decision context (linked note) — the trigger condition might still hold, in which case keep it parked.
2. Confirm the dependency or cost reason that drove the park is actually resolved.
3. Promote to [open-work.md](open-work.md) with a one-line state.
4. Edit this file in the same commit that records the revival — remove the entry or move it under a "Revived" header if the history matters.
