# Frontend perf when 28% of the bundle is on purpose

## TL;DR

Most frontend perf case studies celebrate cuts. This one's central decision is what *not* to cut. The app is meant as a visual showpiece — `LazyMotion + m` everywhere, layout animations in six places, scope-keyed AnimatePresence around route transitions. The bundle audit returned a single dominant cost: motion at 112 kB gzip, 28.5% of the main chunk. The obvious move is to shrink it. The decision was the opposite — accept it as intentional spend, codify the rule so the next session doesn't relitigate, then use the perf work to (a) audit so the spend is visible, (b) take the small wins where decoration genuinely doesn't appear on first paint, and (c) lock the line with a CI bundle budget so any future regression is a conscious choice. Net result: main bundle 205.69 → 181.94 kB gzip (-23.75 kB / -11.5%), live Web Vitals readout behind a session flag, and a `bundle-size` job that fails PRs that drift past the ceiling. Companion to [visual-layer.md](./visual-layer.md).

## Setup

The portfolio framing is that vyoh.gg is a *visual* showpiece — a stats dashboard that earns its place by feeling crafted. The motion budget is a feature, not a leak. The visual layer has six `layoutId` sites (nav pill, sub-tab underline, card morph, match-count selector, champion-sort selector, champion table), scope-keyed `AnimatePresence` around the top-level route segment, scroll-driven reveals on Trends, and a `SplashProvider` that crossfades champion backdrops behind every account view. Most of that requires `LazyMotion` with the `domMax` feature pack — `domAnimation` silently breaks every `layoutId`-driven transition.

A perf write-up on this kind of app looks different from one on an admin panel. The question isn't "what can we cut?" — it's "what here is bloat, and what here is brand?" That distinction is the load-bearing decision.

## The audit

`rollup-plugin-visualizer` plugged into [apps/web/vite.config.ts](../../apps/web/vite.config.ts), gated behind `ANALYZE=1` so normal builds are unaffected. Two outputs per run: a treemap HTML for inspection and a raw-data JSON for parseable per-package aggregation.

```ts
const enableVisualizer = process.env.ANALYZE === "1";

export default defineConfig({
  plugins: [
    // ...
    enableVisualizer &&
      visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true, open: false }),
    enableVisualizer &&
      visualizer({ filename: "dist/stats.json", template: "raw-data", gzipSize: true, brotliSize: true }),
  ],
});
```

Aggregating the raw-data JSON across pnpm's disk layout (scoped packages use a `+` separator, not `__` — the first regex attempt missed half of them) gave the per-package breakdown of the original 205.69 kB / 629 kB main bundle:

| Package | gzip | % | Verdict |
|---|---:|---:|---|
| `motion-dom` + `framer-motion` + `motion-utils` | 112.0 kB | 28.5% | **Intentional spend** |
| `react-dom` | 85.1 kB | 21.7% | Unavoidable |
| `@tanstack/router-core` + `react-router` | 50.5 kB | 12.9% | Expected for the router |
| `@tanstack/query-core` + `react-query` | 21.1 kB | 5.4% | Expected |
| `sonner` | 11.4 kB | 2.9% | Decoration — lazy candidate |
| `tailwind-merge` | 10.7 kB | 2.7% | Standard shadcn pattern |
| `cmdk` | 5.4 kB | 1.4% | Decoration — lazy candidate |
| `@radix-ui/*` + `@floating-ui/*` | ~25 kB | ~6% | Tooltip/Dialog/Popper |
| `lucide-react` | 4.3 kB | 1.1% | Tree-shaken |
| App code | 26.6 kB | 6.8% | Healthy |

Per-route chunks split cleanly (Trends 12 kB, MatchDetail 12 kB, Profile 29 kB) — TanStack Router's `autoCodeSplitting: true` is doing its job. The notable lazy chunk is `CategoricalChart-*.js` (Recharts) at 77 kB gzip / 245 kB raw, loaded only on chart pages. Recharts and visx coexist by design: Recharts is the workhorse, visx is reached for on showpiece visualizations where the extra API cost paid for bespoke output. Consolidating onto visx everywhere is possible but only worth it if there's no visual regression on the existing Recharts surfaces.

## The intentional-spend rule

The instinctive perf move on the audit is to shrink the 112 kB motion footprint. Three concrete options exist:

1. Downgrade `domMax` to `domAnimation` — saves ~5 kB. Breaks every `layoutId` transition. Reject.
2. Async-load the feature pack via `features={() => import("motion/feature-max")}` — saves 50–80 kB. The first paint after each navigation renders without features wired, so the first frame of every entrance animation gets dropped. The app's brand is in those entrance frames. Reject.
3. Strip decorative motion usage — saves variable kB. Defeats the point of the project. Reject.

What's actually in the 112 kB is *appropriately* sized for the features used: `LazyMotion + m` is everywhere (`m` imported in 48/53 motion-using files), `useReducedMotion` is honored in 26/53, no stray `framer-motion` direct imports leak the eager bundle (the visible `framer-motion` 29 kB inside the 112 kB total is a transitive dep of `motion@12`, not a duplicate), and `domMax` is the smallest preset that includes layout animations. Motion v12 has no "animation + layout but no drag" intermediate preset.

The rule, codified in [docs/working-notes/perf-baseline.md](../working-notes/perf-baseline.md) so the next session doesn't redo the audit:

> The 112 kB / 28.5% motion footprint is intentional spend, not a misconfiguration. Future perf work targets non-visual code. Don't propose downgrading motion features, async-loading the pack, or removing decorative motion usage to "save weight."

The point of writing this down isn't to defend the choice — it's to make the choice a *known fact* rather than a recurring discussion. Six months from now, if someone (me, included) opens the analyzer and sees 28.5% on motion, the rule should already have an answer.

## Where the real cuts hid

Two decorations were eager imports despite not rendering anything on first paint.

**sonner** mounts a `<Toaster />` at root and exposes a `toast()` function for fire-and-forget notifications. Until the first toast fires, the Toaster renders nothing. The import was eager because that's how the README example reads. Wrapping both sides in lazy primitives moves the entire 11.4 kB cost behind the first toast.

```ts
// apps/web/src/lib/toast.ts — async helpers replace direct `import { toast } from "sonner"`
let cached: typeof import("sonner") | null = null;
async function load() {
  if (!cached) cached = await import("sonner");
  return cached;
}

export async function toastError(message: string, options?: ExternalToast) {
  const s = await load();
  s.toast.error(message, options);
}
// + toastMessage, toastSuccess, toastInfo
```

```tsx
// apps/web/src/main.tsx — Toaster itself is React.lazy + Suspense
const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));
// ...
<Suspense fallback={null}>
  <Toaster />
</Suspense>
```

**cmdk** powers the ⌘K command palette. Until ⌘K is pressed, the dialog body renders nothing — but the import pulled in cmdk's 5.4 kB plus the dialog's Radix dependencies eagerly. The split is to keep a slim shell eager (so ⌘K is always wired) and lazy-load only the dialog body.

```tsx
// apps/web/src/components/command-palette.tsx
const CommandPaletteDialog = lazy(() => import("./command-palette-dialog"));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        setHasOpened(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (!hasOpened) return null;
  return (
    <Suspense fallback={null}>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
```

The `hasOpened` gate exists because rendering `<Suspense fallback={null}>` unconditionally still mounts the lazy boundary, which schedules the module load eagerly in some bundler configurations. Flipping a boolean on first keypress is the explicit signal "now you may load."

Result after both: main bundle 205.69 → 181.94 kB gzip (-23.75 kB / -11.5%). Two new lazy chunks: `dist-*.js` (sonner) at 11.45 kB, `command-palette-dialog-*.js` (cmdk + dialog) at 7.75 kB. Both load on the first interaction that needs them, not on first paint.

## Runtime, not just bundle

Bundle size answers "how much code does the user pay to download." Web Vitals answer "does it feel fast." Both need to be visible at any time, not measured once and forgotten.

`web-vitals` collects CLS, FCP, INP, LCP, TTFB. The default reporting fires only at page hide for CLS/INP/LCP, which makes it useless for live exploration — the metrics never populate while you're poking at the page. Passing `reportAllChanges: true` to the live metrics fixes that:

```ts
// apps/web/src/lib/web-vitals.ts
function start() {
  if (started) return;
  started = true;
  const opts = { reportAllChanges: true };
  onCLS(broadcast, opts);
  onFCP(broadcast);          // FCP doesn't support reportAllChanges
  onINP(broadcast, opts);
  onLCP(broadcast, opts);
  onTTFB(broadcast);         // TTFB is one-shot by definition
}
```

A `PerfOverlay` component reads the broadcast and renders a fixed dark readout in the bottom-left, colored by rating. It's dev-only by being gated behind a session flag:

```ts
// apps/web/src/lib/use-perf-flag.ts
export function usePerfFlag(): boolean {
  const [enabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const fromUrl = new URLSearchParams(window.location.search).has("perf");
    if (fromUrl) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  return enabled;
}
```

The localStorage detour exists because TanStack Router's per-route `validateSearch` strips unknown query params on navigation. A naive `?perf` flag works on the first page but disappears the moment you click anything. Pin once via the URL, persist via storage. Clear `vyoh:perf` from localStorage to disable.

## The numbers

Measured against `vite preview` on the host laptop (Firefox, no throttling — the devcontainer has no Chrome installed, so Lighthouse-on-host with CPU throttling is a deferred follow-up):

- **LCP** is green on every measured route. Longest sample was the Champions page on a high-mastery account at ~1s. Landing, profile, trends, match detail, champion detail all came in well under.
- **INP** is typically 8 ms (chart click on a match-detail gold-lead graph). The peak observed was 168 ms only under abusive rapid tab-cycling within `/lol/$slug` — still green by the 200 ms threshold, and not a usage pattern a real reader would produce.
- **CLS** stayed visually flat (no specific number captured — the overlay shows it live, and skeleton-loaded routes don't shift after data lands).
- **FCP / TTFB** are noise on `vite preview` against `localhost` and were not the focus.

The deferred work is a throttled measurement from Chrome on the host so the README can carry a defensible cold-network number alongside the warm-network ones above.

## Locking the line — `size-limit` in CI

The 181.94 kB bundle is only meaningful if it stays under that ceiling on every PR. Budgets in code do that.

```jsonc
// apps/web/package.json
"size-limit": [
  { "name": "main bundle (initial JS)", "path": "dist/assets/index-*.js", "limit": "200 kB", "gzip": true },
  { "name": "recharts chunk (lazy)",    "path": "dist/assets/CategoricalChart-*.js", "limit": "85 kB", "gzip": true }
]
```

200 kB on main and 85 kB on the Recharts chunk give ~10% headroom over the current measurements. Two scripts: `pnpm run size` prints the full report (used locally), `pnpm run size:cc` is silent with exit-code-only (used by pre-commit hooks where noise is bad).

CI runs the non-silent version on purpose — when a budget breaches, the action log needs to show *which* budget breached, not just a red ✗:

```yaml
# .github/workflows/ci.yml — separate job, runs in parallel with check
bundle-size:
  name: Bundle size budget
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v5
      with:
        node-version-file: .nvmrc
        package-manager-cache: false
    - run: corepack enable
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter @vyoh/web build
    - run: pnpm --filter @vyoh/web size
```

The job is parallel to the `check` job so a budget breach is attributed clearly in the PR checks UI rather than buried inside a generic "lint, format, typecheck, and test" run. The double `pnpm install` cost is bounded (~30 s) and worth the surface.

## Lessons

1. **Perf work on a showpiece is about deciding what's bloat and what's brand, then making the brand parts cheap to keep.** Shrinking everything is wrong; instrumenting everything so the line stays where you put it is right.
2. **Decorations that don't render on first paint are the highest-ROI lazy candidates.** Toast and command palette are textbook — both have eager-import readme examples that everyone copies, both are silent until first interaction.
3. **Suspense alone doesn't defer module load — render gating does.** A `<Suspense fallback={null}><LazyThing /></Suspense>` mounted unconditionally can still schedule the import. Gate the render on the actual signal (here, "user pressed ⌘K once") so the lazy boundary triggers when the work is needed.
4. **Make perf instrumentation persistently togglable, not URL-param-only.** Routers with strict search validation strip unknown params on navigation; a query-param flag dies the moment the user clicks anything. Pin once, persist in storage.
5. **`web-vitals` defaults are wrong for live exploration.** Pass `reportAllChanges: true` to CLS/INP/LCP if you want the overlay to populate as you interact rather than at page hide.
6. **Budgets in CI must be loud on failure.** `--silent` is for local pre-commit hooks; the CI run needs to print *which* budget breached so the fix is obvious from the action log.
7. **Codify accepted-spend decisions in the working notes.** "Don't relitigate motion" is a fact about the project's intent, not a hidden constraint future-you will rediscover by reading the analyzer output.

## Where the code lives

| Concern | File |
|---|---|
| Bundle analysis behind `ANALYZE=1` (treemap + raw JSON) | [apps/web/vite.config.ts](../../apps/web/vite.config.ts) |
| Bundle budgets + `size` / `size:cc` scripts | [apps/web/package.json](../../apps/web/package.json) |
| CI `bundle-size` job | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) |
| Lazy `sonner` Toaster + async `toast*` helpers | [apps/web/src/lib/toast.ts](../../apps/web/src/lib/toast.ts), [apps/web/src/main.tsx](../../apps/web/src/main.tsx) |
| Lazy command palette dialog + slim eager shell | [apps/web/src/components/command-palette.tsx](../../apps/web/src/components/command-palette.tsx), [apps/web/src/components/command-palette-dialog.tsx](../../apps/web/src/components/command-palette-dialog.tsx) |
| `web-vitals` collection with live reporting | [apps/web/src/lib/web-vitals.ts](../../apps/web/src/lib/web-vitals.ts) |
| Dev-only `PerfOverlay` + session-persistent flag | [apps/web/src/components/perf-overlay.tsx](../../apps/web/src/components/perf-overlay.tsx), [apps/web/src/lib/use-perf-flag.ts](../../apps/web/src/lib/use-perf-flag.ts) |
| Accepted-spend rule + open levers | [docs/working-notes/perf-baseline.md](../working-notes/perf-baseline.md) |

## Open

- **Lighthouse on a throttled Chrome from the host machine.** Firefox doesn't expose the live CPU-throttling primitive Chrome offers; the devcontainer has no Chrome. A throttled cold-network baseline against `/`, `/lol/<slug>`, `/lol/<slug>/trends`, `/lol/<slug>/matches/<id>`, `/lol/<slug>/champions` would yield defensible numbers and the README screenshots [case-study-topics.md](../working-notes/case-study-topics.md) is waiting for.
- **React render profile of Trends / MatchDetail / Champions.** Bundle and Web Vitals are instrumented; wasted renders inside the SPA aren't. The 168 ms INP under abusive tab cycling probably has a structural answer here.
- **Recharts → visx consolidation.** The 77 kB Recharts lazy chunk is the largest remaining single dependency. Both libraries coexist by design (workhorse vs. showpiece), but full migration is the only remaining significant chart-page cut. Worth pursuing only if there's no visual regression on the Recharts surfaces.
