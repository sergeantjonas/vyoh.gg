// Initial-JS budget, derived from the client build manifest at config load.
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
// matches five emitted chunks, only three of which are preloaded).
//
// It parsed `dist/index.html` for the entry script plus its modulepreloads
// until 2026-07-26. TanStack Start renders the document per request, so no
// build-time HTML survives to parse. The manifest describes the same graph:
// the client entry chunk plus its transitive *static* imports are exactly the
// set Vite would have emitted modulepreload tags for. It reproduces the same
// 21 chunks the HTML parse found, which is the evidence that the swap is
// faithful rather than merely plausible.
//
// `dynamicImports` are deliberately not walked — those are the lazily-fetched
// route and feature chunks, which is the whole point of code splitting.
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

const CLIENT_DIST = join(__dirname, "dist", "client");

function initialJsPaths() {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(join(CLIENT_DIST, ".vite", "manifest.json"), "utf8")
    );
  } catch {
    throw new Error(
      "size-limit: dist/client/.vite/manifest.json not found — run `pnpm --filter @vyoh/web build` first. (It needs `build.manifest: true` in vite.config.ts.)"
    );
  }

  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);

  // Guard against a partial walk, not just an empty one. size-limit silently
  // ignores a path that matches nothing, so a manifest shape change upstream
  // would otherwise quietly shrink the measured payload and turn the budget
  // green. Start emits exactly one client entry (its default client entry);
  // more than one means the build shape changed and this needs rethinking.
  if (entries.length !== 1) {
    throw new Error(
      `size-limit: expected exactly 1 client entry chunk in the manifest, found ${entries.length}. The build shape probably changed; update the walk above.`
    );
  }

  const seen = new Set();
  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const imported of manifest[key].imports ?? []) walk(imported);
  };
  walk(entries[0]);

  return [...seen].map((key) => join(CLIENT_DIST, manifest[key].file));
}

module.exports = [
  {
    // Every chunk the browser fetches before first paint: the client entry
    // module plus its transitive static imports.
    //
    // Ceiling went 240 kB → 250 kB on 2026-07-26: 229.53 kB before the Start
    // cutover, 241.65 kB after. That ~12 kB is the Start client runtime and
    // hydration path, i.e. the price of server rendering rather than a
    // regression to chase. The two figures come from different derivation
    // methods (HTML tags vs manifest walk), so treat the delta as approximate.
    // Headroom stays near what 240 kB gave, so the budget still bites on the
    // next unplanned addition.
    //
    // 250 kB → 255 kB on 2026-09-01: 244.38 kB at the end of the Start arc
    // (16cb4e02, re-measured with this walk), 247.46 kB now. The +3 kB is the
    // owner-auth and curation wiring that sits in the root graph for every
    // visitor (owner badge, logout, review dot, admin-games hook, and the
    // TanStack Query mutation cache they pull in) — intended, so the ceiling
    // moves rather than the feature. The champion accent table only looks
    // like growth in a per-chunk diff: it moved from the entry chunk into the
    // champion-icon chunk when champion-theme moved to @vyoh/shared.
    // Headroom is back to ~3 %.
    name: "initial JS (entry + static imports)",
    path: initialJsPaths(),
    limit: "255 kB",
    gzip: true,
  },
  {
    name: "recharts chunk (lazy)",
    path: "dist/client/assets/CategoricalChart-*.js",
    limit: "85 kB",
    gzip: true,
  },
];
