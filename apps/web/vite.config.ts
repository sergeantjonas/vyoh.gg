import { execSync } from "node:child_process";
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { type Plugin, transformWithEsbuild } from "vite";
import { defineConfig } from "vitest/config";

const enableVisualizer = process.env.ANALYZE === "1";

// Dev-only: flatten native CSS nesting in served CSS.
//
// Tailwind v4 emits ~426 nested `&`/@supports blocks; Chrome's DevTools Styles
// pane goes pathological rendering that many nested rules and spins forever
// whenever any element is inspected (Firefox/Safari inspectors normalise the
// nesting internally and are unaffected). The prod build already lowers nesting
// to ~63 via `build.target` (baseline-widely-available predates native CSS
// nesting, so esbuild de-nests). This applies the SAME esbuild de-nesting to
// the dev pipeline so Chrome DevTools is usable in dev too.
//
// `apply: "serve"` → prod output is untouched (it already de-nests). esbuild
// only lowers the nesting syntax; it leaves oklch / color-mix / relative-color
// / @property exactly as authored, so dev visuals are unchanged. No new
// dependency — esbuild is bundled with Vite via `transformWithEsbuild`.
function devFlattenCssNesting(): Plugin {
  return {
    name: "vyoh:dev-flatten-css-nesting",
    apply: "serve",
    async transform(code, id) {
      // Only raw CSS modules, and only when there's nesting to flatten. Skip
      // the JS-wrapped form (post css-post) and any non-CSS module.
      if (!/\.css(\?|$)/.test(id)) return null;
      if (/^\s*(import|export)\s/.test(code) || !code.includes("&")) return null;
      try {
        const result = await transformWithEsbuild(code, id, {
          loader: "css",
          // Below native CSS nesting (Chrome 112 / FF 117 / Safari 16.5) so
          // esbuild lowers it; color functions are left untouched at any target.
          target: ["chrome111", "firefox116", "safari16"],
        });
        return { code: result.code, map: result.map };
      } catch {
        // Never break the dev CSS pipeline over a DevTools ergonomics tweak.
        return null;
      }
    },
  };
}

// index.html cannot import from `src/`, so the one thing it needs from
// `src/lib/api-url.ts` — the public api origin behind the site-wide og:image —
// is substituted here instead.
//
// `order: "pre"` puts this ahead of Vite's own `%VITE_*%` pass, which warns and
// leaves the token in the markup when the var is unset; a literal `%…%` in a
// crawler-facing meta tag is worse than a dev-only origin. The fallback below
// duplicates `DEV_ORIGIN` for that reason and no other — both this plugin and
// index.html are deleted when the Start shell takes over the document head.
function htmlApiBase(): Plugin {
  return {
    name: "vyoh:html-api-base",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html.replaceAll(
          "%API_PUBLIC_URL%",
          process.env.VITE_API_URL ?? "http://localhost:2010"
        ),
    },
  };
}

const buildCommit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();
const buildTime = new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  plugins: [
    htmlApiBase(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    devFlattenCssNesting(),
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
  },
  optimizeDeps: {
    include: ["cmdk"],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
        "src/main.tsx",
        "src/routeTree.gen.ts",
        "src/test-setup.ts",
      ],
      thresholds: { statements: 79, branches: 62, functions: 86, lines: 90 },
    },
  },
});
