# Killing flicker on a fullscreen-blur backdrop

## TL;DR

A near-fullscreen champion splash with a `filter: blur(5px)` overlay, an infinite Ken Burns transform, a 0.7 s keyed cross-fade, and a horizontal offsetX shift produced visible flicker during scroll-and-hover on a 4K monitor. The fix wasn't one line — it was a cluster of six independent decisions, ranked by frame-cost impact: push the blur off the compositor by serving a pre-blurred bitmap, cache blurhash decodes to one paint per hash, settle the Ken Burns loop on exit with `useIsPresent`, debounce hover-driven champion changes by 80 ms, mark the decorative image `fetchPriority="low"`, and drop thumbnail bytes/pixels by an order of magnitude with a centered WebP crop. The *durable* answer to "where does the pre-blurred bitmap come from" later shifted from a third-party query-string CDN to a bundle of pre-resized files served from our own origin — that pivot has its own write-up ([bundling-the-bounded-cdn.md](./bundling-the-bounded-cdn.md)). This piece is the diagnostic arc that uncovered why the upstream-blur shape mattered in the first place.

## Setup

The Profile page's champion-aware backdrop was layering five concurrent animated properties on a surface roughly 2560×1440 in a 4K browser window:

1. **`filter: blur(5px)`** on the splash image so it reads as ambient texture, not foreground.
2. **Infinite Ken Burns** — a 1.0 → 1.13 scale plus a small XY drift over 18 s, `repeatType: "reverse"`.
3. **0.7 s cross-fade** on champion change, implemented as a keyed remount inside `<AnimatePresence>`.
4. **`offsetX` shift** — when a child component (a match row, a champion card) claimed the backdrop, the splash slid sideways by a few percent so the focused element wasn't covered by the splash's bright center.
5. **Opacity fade-in** on first image load so the backdrop never flashed in fully formed.

On a 1080p screen this was fine. On a 4K monitor, scrolling the match list while hovering different champion cards produced visible flicker on the backdrop — the kind of flicker that says "the compositor missed a frame," not "the layout is wrong."

The instinct was to remove animations one by one and bisect. The diagnostic that actually worked was to identify the *cost shape* of each layer first, then attack in order.

## Six suspects, ranked by frame cost

The five animated layers plus the image itself fan out to six potential suspects:

1. **CSS `filter: blur(5px)`** on a 2560×1440 surface. The browser composites the blurred subtree into its own backing store and re-rasterizes it every frame a transform animates underneath. Of all six, this is the only one whose per-frame cost scales with the *area of the screen*, not with the complexity of the animation. On a 4K display that area is 4×.
2. **`react-blurhash`'s `<canvas>` repaint per mount.** The library decodes the blurhash and paints to canvas on every component mount; with a keyed remount on champion change, this paid the decode cost on every hover.
3. **Ken Burns loop running on outgoing layers.** During the 0.7 s cross-fade both layers were mounted simultaneously. The outgoing layer was still ticking its infinite transform loop — wasted compositor work for a layer about to be unmounted.
4. **Hover-driven remounts.** A mouse sweep across the match list could change the active champion 8–10 times in under a second. Each change unmounted and remounted the backdrop.
5. **Decorative full-viewport image competing with LCP.** The browser had no signal that the backdrop wasn't the LCP element, so it prioritized the splash download against text the user was actually reading.
6. **Full-resolution splash bytes for a thumbnail.** Champion card thumbnails were loading the same multi-hundred-kilobyte splash the backdrop loaded, then CSS-scaling them down.

Ranked by frame cost, #1 dominates the others by an order of magnitude — re-rasterizing a blurred 4K surface every frame is what compositors hate doing most. So that's where the fix started.

## #1 — Move the blur off the compositor

CSS `filter: blur(N)` is *correct*, but its execution model is wrong for this surface. The browser allocates a backing store the size of the filtered element, rasterizes the unblurred content into it, applies a separable Gaussian convolution every frame the filtered subtree's geometry changes, then composites the result. On a 2560×1440 element with an animating Ken Burns transform underneath, that convolution runs *per frame*. The Chrome flame chart pointed straight at "Image Decode + Filter" as the dominant cost.

The fix is to stop asking the browser to do that work live. If the bitmap arrives *already blurred*, the browser composites a tiny pre-blurred image without a live filter:

```ts
const primary = championBackdropSplashUrl(champion);
// primary resolves to a URL like:
//   https://wsrv.nl/?url=<cdragon>&blur=8&w=640&output=webp
```

The pre-blurred WebP was ~30 KB and ~640 px wide. Scaled up to fill the viewport, it looks identical to the original blurred at 5 px — Gaussian blur is mathematically equivalent at any scale once the radius is matched. Live compositor cost dropped to roughly what a static `<img>` costs.

The fallback retains `filter: blur(5px)` for resilience:

```ts
const imgFilter =
  url && url !== primary
    ? "blur(5px) saturate(0.92) brightness(0.7)"
    : "saturate(0.92) brightness(0.7)";
```

If the pre-blurred URL fails, we fall back to the direct CDragon splash and pay the live filter cost. The frame cost regresses, but the page never breaks.

This is also the diagnostic boundary between this piece and the bundled-CDN piece. The shape `wsrv.nl?blur=8&w=640&output=webp` is *correct* — the pre-blurred bitmap is the right input to the compositor. What changed later is *where that bitmap comes from*. The third-party query-string approach turned out to have its own reliability tail (inconsistent responses for concurrent requests of the same URL, which the [splash-resolver](../../apps/web/src/lol/_shared/splash-resolver.ts) module had to dedupe with an in-flight Promise cache), and the durable answer became a build-time bundle of pre-resized files served from our own origin. That pivot is documented separately in [bundling-the-bounded-cdn.md](./bundling-the-bounded-cdn.md). For the purposes of this case study, the load-bearing claim is "pre-blur the bitmap upstream of the browser," not "use wsrv.nl forever."

## #2 — Decode each blurhash once, not per mount

The placeholder under the splash is a blurhash — a ~25-byte hash that decodes to a tiny RGB grid. `react-blurhash` mounted a `<canvas>`, decoded into it, painted it. On every champion change, the old canvas unmounted and a fresh one mounted: another decode, another paint.

The decoded output for a given hash never changes. Caching the data URL collapses every subsequent visit to a `<img>` swap:

```ts
const blurhashCache = new Map<string, string>();

function blurhashToDataUrl(hash: string): string {
  const cached = blurhashCache.get(hash);
  if (cached) return cached;
  const pixels = decodeBlurhash(hash, 32, 32, 1);
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const imageData = ctx.createImageData(32, 32);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  const url = canvas.toDataURL();
  blurhashCache.set(hash, url);
  return url;
}
```

The cache is module-scoped — across the whole app, each champion's blurhash decodes exactly once per page load. The 32×32 source is intentional: a blurhash carries about that much actual information, and rendering at a larger source size only adds upscale cost without adding signal.

## #3 — Settle the loop on exit

`<AnimatePresence>` keeps the outgoing layer mounted for the cross-fade duration. The Ken Burns loop on that layer would happily keep ticking — animating a scale and translate on geometry that's fading out and about to unmount. `useIsPresent()` exposes the presence state to the child:

```ts
const isPresent = useIsPresent();
const loopActive = !reduced && isPresent;

<m.div
  initial={{ scale: 1, x: "0%", y: "0%" }}
  animate={
    loopActive
      ? { scale: 1.13, x: `${drift.x}%`, y: `${drift.y}%` }
      : { scale: 1, x: "0%", y: "0%" }
  }
  transition={
    loopActive
      ? { duration: 18, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
      : { duration: 0.7, ease: "easeOut" }
  }
/>
```

While exiting, the loop transitions to its neutral pose over the same 0.7 s as the opacity fade. Two animation curves on the same layer (opacity → 0, transform → neutral) at the same duration, ending at the same moment. No wasted frames after unmount, and no jerk in the visual — the outgoing layer drifts to rest as it fades.

## #4 — Debounce hover-driven changes

The match list reports its hovered champion to the backdrop. A mouse sweep across ten rows in 800 ms would otherwise force ten remount-and-cross-fade cycles, each starting an 0.7 s animation that the next change interrupts mid-flight. An 80 ms debounce on the hover handler collapses a sweep into a single change — whichever row the user actually paused on.

The number 80 isn't sacred — it's "shorter than a deliberate hover, longer than an in-motion brush." Below ~50 ms the debounce stops absorbing sweep noise; above ~120 ms the backdrop feels laggy when the user does mean to change champions.

## #5 — Tell the browser it's decorative

The backdrop is, by definition, never the LCP element — the page's hero text and avatars are. The `fetchPriority` attribute is the one-line way to say so:

```tsx
<m.img
  src={url}
  alt=""
  aria-hidden="true"
  loading="eager"
  decoding="async"
  fetchPriority="low"
  ...
/>
```

`loading="eager"` paired with `fetchPriority="low"` is the right combo here: don't lazy-load (the backdrop fades in immediately on mount, not on scroll), but also don't queue ahead of the page's actual hero content. The browser de-prioritizes the splash request when there's contention; on a fast connection there's no contention and it loads at normal speed.

## #6 — Smaller thumbnails

Tangential to the flicker fix, but uncovered by the same audit: the champion card thumbnails were loading full splash JPGs (~89 KB, ~921 000 px decoded) and CSS-scaling them to display ~120 px wide. Switching them to a pre-cropped, WebP-encoded version (`?w=160&fit=cover&output=webp`) dropped each card to ~7 KB and ~90 000 px of decode work. With ~50 thumbnails on screen, that's ~4 MB and ~40 megapixels of decode work saved per page render.

This doesn't fix flicker on its own — it's not on the per-frame path — but it reduces the *amount of stuff* contending for the same decode pipeline that the backdrop also uses. A render where the backdrop and 50 thumbnails arrive simultaneously now finishes their decode budgets faster, which keeps the compositor happier during the cross-fade.

## What this earns

- **Frame budget headroom on a 4K display.** The dominant cost (live blur on a fullscreen surface) is gone; the remaining animation cost is whatever Ken Burns plus an opacity fade actually costs, which is well within budget.
- **A diagnostic discipline that ranked suspects by *cost shape* before bisecting.** Not "remove things and see which one stops the flicker," but "identify which suspect's cost scales with screen area and attack that first."
- **A blueprint for animated decorative layers in general.** Pre-process upstream where you can (blur, resize). Cache decode-bound work in module scope. Settle infinite loops on exit. Tell the browser what's decorative. Debounce continuous inputs into discrete state changes.

## What changed after this shipped

This case study describes the diagnostic and the fix; one of the load-bearing decisions in the fix — *where the pre-blurred bitmap comes from* — was later revisited. The original conclusion landed on third-party CDN query strings (wsrv.nl) as the durable shape: no asset pipeline, no bundle bloat, just a URL with parameters. That conclusion held for several months. It eventually broke under real-world load patterns: concurrent requests for the same upstream URL would sometimes succeed and sometimes 502, producing a "some cards load, some don't" inconsistency that the [splash-resolver](../../apps/web/src/lol/_shared/splash-resolver.ts) module had to mask with an in-flight dedupe cache.

The durable shape became a build-time bundle of pre-resized files served from our own origin — described in [bundling-the-bounded-cdn.md](./bundling-the-bounded-cdn.md). The compositor-side conclusion of *this* piece survives intact: the bitmap arrives pre-blurred, and the browser composites it without a live filter. Only the upstream supplier changed.

The honest two-line summary is: the diagnostic was right, the immediate fix was right, the "third-party query string is the durable answer" framing was wrong on a longer time horizon. Treating those as separate layers of the decision — *what shape does the input bitmap need*, vs. *where does that bitmap live* — is what made the later pivot a substitution rather than a rewrite.
