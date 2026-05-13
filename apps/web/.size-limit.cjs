// size-limit config. Lives here (not in package.json) so the
// image-bundle wildcard entry can be CI-only — the wildcard expands
// to ~1400 files and exhausts file handles in sandboxed local runs
// (ENOMEM ENFILE), but works fine on CI runners.

const base = [
  {
    name: "main bundle (initial JS)",
    path: "dist/assets/index-*.js",
    limit: "200 kB",
    gzip: true,
  },
  {
    name: "recharts chunk (lazy)",
    path: "dist/assets/CategoricalChart-*.js",
    limit: "85 kB",
    gzip: true,
  },
  {
    name: "lol manifest (script-side JSON, not bundled into JS)",
    path: "dist/lol/manifest.json",
    limit: "400 kB",
  },
];

const ciOnly = [
  {
    name: "bundled lol assets (CI-only — wildcard, file-handle heavy)",
    path: "dist/lol/**/*.{webp,svg,json}",
    limit: "12 MB",
  },
];

module.exports = process.env.CI ? [...base, ...ciOnly] : base;
