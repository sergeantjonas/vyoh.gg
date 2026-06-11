# Palette grammar parser — npm extraction

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Precondition already met: the palette grammar is feature-complete (Phases A–G shipped per [command-palette.md](command-palette.md)). Promote when an OSS-signal trigger appears (freelance pitch, gap week).

## Why

A small, well-tested, published package converts "writes good code" from claim to verifiable public artifact — and the [library-shortlist.md](library-shortlist.md) already holds **four parked tools whose trigger is exactly this**: changesets ("when `@vyoh/*` extracted to npm"), tsup ("library publishing only"), fast-check ("if module extracted to npm"), Stryker (same). One extraction fires all four and produces a maintained-OSS story plus a likely case study ("designing a typed command grammar").

The palette grammar parser in `@vyoh/shared` is the best candidate on the board: self-contained (tokenizer + verb grammar + suggestion engine), zero runtime deps, domain-agnostic at its core, and already battle-tested by the app.

## Shape

- **Scope: parser only.** Tokenizer, grammar definition API, parse + suggestion functions. The vyoh-specific vocabulary (champions, queues, Steam verbs) stays in `@vyoh/shared` as a grammar *definition* consuming the package. No React, no UI — the cmdk integration is the app's business.
- **Pipeline:** tsup build (ESM + d.ts), changesets for versioning, fast-check property tests on the tokenizer/parser (round-trip, no-crash-on-arbitrary-input), Stryker mutation run as the quality badge, README with a 20-line usage example. Publish under a real name (`@jonas/…` or standalone) — `@vyoh/` scope ties it to the portfolio, which is fine and maybe the point.
- **Consumption:** workspace keeps consuming the source via pnpm workspace protocol; the published artifact is the same code. No double maintenance.

## Sequencing / dependencies

- Supply-chain posture from the `supply-chain-hardening` skill applies to the new package repo/workspace (publish provenance, `npm publish --provenance` via CI).
- Pairs with the [case-study reader](case-study-reader.md) for distribution, and the parser case study cross-links the live palette.

## Risks / open questions

- **API stabilization is the real cost.** The internal API can change freely today; a published one can't. Budget a deliberate API-design pass, not a mechanical move.
- **Audience honesty:** a niche grammar parser won't get stars — that's fine. The artifact's value is *demonstrated craft* (tests, types, docs, release hygiene), not adoption. Don't chase generality the app doesn't need.
- Monorepo-in-repo vs separate repo: keeping it in this workspace (publish from `packages/`) is less ceremony; a separate repo reads more like a real OSS project. Decide at pickup — leaning in-workspace publish first, eject later if it grows.
