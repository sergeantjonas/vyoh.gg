# vyoh.gg

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study.

## Tech

- **Frontend** — React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend** — NestJS (TypeScript), separate API
- **Cache / queue** — Redis + BullMQ (Riot rate-limit handling, background backfill)
- **Database** — Postgres (ORM TBD)
- **Tooling** — pnpm workspaces, Biome, TypeScript strict
- **Hosting** — TBD (Vercel + Railway/Fly likely)

## Repo layout

```
vyoh.gg/
├── apps/
│   ├── web/      # React frontend (not yet scaffolded)
│   └── api/      # NestJS API     (not yet scaffolded)
└── packages/
    └── shared/   # shared types / DTOs between web and api
```

## Engineering goals

This README grows alongside the codebase as a tech case study. Topics planned:

- **Riot API rate-limit strategy** — request budgeting, backoff, Redis-backed queueing
- **Multi-source identity stitching** — same player across LoL + Steam
- **Performance budget** — Lighthouse score, bundle size, route-level code splitting
- **Background workers** — historical match backfill without burning the rate budget
- **Real-time-ish updates** — websockets / SSE on new matches

## Status

Bootstrapped 2026-05-06. Monorepo skeleton only — apps not yet scaffolded.

## Local dev

```bash
pnpm install
# More instructions land here as apps get scaffolded.
```
