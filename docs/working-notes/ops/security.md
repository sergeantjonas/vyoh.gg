# Security baseline

**Status:** Active — baseline shipped 2026-05-14. **An endpoint-exposure audit on 2026-08-03 ([api-exposure-audit.md](api-exposure-audit.md)) revised the "rate limiting out of scope" call below into a launch gate**, and CodeQL's stated trigger ("when the project grows an auth surface") fired when owner-auth shipped on 2026-08-13; the evaluation is sequenced **post-launch** in [pre-launch-sweep.md](pre-launch-sweep.md), not before. Baseline shipped 2026-05-14 (`pnpm audit` in CI, Dependabot alerts + malware alerts + security updates, secret scanning + push protection). Dependency refresh + override re-derivation swept 2026-07-25, taking `pnpm audit` from 41 advisories to 1 (see below). CodeQL SAST deferred as a freelance-signal layer; revisit after launch. Tracked under "Adjacent maintenance" in [open-work.md](../open-work.md).

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

**2026-09-01 re-derivation.** The audit job had been red on every push to `main` since 2026-08-16 — three runs, each failing that job alone while lint, tests and the bundle budget passed. Three high advisories had surfaced since the sweep, all transitive and all on `--prod` paths: `nanoid` (GHSA-2v37-7h3g-55p8, widened past the `<3.3.17` floor the override pinned — the exact case the range-tracking lesson above describes), and `deepmerge-ts` + `mysql2` under the `prisma` CLI, which pins both exactly. Overrides added mirroring the advisory ranges; `prisma generate`, the api build and the api suite pass on `deepmerge-ts@8.0.2` / `mysql2@3.24.2`. Back to the one accepted moderate.

**2026-09-02 re-derivation.** Caught locally by the state review the day after the previous fix, before it reached CI: four high `fast-uri` advisories (SSRF and host confusion, all patched in 3.1.6) landed past the `<3.1.5` floor — the same range-vs-floor failure as `nanoid` and `brace-expansion` before it, one patch version later. Override widened to mirror the advisory. Took the two moderate `qs` advisories (`express > body-parser`, a request path) in the same pass so Dependabot has nothing to fail on; `qs@6.16.0` resolves cleanly and the api suite passes. Back to the one accepted moderate.

**2026-09-06 check, nothing to derive.** `pnpm audit --prod --audit-level=high` and the full `pnpm audit` both report only the accepted `file-type@16` moderate under `@jimp/core`; no advisory has widened past an override range since the 2026-09-02 pass, so the block stands as written. Next check on the next Dependabot alert or CI audit failure, whichever comes first.

**2026-09-16 re-derivation.** The audit job was red on both pushes to `main` since the 2026-09-06 check — alone on the later of the two, alongside a since-fixed `bg-card` lint failure on the earlier. Five high advisories, three shapes. `sharp` and `js-yaml` were the familiar floor-vs-range failure: `sharp@0.35.4` patches a bundled libheif and the caret in both manifests already allowed it, so the fix was a lockfile bump with the declared floor raised to match, while the `maxTotalMergeKeys` advisory widened one patch version past the `<4.3.1` the override pinned, patched in `js-yaml@4.3.2`. `multer` is a shape this note had not seen: `@nestjs/platform-express` depends on an exact `2.2.0`, so three DoS advisories (crafted field names, a descriptor leak on aborted uploads, an oversized array index, all patched in 2.3.0) had no lever but an override — nothing in the tree could lift it on its own. The api mounts no multipart route, so nothing reaches the parser today; the override keeps that true for whatever adds one. `adm-zip` came along on the `qs` precedent: GHSA-vwc7-r8mq-g2x9 — extraction following a symlink at the destination, a different class from the crafted-ZIP OOM that override was written for — widened to `<=0.6.0` and swallowed the floor the block itself had set, which puts it below CI's `--audit-level=high` gate but squarely in Dependabot's. Note for the next pass, so it is not re-derived: the advisory still records no patched version (last updated 2026-09-08, where 0.6.1 published on the 11th), so `^0.6.1` clears the audit by leaving the range rather than by a recorded fix. The fix is real — `assertPathSafe()` walks each path component with `lstatSync`/`isSymbolicLink` in 0.6.1, and neither call appears anywhere in 0.6.0. `multer@2.4.0` drops `concat-stream`, and `sharp@0.35.4` carries libvips 8.18.6. Verified past the build: a sharp raster, an `onnxruntime-node` load through adm-zip's prebuilt unpack, a `steam-user` load, and the full suite. Back to the one accepted moderate.

**Not ours to fix:** `find-my-way` and `valibot` arrive through `@prisma/dev` (the local Prisma dev server) and `@hono/node-server` through the `shadcn` CLI. Overridden rather than waiting on upstream, but they'll resolve naturally on a Prisma/shadcn bump.

## Deferred

- **CodeQL (GitHub's free SAST)** — would surface XSS/injection/unsafe-deserialization patterns in our own code, which `pnpm audit` and Dependabot can't see. Not threat-model-justified for this repo (no auth surface, no PII, low traffic), so deferred. Worth doing as **freelance-profile signal** — "I run SAST on my own code" reads well to security-conscious clients. Cost: an extra CI job (~5–10 min) and a triage burden for findings. Revisit when bandwidth allows or when the project grows an auth surface.

## Explicitly out of scope

- **Socket.dev** — supply-chain behavioural analysis, complementary to Dependabot. Considered and skipped: Dependabot malware alerts already covers the highest-probability gap, and a third vendor in the PR-review loop is diminishing returns at this scale. Reconsider if Dependabot misses a real incident.
- **Grouped security updates** — Dependabot UX nicety. Enable later if security PRs start piling up.
- **CSP** — defensive depth for production SaaS. Not justified at portfolio-site scale.
- ~~**Rate limiting, runtime hardening**~~ — **revised 2026-08-03: rate limiting is now a launch gate, not out of scope.** This line was written against a threat model that assumed a read-mostly api with nothing expensive behind it. The [API exposure audit](api-exposure-audit.md) measured the actual surface and found the opposite: several public GETs each turn one cheap request into a live upstream call, a permanent database row, or ~70 ms of blocking CPU, and inbound rate limiting is the control that bounds all of them at once. Scoping it out was a reasonable call on the information available at the time; it is not one now. → [api-exposure-audit.md](api-exposure-audit.md)
