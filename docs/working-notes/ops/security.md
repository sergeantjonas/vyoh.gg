# Security baseline

**Status:** Active — baseline shipped 2026-05-14. **An endpoint-exposure audit on 2026-08-03 ([api-exposure-audit.md](api-exposure-audit.md)) revised the "rate limiting out of scope" call below into a launch gate**, and CodeQL's stated trigger ("when the project grows an auth surface") now fires alongside owner-auth in the same sweep. Baseline shipped 2026-05-14 (`pnpm audit` in CI, Dependabot alerts + malware alerts + security updates, secret scanning + push protection). Dependency refresh + override re-derivation swept 2026-07-25, taking `pnpm audit` from 41 advisories to 1 (see below). CodeQL SAST deferred as a freelance-signal layer; revisit when bandwidth allows or auth surface lands. Tracked under "Adjacent maintenance" in [open-work.md](../open-work.md).

Captures the supply-chain / credentials layer for this repo and what's deliberately deferred. Right-sized for a solo-dev, no-auth, no-PII, no-payments portfolio project — not a SaaS posture.

## Baseline shipped (2026-05-14)

Prompted by the Mistral / UiPath / TanStack npm compromise ("Mini Shai-Hulud") rumours circulating on Reddit. Audit at the time found zero `router_init.js` IoCs in the dep tree and no flagged TanStack versions — but the absence of *any* security layer in CI was the real gap.

- **`pnpm audit --prod --audit-level=high`** as a separate job in [.github/workflows/ci.yml](../../.github/workflows/ci.yml). `--prod` skips devDep noise; `--audit-level=high` keeps moderates visible but non-blocking — which is what the one accepted `file-type` moderate relies on. No `pnpm install` step — audit reads the lockfile and queries the registry directly.
- **Dependabot alerts** — surfaces new GHSAs against existing deps.
- **Dependabot malware alerts** — supply-chain-specific, catches packages flagged as malware (closest thing to a Shai-Hulud-style early warning).
- **Dependabot security updates** — auto-opens PRs that patch only the vulnerable package.
- **Secret scanning + push protection** — blocks pushes that contain detected credentials (Riot/Steam/DB keys). The Riot key risk is real: leaked keys get scraped and abused within hours.

All four Dependabot/secret-scanning toggles are in repo Settings → Code security. No config files needed.

## Dependency refresh + override re-derivation (2026-07-25)

First sweep after a ~1 month pause. `pnpm audit` had drifted to **41 advisories (2 critical, 17 high, 19 moderate)** and the CI audit job was failing (`pnpm audit --prod --audit-level=high` exiting 1 on `adm-zip` and `find-my-way`). Ended at **1 advisory**, CI gate green.

The drift was not caused by the overrides failing. They were all in effect; the advisories had since *widened past* the floors they pinned. `brace-expansion` is the clearest case: the override covered `>=5.0.0 <5.0.6` while the current advisory range is `<=5.0.7`, which by semver also sweeps in the legacy 1.x and 2.x copies that `minimatch` pulls under `@nestjs/cli`.

**The load-bearing lesson: pin the override range to the advisory's own vulnerable range, not to a fixed floor.** A floor silently stops covering the advisory it was written for; a range that mirrors the advisory surfaces as a fresh finding when upstream widens it. The override block is now written that way and carries a re-derivation date.

What moved, in order:

1. **Caret refresh** (`pnpm update -r`) — cleared 34 of the 41 on its own, including *both* criticals (`shell-quote`, `@xhmikosr/decompress`) transitively. Worth doing first every time: it costs nothing and it re-scopes the actual problem.
2. **sharp 0.34 → 0.35** — cleared the one high on a genuine runtime path. Audited the 0.35 breaking changes (`failOnError`, `paletteBitDepth`, `jp2k`, `sharpen` options) against our call sites; only `.sharpen({ sigma })` is used and it survives.
3. **Override re-derivation** — added `adm-zip`, `find-my-way`, `valibot`; widened `protobufjs`, `ws`, `brace-expansion`, `@hono/node-server`.

**Rejected: concurrently 9 → 10.** Scoped as a fix for the `shell-quote` critical, then measured: concurrently 10.0.3 pins `shell-quote` to an exact `1.8.4` (vulnerable), where 9.2.4 floats to `1.9.0` (patched). The major upgrade *regressed* the posture. Reverted to `^9.2.4`. Don't re-attempt without checking `npm view concurrently@<v> dependencies.shell-quote` first.

**Remaining accepted risk (1 moderate):** `file-type@16.5.4`, reached via `node-vibrant > @vibrant/image-node > @jimp/custom > @jimp/core`. The advisory range starts at `>=13.0.0` so it covers this pinned copy, but `file-type@21` is ESM-only and breaks `@jimp/core`'s `require()`. Enrichment-time path on controlled inputs (our own image pipeline, not user uploads) — accepted. The override still lifts every other copy to 21.x. This clears only when `@jimp/core` or `node-vibrant` moves.

**Not ours to fix:** `find-my-way` and `valibot` arrive through `@prisma/dev` (the local Prisma dev server) and `@hono/node-server` through the `shadcn` CLI. Overridden rather than waiting on upstream, but they'll resolve naturally on a Prisma/shadcn bump.

## Deferred

- **CodeQL (GitHub's free SAST)** — would surface XSS/injection/unsafe-deserialization patterns in our own code, which `pnpm audit` and Dependabot can't see. Not threat-model-justified for this repo (no auth surface, no PII, low traffic), so deferred. Worth doing as **freelance-profile signal** — "I run SAST on my own code" reads well to security-conscious clients. Cost: an extra CI job (~5–10 min) and a triage burden for findings. Revisit when bandwidth allows or when the project grows an auth surface.

## Explicitly out of scope

- **Socket.dev** — supply-chain behavioural analysis, complementary to Dependabot. Considered and skipped: Dependabot malware alerts already covers the highest-probability gap, and a third vendor in the PR-review loop is diminishing returns at this scale. Reconsider if Dependabot misses a real incident.
- **Grouped security updates** — Dependabot UX nicety. Enable later if security PRs start piling up.
- **CSP** — defensive depth for production SaaS. Not justified at portfolio-site scale.
- ~~**Rate limiting, runtime hardening**~~ — **revised 2026-08-03: rate limiting is now a launch gate, not out of scope.** This line was written against a threat model that assumed a read-mostly api with nothing expensive behind it. The [API exposure audit](api-exposure-audit.md) measured the actual surface and found the opposite: several public GETs each turn one cheap request into a live upstream call, a permanent database row, or ~70 ms of blocking CPU, and inbound rate limiting is the control that bounds all of them at once. Scoping it out was a reasonable call on the information available at the time; it is not one now. → [api-exposure-audit.md](api-exposure-audit.md)
