# Folder structure cleanup — 2026-05-14

Audit of the monorepo layout taken after Steam S2 shipped, before S3 starts. Goal: identify cleanliness wins that can ride between content arcs without disrupting active work. **No code changes proposed mid-arc** — this note exists so the cleanup can be picked up cold when timing fits.

## Verdict at a glance

The repo is structurally sound. Naming is consistent (kebab-case across both apps), no cross-stream leakage (the "Steam under /steam, LoL under /lol" rule holds), no orphan files, no migration sprawl. Two real targets stand out:

1. [apps/web/src/lol/_shared/](../../apps/web/src/lol/_shared/) has grown to **37 files** — supply-closet pattern. Clear taxonomy exists; split is mechanical.
2. [apps/api/src/lol/lol.service.ts](../../apps/api/src/lol/lol.service.ts) is **1,308 LOC / 21 public methods** across 5 cohesive responsibility groups. One extraction (analytics) is clean and earns testability.

Everything else (Steam folder shape, asset-manifest duplication, cross-domain `_shared`) is **decision-deferred until later milestones**, not actionable now.

## Findings (cross-reference with the audit conversation)

### `apps/web/src/lol/_shared/` — 8-bucket taxonomy

| Proposed folder | Files | Notes |
|---|---|---|
| `_shared/assets/` (riot CDN resolvers) | 10 | champion-icon, champion-square-icon, splash-resolver, splash-backdrop, item-icon, keystone-icon, role-icon, summoner-icon, summoner-spell-icon, champion-assets.json |
| `_shared/assets/manifest/` | 3 | asset-manifest.ts, manifest.gen.ts, asset-manifest.test.ts |
| `_shared/patch/` | 4 | patch-version.ts, patch-version.test.ts, use-ddragon-version.ts, this-patch-badge.tsx |
| `_shared/queue/` | 3 | queue-color.ts, queue-filter.tsx, queue-options.ts |
| `_shared/account/` | 4 | account-switcher.tsx, refresh-account-button.tsx, use-account-from-slug.ts, live-game-chip.tsx |
| `_shared/ui/` | 5 | card-tilt.tsx, champion-sticky-strip.tsx, hover-champion-context.tsx, match-pips.tsx, match-record.tsx |
| `_shared/serious-queues/` | 2 | serious-queues.tsx, serious-queues-settings.tsx |
| `_shared/analytics/` | 4 | role-baselines.ts, use-perks.ts, use-summoner-spells.ts, use-hero-scrolled-past.ts |

### `lol.service.ts` — extract analytics methods only

LSP documentSymbol surfaces 5 groups. Recommendation: **only extract group 5** into a new `lol-analytics.service.ts`. The other groups share state (riot client, livePoller, matchIdsCache, events emitter) and splitting them creates coordination tax for no gain.

- Stays in `lol.service.ts` (~900 LOC): match sync/fetch (9 methods), summoner profile (3), rank/snapshot (2), live/SSE (3)
- Moves to `lol-analytics.service.ts` (~400 LOC): `getChampionBuildFlow`, `getChampionExtras`, `getChampionPairs`, `getDuos`, `getChronotype`

The analytics methods are pure read-side, no shared mutable state, and would let those queries be unit-tested against a fixture DB without instantiating the match-sync stack. Module wiring: add the new service to `LolModule` providers; controller injects both.

## Plan

### Chunk 1 — `lol/_shared/` split (non-asset buckets only) (shipped 2026-05-14)

Scope: 6 of the 8 buckets above. Skipped `assets/` and `assets/manifest/` — those get reworked when the asset-pipeline pivot lands (see "When to pick up" below).

Files moved: 22 (account 4 + patch 4 + queue 3 + ui 5 + serious-queues 2 + analytics 4).
Import updates: every consumer of those modules — mechanical, type-checker-driven.

Single PR. No behavior change. Verified with `tokf err pnpm run typecheck:cc` after each bucket move; one commit per bucket so the diff is reviewable.

**Ship note 2026-05-14:** Landed as 6 bucket commits + one fix-up + one biome-format commit. Two surprises worth recording for the asset-bucket pivot:

1. **Alias-only sed is insufficient.** One file (`apps/web/src/lol/champions/champion-patch-history.tsx`) used a relative `../_shared/patch-version` import that the alias-rewrite missed; typecheck caught it but only after the bucket commit landed. Pre-screen *both* `@/lol/_shared/<name>` *and* `\.\./_shared/<name>` before each bucket from now on.
2. **Biome ci wasn't part of the per-bucket loop.** Path-string changes shuffled alphabetical import order and grew some lines past Biome's wrap threshold (16 files needed re-org/re-wrap, plus one residual line from Chunk 2's `lol.controller.ts` that snuck through). Single closing `chore:` commit applied `check:fix:cc`. For the asset-bucket pivot, run `tokf err pnpm run check:cc` once at the end (not per bucket) and absorb the format-only fix-ups into a single trailing commit.

Final state of [apps/web/src/lol/_shared/](../../apps/web/src/lol/_shared/): 6 new bucket subfolders (`account/`, `analytics/`, `patch/`, `queue/`, `serious-queues/`, `ui/`) plus the deferred 13 asset-adjacent files at the root (`champion-icon`, `champion-square-icon`, `splash-resolver` + test, `splash-backdrop`, `item-icon`, `keystone-icon`, `role-icon`, `summoner-icon`, `summoner-spell-icon`, `champion-assets.json`, `champion-theme`, `asset-manifest` + test, `manifest.gen`).

### Chunk 2 — extract `lol-analytics.service.ts` (shipped 2026-05-14)

Scope: 5 methods + their private helpers move to a new file alongside [apps/api/src/lol/lol.service.ts](../../apps/api/src/lol/lol.service.ts). Add to `LolModule` providers. Controller methods that currently call `this.lolService.getDuos(...)` etc. switch to `this.lolAnalyticsService.getDuos(...)`.

Risk: the analytics methods pull from `this.prisma` and a `summoner` lookup helper that's duplicated inline across most methods (every analytics method starts with `summoner = await this.prisma.lolSummoner.findUnique({ where: { gameName_tagLine_region: ... } })`). Worth noting but **not in scope** — extracting that helper is its own pass.

Validation: `tokf test pnpm run test:cc` (the analytics endpoints all have spec files per the [audit](#verdict-at-a-glance) test-layout finding).

**Ship note 2026-05-14:** Landed in a single commit. `lol.service.ts` 1,308 → 939 LOC. `resolveSummoner` made public on LolService so `getChampionExtras` could keep its upsert semantics via `this.lol.resolveSummoner(...)`; the other 4 analytics methods use their inline `findUnique` (out-of-scope inline duplication preserved as planned). Controller spec needed a stub `LolAnalyticsService` provider added — the audit's "all analytics endpoints have spec files" claim turned out to be overstated; only `getMatchesForSummoner` has a controller spec, and no service-level analytics specs exist. Lower-risk than expected.

### Chunk 3 — Steam web feature subfoldering (deferred)

Scope: defer until **any one** of `wishlist`, `library`, or `platform` has ≥3 files. Currently each is 2 files (chip + hook). If S3 adds a playtime view that lives next to library-composition, fold it into `steam/library/` at that moment — don't split preemptively.

**Update 2026-05-14 (post-S3 ship):** `library` now has 3 associated files — `routes/steam/library.tsx`, `steam/owned-games-chip.tsx`, `steam/use-owned-games.ts` — so the numeric threshold is technically met. Re-look at pick-up time, but not yet a clear win: a chip + hook pair is the conventional sibling shape used by `wishlist` and `platform-mix`, and a subfolder for one of the three reads as inconsistent until at least two cross the threshold. **S4.5 (navigation + visual baseline) is the natural moment to re-evaluate** — that phase is likely to add the next round of Steam shared components and may shift the right grouping.

### Chunk 4 — cross-domain `assets/` convention (skip for now)

Scope: hoisting the asset-manifest pattern out of `lol/_shared/` and `steam/_shared/` into a top-level `apps/web/src/_assets/` would only earn its keep if a third domain (TFT) appears. TFT is warm-not-urgent per the open-work index. Revisit when TFT scoping starts.

## When to pick up

**Best slot: post-Steam S3 ship, before Steam S4 starts.** The S4.5 (navigation + visual baseline) phase inserted on 2026-05-14 doesn't shift this window — S4 substrate is API/data-layer-only and S4.5 is entirely Steam-side, so both downstream phases are equally valid boundaries. Three constraints govern this:

1. **Asset-pipeline pivot is the bottleneck.** [lol-image-pipeline.md](lol-image-pipeline.md) is sequenced after Steam S5; the `_shared/assets/` and `_shared/assets/manifest/` buckets will be reworked when the runtime-proxy pivot lands. Splitting them now means doing the same split twice. The plan above already defers them — but if Steam S5 ships and the pivot is still queued, hold Chunk 1's assets sub-split until the pivot is the next thing in line, then bundle them.
2. **Steam S3 shipped 2026-05-14.** No parallel arc active at write-time of this update — no merge-conflict risk on `lol/_shared/`. (Original framing was "S3 is mid-flight"; updating in place rather than rewriting history.) Steam fact-card lives in [steam/_shared/fact-card.tsx](../../apps/web/src/steam/_shared/fact-card.tsx); the LoL split shouldn't reach across the boundary regardless.
3. **Stack-rank against open-work.md.** This is a tidy-up pass, not a content arc. It belongs in the "Adjacent maintenance" lane alongside the host-Chrome re-measure and CodeQL evaluation, not in "Tracked arcs". Take it when there's a content-arc lull or a session that's too short for an arc but too long for a one-shot.

**Don't pick up if:**

- Steam S3 or S4 is open (defer to between-arcs slot).
- A session has <90 minutes remaining (Chunk 1 needs continuous attention to keep imports coherent — partial state on `_shared/` reorgs is painful to resume).
- Context is already >50K tokens from prior work (`/clear` first, then start cold).

**Pre-flight checklist when picking up:**

- [ ] Confirm Steam S3 + S4 are shipped (or explicitly paused).
- [ ] Verify the asset-pipeline pivot hasn't started — if it has, fold this work into it instead.
- [ ] Run `tokf err pnpm run typecheck:cc` cold to confirm baseline is green.
- [ ] Start with Chunk 2 (analytics extraction) — smaller, lower-risk, validates the test loop before the import-heavy Chunk 1.

## Out of scope

- Renaming files within their current folders (no naming inconsistencies found).
- Test-layout changes — co-located `.spec.ts` / `.test.ts` is consistent and good.
- Migration cleanup — schema history is sound.
- `packages/shared/` reorg — already cleanly split by domain.
- Anything touching [apps/api/src/riot/](../../apps/api/src/riot/) — correctly positioned as shared plumbing.
