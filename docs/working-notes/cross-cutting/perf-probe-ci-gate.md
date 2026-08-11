# perf-probe as a CI gate

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Promote after CI exists for the repo (hosting/pre-deploy sweep) — gating locally-run-only budgets is the current state, not a failure.

## Why

The per-route layer/raster budget table in [repo-conventions.md](../../repo-conventions-web.md#layer-count--paint-budget-per-route-scenario) is enforced by convention and reviewer discipline today. Wiring [`tools/perf-probe`](../../../tools/perf-probe/) into CI turns it into a regression gate — and "I built a compositor-budget CI gate" is a perf-specialist artifact essentially nobody has. Bundle-size budgets and Lighthouse CI (both tracked in [vnext-ideas.md](vnext-ideas.md#foundational--invisible-but-valuable-) Observability) measure payload and lab scores; this gates **layer count, raster cost, and dropped frames** — the metrics the project actually budgets.

## Shape

- **PR job:** run the probe headless (chromium already; CI-friendly) for the four baselined scenarios + any scenario the PR's route touches, against the built app (not dev server — note the baselines were taken on dev; recalibration is part of scoping).
- **Delta-based, not absolute.** Probe numbers vary 10–20 % run-to-run and CI runners have different GPU/CPU characteristics than the dev machine — absolute budgets calibrated locally will false-positive in CI. Honest design: run **main and the PR head in the same job on the same runner**, compare deltas, apply the conventions' own rules (3-run bracket for raster medians; layer-count overshoot > ~50; **any** non-zero dropped-frame count fails without bracketing).
- **Artifact output:** a JSON summary committed/uploaded per run — which the [colophon](colophon-engineering-surface.md) "budgets vs actuals" band can read directly. The two notes compound.
- **Escape hatch:** a PR label or commit-message token for intentional floor-raises (the conventions already require widening the budget row in the same change — the gate should enforce that the table edit accompanies the overshoot, not block the overshoot itself).

## Sequencing / dependencies

- Needs repo CI (gated on the hosting/pre-deploy sweep in [../ops/hosting.md](../ops/hosting.md)).
- First chunk is local: make the probe emit machine-readable pass/fail against the budget table, and rebaseline the four scenarios on a production build. CI wiring is chunk two. Write-up ("CI-gating the compositor") is chunk three and belongs in [docs/case-studies/](../../case-studies/).

## Risks / open questions

- **Runner stability is the whole project.** If shared-runner variance swamps the 3-run bracket, the gate degrades to noise and gets ignored — worse than no gate. Spike: 10 repeated runs on the target CI runner before committing to thresholds; if variance is too high, fall back to dropped-frames + layer-count only (both far more stable than raster ms).
- Headless vs headed compositing differs; the probe may need `--headless=new` validation against known baselines first.
- Scenario maintenance cost: every new route needs a scenario before the gate covers it — the conventions already require this, so the gate makes an existing rule cheaper to follow, not a new chore.
