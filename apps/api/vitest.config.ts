import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
  oxc: false,
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.d.ts", "src/main.ts", "src/scripts/**"],
      thresholds: { statements: 92, branches: 82, functions: 94, lines: 94 },
    },
  },
});
