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
      // Floor is well below current (100% lines) to give a buffer; CI reports
      // the actual numbers so a slow erosion is still visible on the PR.
      thresholds: { lines: 90 },
    },
  },
});
