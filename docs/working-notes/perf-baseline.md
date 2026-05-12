# Performance baseline — 2026-05-12

Investigation started after the main roadmaps (views, match-depth, trends) shipped. Goal: understand how well the app runs, especially on lower-end machines, and produce screenshots `case-study-topics.md` is waiting for.

## Tooling in place

- **Bundle visualizer:** `rollup-plugin-visualizer` added as devDep. Run `ANALYZE=1 pnpm run build` from `apps/web/` to emit `dist/stats.html` (treemap) + `dist/stats.json` (parseable). Gated by `process.env.ANALYZE === "1"` in [apps/web/vite.config.ts](../../apps/web/vite.config.ts) so normal builds are unaffected.
- **Web Vitals:** already wired via [apps/web/src/lib/web-vitals.ts](../../apps/web/src/lib/web-vitals.ts) + dev-only [PerfOverlay](../../apps/web/src/components/perf-overlay.tsx) gated by `usePerfFlag()`. Currently console + in-memory only; no persistent collection.
- **Lighthouse:** **not** available inside the devcontainer (no Chrome). Run from host Chrome DevTools against `vite preview` on the forwarded port when needed.

## Main bundle baseline

Initial measurement 2026-05-12: **205.69 kB gzip / 629 kB raw** (Vite output for `dist/assets/index-*.js`).

After lazy-loading sonner + cmdk (2026-05-12): **181.94 kB gzip / 550.70 kB raw** (-23.75 kB gzip / -11.5%). New lazy chunks:
- `dist-*.js` (sonner): 11.45 kB gzip — loads on first toast or after first paint
- `command-palette-dialog-*.js` (cmdk + dialog body): 7.75 kB gzip — loads on first ⌘K

The numbers below describe the original baseline (before lazy-loading), retained to anchor the "what was in the bundle before" view:

| Package | gzip | % | Status |
|---|---:|---:|---|
| `motion-dom` + `framer-motion` + `motion-utils` | 112.0 kB | 28.5% | **Accepted** — see "Motion cost" below |
| `react-dom` | 85.1 kB | 21.7% | Unavoidable |
| `@tanstack/router-core` + `react-router` | 50.5 kB | 12.9% | Expected for the router |
| `@tanstack/query-core` + `react-query` | 21.1 kB | 5.4% | Expected |
| `sonner` | 11.4 kB | 2.9% | ✅ Lazy-loaded 2026-05-12 (moved to own chunk via `lib/toast.ts` helper + `React.lazy` Toaster) |
| `tailwind-merge` | 10.7 kB | 2.7% | Standard shadcn pattern, keep |
| `cmdk` | 5.4 kB | 1.4% | ✅ Lazy-loaded 2026-05-12 (palette split into eager shell + lazy `command-palette-dialog.tsx`) |
| `@radix-ui/*` + `@floating-ui/*` | ~25 kB | ~6% | Tooltip/Dialog/Popper, fine |
| `lucide-react` | 4.3 kB | 1.1% | Good — tree-shaken |
| App code | 26.6 kB | 6.8% | Healthy |

Per-route chunks split cleanly (Trends 12 kB, MatchDetail 12 kB, Profile 29 kB) — TanStack auto code-splitting is doing its job.

Notable lazy chunk: **`CategoricalChart-*.js` (Recharts) at 77 kB gzip / 245 kB raw**, loaded only on chart pages. **Both Recharts and visx are present by design** — a prior session deliberately kept Recharts for workhorse charts and reached for visx only on showpieces where the extra API cost paid for bespoke visuals. The chunk is therefore not a leftover migration; consolidating onto visx everywhere is an option, but only worth pursuing if there's no visual regression on the existing Recharts surfaces.

## Motion cost — accepted, do not re-litigate

The 112 kB / 28.5% motion footprint is **intentional spend**, not a misconfiguration:

- `LazyMotion + m` is already used everywhere (`m` in 48/53 files, `useReducedMotion` in 26/53).
- No stray `framer-motion` direct imports; the `framer-motion` 29 kB is a transitive dep of `motion@12`.
- `domMax` is the right preset because the app uses `layoutId` (6 sites: nav pill, tab pill, card morph, match-count selector, champion-sort selector, champion table). Downgrading to `domAnimation` would break those.
- Motion v12 has no "animation + layout but no drag" intermediate preset.
- Async-loading the feature pack via `features={() => import(...)}` would save 50-80 kB but cause first-render animation misses — unacceptable for the showpiece brand.

**Rule for future perf work:** target non-visual code (eager imports, unused libs). Don't propose downgrading motion features, async-loading the pack, or removing decorative motion usage to "save weight."

## Open levers (non-motion)

In order of ROI:

1. ~~**Lazy-load `sonner` Toaster + `cmdk` palette**~~ — ✅ done 2026-05-12 (-23.75 kB gzip from main).
2. **Hunt remaining Recharts callers, migrate to visx** — 77 kB off chart-page chunks, ~30 min.
3. **Lighthouse on host** — runtime baseline on key routes (`/`, `/lol/<slug>`, `/lol/<slug>/trends`, `/lol/<slug>/matches/<id>`, `/lol/<slug>/champions`); screenshots for the README.
4. **React render profile** of Trends / MatchDetail / Champions — surface wasted-render hotspots.
5. **Bundle budget in CI** (size-limit or similar) — prevent regression during future feature work.

## Routes that exist (for Lighthouse coverage)

- `/` — landing
- `/lol/` — account search
- `/lol/$accountSlug/` — profile
- `/lol/$accountSlug/trends`
- `/lol/$accountSlug/recap`
- `/lol/$accountSlug/live`
- `/lol/$accountSlug/matches`
- `/lol/$accountSlug/matches/$matchId`
- `/lol/$accountSlug/champions`
- `/lol/$accountSlug/champions/$championKey`
