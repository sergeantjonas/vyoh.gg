import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/**/*.d.ts", "src/index.ts"],
      // These are tight, not a buffer: the 2026-07-25 state review found all
      // four failing (the earlier "well below current (100% lines)" note was
      // stale by ~2pp). Lines sit a handful of lines above the floor, so a new
      // uncovered branch can break the build.
      // A package-local `pnpm test` does NOT enforce this — only `--coverage`
      // does, which is what CI runs.
      thresholds: { statements: 95, branches: 89, functions: 97, lines: 99 },
    },
  },
});
