# vyoh.gg

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study. The README grows alongside the code.

## Status

- Bootstrap arc complete (2026-05-06): pnpm workspace, `apps/web` and `apps/api` scaffolded, Biome + TypeScript strict, GitHub Actions CI gating every push and PR.
- Next: a vertical slice (summoner search → match history → match detail) with mocked data, to validate the web ↔ api ↔ shared-types contract before persistence lands.
- After that: Postgres + ORM, Redis + BullMQ for Riot rate-limit handling, then the actual Riot/Steam integrations.

## Stack

- **Frontend** — React 19, Vite 8, Tailwind CSS 4, shadcn/ui (Radix-based), motion (formerly Framer Motion)
- **Backend** — NestJS 11 with the SWC builder; Vitest for tests via `unplugin-swc` (so decorator metadata works without Jest)
- **Database** — Postgres (ORM TBD — TypeORM or Prisma)
- **Cache / queue** — Redis + BullMQ (planned; for Riot rate-limit handling and background backfills)
- **Tooling** — pnpm workspaces, Biome 1.9 (single linter/formatter across the monorepo), TypeScript strict with `noUncheckedIndexedAccess`
- **Hosting** — TBD (Vercel for web + Railway/Fly for api is the cheap default)

## Repo layout

```
vyoh.gg/
├── .github/workflows/   # CI — lint/format/typecheck on every PR and push to main
├── apps/
│   ├── web/             # React + Vite + Tailwind + shadcn + motion → http://localhost:2009
│   └── api/             # NestJS + SWC + Vitest                     → http://localhost:2010
└── packages/
    └── shared/          # cross-cutting types and DTOs imported by both apps
```

The port choices have a story: **2009** is the year League of Legends launched, **2010** is the year I created my Steam account.

## Local development

Requires Node 22 (see `.nvmrc`) and pnpm 10.

```bash
pnpm install                       # install all workspace deps

pnpm --filter @vyoh/web dev        # web dev server on :2009
pnpm --filter @vyoh/api start:dev  # api in watch mode on :2010

pnpm check                         # Biome format + lint (auto-fixes)
pnpm typecheck                     # tsc --noEmit across all workspace packages
pnpm --filter @vyoh/api test       # Vitest run in apps/api
pnpm --filter @vyoh/web build      # production build with bundle report
```

CI runs `pnpm ci:check` (Biome in non-writing CI mode) and `pnpm typecheck` on every PR and every push to `main`.

## Tracked metrics

Web bundle size is a deliberate, ongoing budget. Each layer of the bootstrap was recorded so future regressions show up against a real baseline rather than a vibe:

| State                       |   JS gzip |   CSS gzip |  Build |
| --------------------------- | --------: | ---------: | -----: |
| empty React app             |  60.06 kB |          — |   85ms |
| + Tailwind v4               |  60.16 kB |    1.77 kB |  112ms |
| + shadcn/ui (Button)        |  70.28 kB |    4.43 kB |  172ms |
| + motion (intro animation)  | 109.33 kB |    4.59 kB |  220ms |

Plus the Geist variable font, split into per-script woff2 files: Latin 28.4 kB, Latin-ext 15.3 kB, Cyrillic 14.7 kB — only the matching locale loads per visitor.

The biggest single jump is `motion/react` (+39 kB gzip). It's accepted at the bootstrap stage because there are no routes yet to code-split against; the natural moment to revisit is when the router lands. `LazyMotion` + per-route code splitting are both on the table.

## Engineering case studies (in progress)

Each of these is a real problem this app has to solve, with the actual numbers and trade-offs from this repo. They get written up as the work happens, not before:

- **Riot API rate-limit strategy** — request budgeting, backoff, Redis-backed queueing
- **Multi-source identity stitching** — same player across LoL and Steam, no canonical join key
- **Performance budget** — Lighthouse scores, bundle deltas per route, when to lazy-load
- **Background workers** — historical match backfill without burning the live rate budget
