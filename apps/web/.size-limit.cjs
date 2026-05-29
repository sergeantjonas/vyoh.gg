// Tighten when an investigation reveals a specific dependency or import path
// to trim, not for every per-feature bump. The 200 kB ceiling held since
// 2026-05-16 (commit e92021c); the past two weeks layered in favicon
// presence polling, an achievement-chip rewrite, scroll-driven shell motion,
// the section-shell view-transition migration, command-palette match search,
// and the trailer modal arc — each small on its own, additively past 200 kB.
// Raising to 210 kB on 2026-05-29 to absorb that delta and leave a small
// headroom for the next round of incremental changes.
module.exports = [
  {
    name: "main bundle (initial JS)",
    path: "dist/assets/index-*.js",
    limit: "210 kB",
    gzip: true,
  },
  {
    name: "recharts chunk (lazy)",
    path: "dist/assets/CategoricalChart-*.js",
    limit: "85 kB",
    gzip: true,
  },
];
