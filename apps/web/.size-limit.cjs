// Initial-JS budget, derived from the built `dist/index.html` at config load.
//
// Why derived and not a glob: this entry read `dist/assets/index-*.js` until
// 2026-07-25, which is ONE of the 21 chunks the browser actually loads on
// first paint. It reported ~133 kB against a 210 kB limit and passed, while
// the real initial payload was ~229 kB — over the stated ceiling. The Vite 8 /
// rolldown chunking split the entry the original glob was written against, and
// nothing caught it because the number still looked plausible.
//
// Hand-writing 21 globs is not the fix either: the names are content-hashed
// and change every build, and prefix globs over-count (`dist/assets/dist-*.js`
// matches five emitted chunks, only three of which are preloaded). Parsing the
// HTML is the only source that stays correct as chunking changes.
//
// CSS is deliberately out of scope — this is a JS budget. `index-*.css` is
// ~31 kB gzip and render-blocking; if it ever needs a ceiling, give it its own
// entry rather than folding it in here.
//
// Precise measured figures live in
// docs/working-notes/cross-cutting/perf-baseline.md; don't restate them here,
// because `__BUILD_TIME__` / `__BUILD_COMMIT__` (vite.config.ts) are baked in
// and shift the byte count on every build.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DIST = join(__dirname, "dist");

function initialJsPaths() {
  let html;
  try {
    html = readFileSync(join(DIST, "index.html"), "utf8");
  } catch {
    throw new Error(
      "size-limit: dist/index.html not found — run `pnpm --filter @vyoh/web build` first."
    );
  }

  // Attribute patterns require preceding whitespace, not \b: \bhref also
  // matches data-href (the hyphen is a non-word char), which would let a
  // renamed attribute keep matching and defeat the guard below.
  const entry = [...html.matchAll(/<script\b[^>]*\ssrc="(\/assets\/[^"]+\.js)"/g)].map(
    (m) => m[1]
  );
  const preloads = [
    ...html.matchAll(
      /<link\b[^>]*\srel="modulepreload"[^>]*\shref="(\/assets\/[^"]+\.js)"/g
    ),
  ].map((m) => m[1]);

  // Guard against a partial parse, not just a zero one. size-limit silently
  // ignores a path that matches nothing, so a tag-shape change upstream would
  // otherwise quietly shrink the measured payload and turn the budget green.
  const declaredPreloads = (html.match(/rel="modulepreload"/g) ?? []).length;
  if (entry.length !== 1 || preloads.length !== declaredPreloads) {
    throw new Error(
      `size-limit: initial-JS parse looks wrong — matched ${entry.length} entry script(s) and ${preloads.length} of ${declaredPreloads} modulepreload(s). The index.html tag shape probably changed; update the patterns above.`
    );
  }

  return [...entry, ...preloads].map((p) => join(DIST, p.replace(/^\//, "")));
}

module.exports = [
  {
    // Every chunk the browser fetches before first paint: the entry module
    // plus its modulepreloads. ~230 kB at the 2026-07-25 baseline.
    name: "initial JS (entry + modulepreloads)",
    path: initialJsPaths(),
    limit: "240 kB",
    gzip: true,
  },
  {
    name: "recharts chunk (lazy)",
    path: "dist/assets/CategoricalChart-*.js",
    limit: "85 kB",
    gzip: true,
  },
];
