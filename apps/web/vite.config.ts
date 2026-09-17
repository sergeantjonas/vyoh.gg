import { execSync } from "node:child_process";
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { Features, transform as transformCss } from "lightningcss";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const enableVisualizer = process.env.ANALYZE === "1";

// Dev-only: flatten native CSS nesting in served CSS.
//
// Tailwind v4 emits ~426 nested `&`/@supports blocks; Chrome's DevTools Styles
// pane goes pathological rendering that many nested rules and spins forever
// whenever any element is inspected (Firefox/Safari inspectors normalise the
// nesting internally and are unaffected). The prod build already lowers nesting
// to ~63 via `build.target` (baseline-widely-available predates native CSS
// nesting, so the bundler de-nests). This applies the same de-nesting to the dev
// pipeline so Chrome DevTools is usable in dev too.
//
// `apply: "serve"` → prod output is untouched (it already de-nests).
//
// `include: Features.Nesting` with no `targets` is what keeps this surgical:
// nesting is the only feature lowered, so oklch / color-mix / relative-color /
// @property survive exactly as authored and dev visuals are unchanged. Naming
// the feature beats the older approach of picking a `target` old enough to
// predate native nesting, which lowered colour syntax too if the target ever
// slipped. Lightning CSS still renormalises equivalent values (`oklch(0.8 …)` →
// `oklch(80% …)`); that is serialisation, not a different colour.
function devFlattenCssNesting(): Plugin {
  return {
    name: "vyoh:dev-flatten-css-nesting",
    apply: "serve",
    transform(code, id) {
      // Only raw CSS modules, and only when there's nesting to flatten. Skip
      // the JS-wrapped form (post css-post) and any non-CSS module.
      if (!/\.css(\?|$)/.test(id)) return null;
      if (/^\s*(import|export)\s/.test(code) || !code.includes("&")) return null;
      try {
        const result = transformCss({
          filename: id,
          code: Buffer.from(code),
          include: Features.Nesting,
          sourceMap: true,
        });
        return {
          code: result.code.toString(),
          map: result.map ? result.map.toString() : null,
        };
      } catch (error) {
        // Never break the dev CSS pipeline over a DevTools ergonomics tweak —
        // but say so, because failing silently here just resurrects the
        // DevTools hang with no indication of why.
        this.warn(`dev CSS de-nesting skipped for ${id}: ${error}`);
        return null;
      }
    },
  };
}

const buildCommit = (() => {
  // Docker builds have no repository to ask: `.git` is in .dockerignore, and
  // shipping it would be a large layer to buy one string. deploy.sh passes the
  // SHA it is deploying instead.
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();
const buildTime = new Date().toISOString();

// Gated on the token so the plugin is inert everywhere except the image build
// that CI runs on a push to `main`. A local `pnpm build`, a PR check and a
// contributor's clone all have no token and must not fail for it. The token is
// the one value in this pipeline that is a repository *secret* rather than a
// public variable, and it reaches the Docker build through a BuildKit secret
// mount — never an ARG, which would write it into the image history of a
// public package.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? "vyohgg-web";
// Region-scoped, and not optional. This org lives in the EU (its DSN host is
// `ingest.de.sentry.io`), while sentry-cli defaults its API to sentry.io —
// which answers for a US org and fails for this one. An `sntrys_` org token
// carries its region and needs no help; a personal token does not, so setting
// it explicitly makes the build behave the same either way.
//
// `||` rather than `??`, for the reason SENTRY_SAMPLE_RATE already documents:
// an unset GitHub Actions variable interpolates to an empty string, not to
// undefined, and `??` would hand sentry-cli `""` as its API base.
const sentryUrl = process.env.SENTRY_URL || "https://de.sentry.io/";

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    // Tree-shake flags the Sentry SDK reads at build time. Tracing is not
    // configured (see src/instrument.ts), so its whole span/propagation stack
    // is dead weight in the bundle unless it is compiled out here.
    __SENTRY_DEBUG__: "false",
    __SENTRY_TRACING__: "false",
  },
  plugins: [
    // Must precede @vitejs/plugin-react: tanstackStart injects the route/server
    // transforms that the react plugin (and the React Compiler babel pass after
    // it) then compile. It subsumes the old TanStackRouterVite entry — the
    // route-tree generation and code splitting come with it.
    // `autoCodeSplitting` is deliberately absent: Start omits it from its
    // router schema and forces it on, so passing it is a type error.
    tanstackStart(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    devFlattenCssNesting(),
    // Last in the list on purpose: it reads the emitted bundle and its maps, so
    // it has to run after everything that writes them. `release` is the same
    // string as the deployed image tag — BUILD_COMMIT is github.sha cut to
    // seven in both places — so an issue names a tag that can be deployed and
    // rolled back, rather than an opaque release id.
    sentryAuthToken &&
      sentryOrg &&
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        release: { name: buildCommit },
        // Kept rather than deleted after upload: the repo is public, the maps
        // cost image size but no runtime bytes (a browser fetches one only with
        // devtools open), and keeping them means traces resolve outside Sentry
        // too.
        sourcemaps: { filesToDeleteAfterUpload: [] },
        telemetry: false,
        url: sentryUrl,
        // The plugin logs upload failures and lets the build succeed. That is a
        // reasonable default and the wrong one here: the image would ship,
        // deploy, and serve minified traces while every check reported green —
        // the failure mode this whole chunk exists to remove. A token was
        // supplied, so an upload was intended, so a failure is a build failure.
        errorHandler: (err) => {
          throw err;
        },
      }),
    enableVisualizer &&
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    enableVisualizer &&
      visualizer({
        filename: "dist/stats.json",
        template: "raw-data",
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 2009,
    strictPort: true,
  },
  build: {
    target: "baseline-widely-available",
    // Without this every browser stack trace Sentry shows is minified, which
    // makes the whole browser half of error tracking look like it works while
    // being useless. The usual objection — shipping sourcemaps exposes your
    // source — does not apply here: the repo is public, and the maps ship in
    // the image either way.
    //
    // `"hidden"` rather than `true`, measured rather than assumed: it omits the
    // `//# sourceMappingURL=` comments, which are counted bytes in the initial
    // JS the budget gates on — 252.41 kB against 255 kB, where `true` cost
    // 253.59 kB and left 1.4 kB of headroom. Sentry resolves traces from the
    // upload regardless, and anyone who wants a map can still fetch
    // `<chunk>.js.map`; the only thing given up is devtools resolving them
    // automatically. Raising the budget to buy that was declined once already.
    sourcemap: "hidden",
    // Emitted for `.size-limit.cjs`, which used to derive the initial-JS set by
    // parsing `dist/index.html`. Start renders the document per request, so
    // there is no build-time HTML left to parse and the manifest is the only
    // remaining description of which chunks load before first paint.
    manifest: true,
  },
  optimizeDeps: {
    include: ["cmdk"],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
    // `server/` is the production Node entry, outside the Vite build graph. Its
    // tests declare `@vitest-environment node` per-file — happy-dom's fetch
    // primitives cannot carry a streamed request body.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts"],
    // Cap concurrent test workers. Vitest defaults `maxWorkers` to the CPU
    // count (~8-10 on Apple Silicon); each loads happy-dom + React + most of
    // src/ → ~300-500MB resident. The peak fan-out exceeded available RAM on
    // memory-tight hosts and surfaced as intermittent ENOMEM during fork().
    // 4 workers halves peak memory at ~20-30% wall-clock cost.
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/routeTree.gen.ts",
        "src/test-setup.ts",
      ],
      thresholds: { statements: 79, branches: 62, functions: 86, lines: 90 },
    },
  },
});
