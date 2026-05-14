# Precomputing champion assets at build time

## TL;DR

The dashboard's visual identity leans on champion splashes — 191 of them, each used as a tinted card background, a backdrop placeholder, and a hover accent. Two properties of those splashes are awkward at runtime: extracting a *theme color* requires decoding the pixel grid, and rendering a *placeholder* before the network image lands requires something to put in the hole. Doing either at runtime is a perceptual disaster — a one-second flash of grey while `node-vibrant` runs in the worker, or an empty box until decode resolves. The shape that works is a build-time tool in its own pnpm workspace ([tools/champion-assets/](../../tools/champion-assets/)) that emits a small JSON (~21 KB for 191 champions) shipped as a data import. Runtime cost is a single object lookup; build cost is ~15 seconds; native-dep pollution is contained.

## Setup

Two consumers want derived data from each champion's splash:

- **Themed cards.** Every match card and champion card paints a colored border, hover glow, and box-shadow keyed off a dominant color. With 191 champions, you can't author colors by hand; with a colored bar already encoding win/loss, the *border* color is free to encode the champion identity instead.
- **Blurhash backdrop placeholder.** The splash backdrop has a noticeable load delay (the splash image is ~30–80 KB, behind a CDN, then decoded). A blurhash gives a ~25-byte hash that decodes to a tiny RGB grid — visually convincing as a placeholder, instant to render.

Both derivations are *deterministic from the splash bytes*. Both are *the same* on every page load. Both are *too expensive* to do at first-paint time. So they're cached — and a build-time precompute is the right cache because the input only changes when Riot ships a new champion.

## The shape: a separate workspace

`node-vibrant` (palette extraction) and `sharp` (image resize + raw-pixel access) are heavy native deps with native binaries that don't belong anywhere near the web bundle:

```
/workspaces/vyoh.gg/tools/champion-assets/
├── package.json     # declares node-vibrant + sharp + blurhash
├── tsconfig.json
└── src/index.ts     # the precompute script
```

Three things this isolation buys:

- **No native deps in the web `node_modules`.** A bundle of `node-vibrant` would balloon the dev install and risk leaking into the client bundle via accidental imports.
- **The script can be a Node-only ESM file with top-level `await`** — no consideration for browser semantics, no Vite plugins.
- **Room for sibling tools.** When the OG-card script ([og-card-satori.md](./og-card-satori.md)) needed `satori` and `@resvg/resvg-js`, it slotted into `tools/` alongside `champion-assets` without polluting either app's dep graph.

The cost is one more workspace to maintain. The benefit is "every native dep that exists for build-time concerns lives in `tools/`," which is a rule that takes zero coordination to follow.

## What the script actually does

Per champion: fetch the splash from CDragon, run Vibrant against the buffer, resize to 32×32 with `sharp`, encode as a blurhash.

```ts
async function processChampion(alias: string): Promise<ChampionAsset> {
  const url = `${CDRAGON}/champion/${alias.toLowerCase()}/splash-art`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${alias} splash → HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const palette = await Vibrant.from(buffer).getPalette();
  const dominantHex =
    palette.Vibrant?.hex ??
    palette.LightVibrant?.hex ??
    palette.DarkVibrant?.hex ??
    palette.Muted?.hex ??
    "#888888";

  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);

  return { dominantHex, blurhash };
}
```

Three small choices buried in this 20-line function:

- **Fallback chain through palette buckets.** `Vibrant` is the loudest color; some splashes (Senna, dark-heavy champions) return `undefined` for `Vibrant` because the image's chroma profile didn't yield a vibrant cluster. The fallback walks through `LightVibrant`, `DarkVibrant`, `Muted`, then a neutral grey. The chain produces *something usable* for every champion without manual overrides.
- **32×32 source for blurhash.** Blurhash carries roughly that much information; rendering at a larger source size only adds upscale cost without adding signal. The 4×4 component count is the library's standard.
- **`.ensureAlpha().raw()` pipeline.** Blurhash's encoder wants RGBA bytes in row-major order, not the JPEG-decoded structure `sharp` produces by default. The `.raw()` step strips compression metadata; `.ensureAlpha()` guarantees the 4-channel layout the encoder expects even for source JPEGs that don't carry alpha.

## Concurrency with chunked allSettled

191 sequential fetches would take 191× the per-champion latency. Going fully parallel would hit CDragon's rate limits. The middle ground is bounded concurrency via chunked `Promise.allSettled`:

```ts
async function processChunked<T, R>(
  items: T[],
  chunk: number,
  fn: (item: T) => Promise<R>
): Promise<Array<{ item: T; result: R } | { item: T; error: unknown }>> {
  const out: Array<{ item: T; result: R } | { item: T; error: unknown }> = [];
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk);
    const settled = await Promise.allSettled(slice.map(fn));
    settled.forEach((r, idx) => {
      const item = slice[idx];
      if (item === undefined) return;
      if (r.status === "fulfilled") out.push({ item, result: r.value });
      else out.push({ item, error: r.reason });
    });
  }
  return out;
}
```

`chunk = 8` is the sweet spot in practice — small enough that CDragon doesn't push back, large enough that wall-clock time drops to ~15 s. `allSettled` preserves the partial-success contract: a single 502 takes out one champion, not the whole run. Failed champions are listed at the end of the script for manual investigation; the JSON ships without them rather than failing the build.

This is the same pattern as the [match backfill](./pagination-partial-failure.md), at a different scale and for different reasons. The shape — "fan out under a budget, accept partial success, name the failures" — keeps showing up wherever a job touches a service that fails independently per item.

## The output: a sorted, stable JSON

```json
{
  "generated": "2026-05-13T...",
  "count": 191,
  "champions": {
    "Aatrox": {
      "dominantHex": "#5979bd",
      "blurhash": "UE9812EKVUVC%jX7i]VqDgjEp0kXroMxtTtm"
    },
    "Ahri": { ... },
    ...
  }
}
```

The sort is alphabetical by alias. Two consequences:

- **Diffs are minimal across re-runs.** When Riot ships a new champion, the diff is a single new key in the right alphabetical position plus possibly a few `dominantHex` changes for champions whose splash art was updated. A timestamp-sorted or insertion-ordered output would diff every run.
- **The file is reviewable in PRs.** Reading a 200-line JSON change to confirm "yes, this is a new champion" is easy. Reading a 200-line shuffled JSON to confirm "no, none of this is suspicious" is hard.

The output ships to `apps/web/src/data/champion-assets.json` and is imported as a regular module — Vite's JSON import handles it without ceremony. Runtime cost is a single object lookup behind a fallback:

```ts
const FALLBACK: ChampionAsset = {
  dominantHex: "#888888",
  blurhash: "L26@7uIU00ay00ay~qj[%Mj[xufQ",
};

const map = assets.champions as Record<string, ChampionAsset>;

export function championTheme(alias: string): ChampionAsset {
  return map[normalizeChampionAlias(alias)] ?? FALLBACK;
}
```

The fallback hex is a neutral grey; the fallback blurhash is a placeholder grey gradient. A champion the script hasn't seen yet (a fresh release between asset re-runs) still renders something — degrades gracefully rather than crashing the page.

## Themed cards downstream

The web app sets a `--theme-color` CSS variable inline on each card and lets a single rule do the color math:

```css
.themed-card {
  border-color: color-mix(in oklab, var(--theme-color) 30%, transparent);
  box-shadow: 0 1px 0 color-mix(in oklab, var(--theme-color) 45%, transparent) inset;
}
.themed-card:hover {
  border-color: color-mix(in oklab, var(--theme-color) 65%, transparent);
}
```

Win/loss is still communicated through the colored vertical bar inside the card, so dropping the win/loss-colored border in favor of champion-themed doesn't lose information. The visual effect is a list of cards each reading as the champion's signature color, with hover and active states derived in CSS from that single hex.

`color-mix(in oklab, ...)` is the right operator here. RGB mixing produces muddy results in the middle of the alpha range; oklab keeps the perceived hue stable as the alpha changes. Doing the same effect with three CSS variables (border, hover, shadow) precomputed in JavaScript would work but ties the visual system to recomputing them whenever the alpha curve changes. The single-variable + `color-mix` shape keeps the math in one place.

## When to re-run

The script is run on demand — typically when Riot ships a new patch and a new champion lands, or when a champion's splash gets a visual refresh. The output is committed alongside the code; CI doesn't run the script. This is right for a precompute that:

- changes on the order of every few weeks
- has a stable upstream (CDragon) but an upstream that can rate-limit
- produces a deterministic, reviewable artifact

A daily CI re-run would risk a churn-y diff for no good reason — the splash art rarely changes, so most days would produce a no-op diff (a different timestamp, same hashes). On-demand keeps the output meaningful: every PR that touches `champion-assets.json` is a deliberate update.

## What this earns

- **Zero runtime cost for theme + placeholder data.** No worker thread, no decoded canvas hidden in the DOM, no first-paint penalty.
- **A `tools/` workspace pattern.** Other build-time scripts (OG cards, future Lighthouse runners, future Riot DDragon scrapers) slot in alongside `champion-assets` without dragging native deps into the runtime graphs.
- **A graceful-degradation contract via the fallback.** A new champion missing from the precompute renders against the neutral fallback rather than crashing.

## Looking back

"Compute at the right time" is a category of decision more than a technique. For per-champion theme data the right time is *build*, because the input is bounded and stable. For per-match user analytics the right time is *request*, because the input depends on who's asking. The interesting question isn't always "how do I compute this" — it's "when, and where, does it need to be ready by." Build-time precompute is the answer when the input universe is small, bounded, and rarely changing.
