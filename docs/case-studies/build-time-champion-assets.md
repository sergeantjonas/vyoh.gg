# Build-time champion assets: palette extraction and blurhash

Champion splashes are the visual hero element of the dashboard, but two things make them awkward at runtime:

1. **The CDragon endpoint is 720p.** On a wide viewport the splash gets upscaled ~2×, which reads as "stretched photograph" rather than "atmospheric backdrop."
2. **They're network-bound.** A few hundred ms of transparent hole between page load and image decode looks like a bug.

Both are solved by precomputation. A small workspace at [tools/champion-assets/](../../tools/champion-assets/) iterates the CDragon champion-summary, downloads each splash, extracts a Vibrant palette via `node-vibrant`, and emits a 32×32 blurhash via `sharp` + `blurhash`. Output: a sorted, deterministic JSON committed at [apps/web/src/data/champion-assets.json](../../apps/web/src/data/champion-assets.json) — about 21 KB for 191 champions.

```json
{
  "Ahri": {
    "dominantHex": "#5979bd",
    "blurhash": "UE9812EKVUVC%jX7i]VqDgjEp0kXroMxtTtm"
  },
  ...
}
```

The web app consumes this via a tiny [champion-theme.ts](../../apps/web/src/lib/champion-theme.ts) lookup with a fallback. Two consumers:

- **Themed cards.** Every match card and champion card sets a `--theme-color` CSS variable inline; a single `.themed-card` rule in `index.css` uses `color-mix(in oklab, ...)` to derive a 30%/65%/45% alpha border + hover glow + box-shadow from that one variable. Win/loss is still communicated via the colored vertical bar inside the card, so dropping the win/loss border in favour of champion-themed didn't lose info-density. Source: [champion-card.tsx](../../apps/web/src/lol/champion-card.tsx) — chrome shared between the match list and the champions tab.
- **Blurhash backdrop placeholder.** The splash layer renders the hash immediately on champion change, then crossfades the actual image in (`opacity: 0 → 0.20`) once `image.decode()` resolves. No empty backdrop is ever visible.

## Scaling cost

~15 s for 191 champions at 8-way concurrency on a normal connection. Re-run on Riot patch updates; the JSON's stable sort keeps diffs minimal.

## Why a separate workspace

`node-vibrant` and `sharp` are heavy native deps that don't belong in the runtime bundle. Putting them in their own pnpm workspace under `tools/` keeps the web/api dependency graphs clean and makes room for future scripts (OG-card generation, Lighthouse runner) without polluting an existing app.
