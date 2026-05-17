# Security baseline

**Status:** Active — baseline shipped 2026-05-14 (`pnpm audit` in CI, Dependabot alerts + malware alerts + security updates, secret scanning + push protection). CodeQL SAST deferred as a freelance-signal layer; revisit when bandwidth allows or auth surface lands. Tracked under "Adjacent maintenance" in [open-work.md](../open-work.md).

Captures the supply-chain / credentials layer for this repo and what's deliberately deferred. Right-sized for a solo-dev, no-auth, no-PII, no-payments portfolio project — not a SaaS posture.

## Baseline shipped (2026-05-14)

Prompted by the Mistral / UiPath / TanStack npm compromise ("Mini Shai-Hulud") rumours circulating on Reddit. Audit at the time found zero `router_init.js` IoCs in the dep tree and no flagged TanStack versions — but the absence of *any* security layer in CI was the real gap.

- **`pnpm audit --prod --audit-level=high`** as a separate job in [.github/workflows/ci.yml](../../.github/workflows/ci.yml). `--prod` skips devDep noise (we have a known moderate in `@nestjs/cli`'s `file-type` transitive); `--audit-level=high` keeps the existing prod-side `@hono/node-server` moderate visible but non-blocking. No `pnpm install` step — audit reads the lockfile and queries the registry directly.
- **Dependabot alerts** — surfaces new GHSAs against existing deps.
- **Dependabot malware alerts** — supply-chain-specific, catches packages flagged as malware (closest thing to a Shai-Hulud-style early warning).
- **Dependabot security updates** — auto-opens PRs that patch only the vulnerable package.
- **Secret scanning + push protection** — blocks pushes that contain detected credentials (Riot/Steam/DB keys). The Riot key risk is real: leaked keys get scraped and abused within hours.

All four Dependabot/secret-scanning toggles are in repo Settings → Code security. No config files needed.

## Deferred

- **CodeQL (GitHub's free SAST)** — would surface XSS/injection/unsafe-deserialization patterns in our own code, which `pnpm audit` and Dependabot can't see. Not threat-model-justified for this repo (no auth surface, no PII, low traffic), so deferred. Worth doing as **freelance-profile signal** — "I run SAST on my own code" reads well to security-conscious clients. Cost: an extra CI job (~5–10 min) and a triage burden for findings. Revisit when bandwidth allows or when the project grows an auth surface.

## Explicitly out of scope

- **Socket.dev** — supply-chain behavioural analysis, complementary to Dependabot. Considered and skipped: Dependabot malware alerts already covers the highest-probability gap, and a third vendor in the PR-review loop is diminishing returns at this scale. Reconsider if Dependabot misses a real incident.
- **Grouped security updates** — Dependabot UX nicety. Enable later if security PRs start piling up.
- **CSP, rate limiting, runtime hardening** — defensive depth for production SaaS. Not justified at portfolio-site scale.
