# Face-aware Steam library rows — composing 200 unique hero arts with one CSS rule

## TL;DR

The Steam library row in this app is a wide rectangle showing each game's `library_hero.jpg`. The asset is 3:1 and the row is ~7.5:1, so something has to give — and "naive `object-cover`" gives you clipped heads on most character art. I tried five increasingly-clever crop strategies before landing on the right one: a per-asset face detector (Ultraface via ONNX) running at four rotations at enrichment time, persisting an `(X%, Y%)` anchor that drives `object-position` on a CSS-only cover crop. When the face lands too close to the row's wordmark logo I flip the hero (baked into the served bytes via Sharp's `.flop()`, because Chrome's view-transition snapshot strips CSS `transform: scaleX(-1)` from the captured pixels). Smartcrop saliency is the fallback for non-humanoid art (Hollow Knight, Tunic). Everything is decided once per game, in the enrichment pipeline that already runs for asset URLs and tags — zero per-game manual config.

The result is one layout that handles a 200-game library without per-asset CSS hacks. Stellar Blade's upside-down EVE composition lands face-up. RE4's Leon profile gets mirrored so the wordmark doesn't sit on his face. DOOM 3's helmeted Slayer falls through to smartcrop and lands centered. The piece that ties it all together is treating every asset as a unique composition problem solved at enrichment time, instead of at render time.

## Setup

Steam ships every modern title with `library_hero.jpg` — 1920×620, a 3.1:1 aspect, designed for Valve's own client where it sits in tall-and-narrow library tiles or wide "Recent Activity" rows. Steam's client knows the composition: their renderer crops and positions the hero to its UI shape with bespoke logic.

For a third party reading the same assets, the obvious moves all have failure modes:

1. **`object-cover` with default position.** 200+ games, 200+ different compositions. Half the library has its main character's head clipped above the visible band.
2. **`object-contain` with feather + extended-edge backdrop.** This was my first attempt. The hero sits right-anchored at natural ~3:1 inside the row, the empty left half gets a backdrop sampled from the asset's leftward edge (row-averaged + stretched + blurred). It works for assets with uniform-edge tones (Pragmata's white bg) and breaks loudly for everything else: banded edges (RE3's sunset → cityscape → sky) collapse into smudgy bands; left-anchored subjects (RE4 Leon close-up) fall into the feather zone and get partially obscured.
3. **`object-cover` with smartcrop saliency.** Smartcrop scores image regions by edge density + saturation + skin tone and returns the best-cropping window. Its centroid drives `object-position`. Works for many cases; fails for character art where the brightest/most-detailed region is the armor/weapons, not the head — Dark Souls II's armored Vendrick has the body mid-source and the helmet at the top, smartcrop locks onto the body, the cover crop centers on the body, the helmet gets clipped above the band.

The constraint set the project owner gave was firm: no per-game manual config, no naive cover that crops faces, the logo must remain a separate `<img>` for view-transition morphs from the row to the detail page, and the layout has to work across the full library without human curation. That ruled out frame-inset compositions (which the owner found visually weak) and ruled out per-asset CSS overrides.

## The five abandoned approaches

The piece worth documenting is the route, because each abandoned strategy taught a specific thing about what was actually wrong.

**Edge-extension backdrop (shipped, then abandoned).** Sharp pipeline that sampled the asset's leftmost 200 pixels, row-averaged them to a 1-pixel column, stretched it to 1920px, blurred it, and used it as the row's left-half backdrop with a feathered foreground hero. The intuition was "extend the asset's edge color leftward so the empty zone reads as continuous atmosphere." For Pragmata's pristine white edge → smooth grey-to-white ramp. For RE3 → the horizon glow that carries the composition got averaged into a thin band that didn't run edge-to-edge anymore, atmospheric continuity destroyed. The failure shape was structural: any asset that relies on horizontal context across its full width can't be reconstructed by sampling an edge.

**Cover crop with smartcrop centroid.** Replaced the edge-extension with `object-cover` and used smartcrop's window centroid for `object-position`. Smartcrop's heuristics weight skin tones, which I assumed would track faces. They don't, because the highest-density region of a typical Steam hero is rarely the face — it's the armor, the weapons, the bright fire effect, the SAMURAI patch on Cyberpunk's jacket. Smartcrop happily reports those as salient. Centroid lands mid-body. Head clips above.

**Anchor on smartcrop's window top with a margin.** If the centroid is mid-body, the window's *top* edge is closer to where the head should be. I switched to `band_top = max(0, window_top_pct - 5%) / (1 − visible_fraction)` to bake in a small breathing margin and the cover-fit transform. Solved Pragmata-class compositions and broke Stellar Blade, whose hero art has EVE *upside-down* with her head at source y≈85% — smartcrop's window top was the top of her legs, not her head.

**Cap the anchor at "upper portion."** Same window-top math, but capped at `Y_obj ≤ 15` so the anchor could never land lower than ~9% of source. This was the right *defensive* move (most game hero art does put focal subjects in the upper half) but it papered over the actual problem: smartcrop has no concept of "head" or "face." It returns a salient *region*, and that region's relationship to the focal subject varies per asset. The cap fixed Dark Souls II and Nier Replicant (where the head sits just above the saliency-bright body). It snapped DOOM 3's demon close-up off-center, because the demon's salient face *was* mid-source and the cap insisted on showing the top of the frame.

**Realize the algorithm needs semantics.** Saliency is "which pixels are high-frequency or skin-tone-weighted." That's not "where is the character's face." For most assets the gap doesn't matter because faces *also* happen to be salient. For the cases I cared about — Stellar Blade, RE4's profile shot, the DOOM-vs-DS-vs-Nier disambiguation — the gap was load-bearing. The only way out was to detect the face itself.

## Face detection at enrichment time

The Steam library enrichment pipeline already polls `IStoreBrowseService/GetItems` monthly + on-add for every owned/wishlisted appid, then upserts a `SteamGameEnrichment` row with asset paths, asset timestamps, store metadata, and a few derived columns. I added two more columns:

```prisma
model SteamGameEnrichment {
  // ... existing fields
  subjectXPercent  Int?
  subjectYPercent  Int?
  flipHero         Boolean @default(false)
}
```

And a service that runs after each enrichment upsert:

```ts
async detectBestFace(bytes: Buffer): Promise<DetectedFace | null> {
  const session = await this.getSession();
  let zeroDeg: DetectedFace | null = null;
  let best: DetectedFace | null = null;
  for (const rotation of [0, 90, 180, 270] as const) {
    const tensor = await preprocess(bytes, rotation);
    const result = await session.run({ input: tensor });
    const det = topDetection(result.scores.data, result.boxes.data);
    if (det === null) continue;
    const sourceCenter = unrotateCenter(det.cx, det.cy, rotation);
    if (rotation !== 0 && isInEdgeGuard(sourceCenter)) continue;
    const candidate = { ...buildCandidate(det, sourceCenter, rotation) };
    if (rotation === 0) zeroDeg = candidate;
    if (best === null || candidate.score > best.score) best = candidate;
  }
  return zeroDeg !== null && zeroDeg.score >= PREFER_ZERO_DEG_THRESHOLD
    ? zeroDeg
    : best;
}
```

The model is `Ultraface-RFB-320` — a 1.2 MB ONNX file vendored at `apps/api/models/ultraface-rfb-320.onnx` and loaded once at process start through `onnxruntime-node`. I considered face-api.js (the obvious choice for "small face detector on Node"); it hard-requires `@tensorflow/tfjs-node`, whose prebuilt binaries don't ship for aarch64 Linux. On Apple Silicon devcontainers it fails to install. `onnxruntime-node` ships prebuilts for x86-64 and aarch64 alike, so it crossed off a real portability gate.

The rotation loop exists because Steam hero art is occasionally composed upside-down or sideways — Stellar Blade is the canonical example, EVE diving head-down with her feet at the top of the frame. A frontal face detector trained on upright photos sees nothing at 0° and a high-confidence face at 180°. Running all four rotations and picking the highest-scoring detection costs about 50 ms per asset and handles every orientation the dataset throws at it.

The four refinements that came from the actual library are where most of the engineering went.

### Refinement 1 — Two-stage resize

RE4's Leon profile detected at score 0.59 when I probed against the proxy-served WebP (1280×413), and at *zero* when the same model ran against the original JPEG (1920×620). The difference: Sharp's single-stage downscale 1920×620 → 320×240 produced different pixel data than two-stage 1920×620 → 1280×413 → 320×240. The model is sensitive to that. The fix is to mirror the WebP path's intermediate downscale:

```ts
const intermediate = await sharp(bytes)
  .rotate(rotation)
  .resize({ width: 1280 })
  .toBuffer();
const { data } = await sharp(intermediate)
  .resize(MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
```

A Sharp pass per rotation per asset is ~ms. Once you've already paid for the model load, the resize is in the noise.

### Refinement 2 — Aspect-split bbox filter

The detector occasionally hallucinates "faces" on geometric patterns. DOOM 3's demon-and-marine composition at 270° rotation produced a face-shape at score 0.518 with a bbox of 67%×54% of source. That's not a face, it's most of the image. A single `max-bbox-size` cap can't distinguish that phantom from RE4 Leon's profile close-up, whose real bbox is 30%×85% (face-tall, narrow). The two have similar areas. The fix is to split the cap by axis:

```ts
const MAX_BBOX_WIDTH_FRACTION = 0.4;
const MAX_BBOX_HEIGHT_FRACTION = 0.9;
```

Real faces are taller than wide. Phantoms tend to be square-ish or wide. Splitting accepts Leon (under 40% width) and rejects DOOM 3's phantom (over 40% width).

### Refinement 3 — Edge guard for non-zero rotations

DOOM 3 BFG Edition's hero composition produced a 5.5%×12.2% "face" at 180° rotation, score 0.697, un-rotating to source position (58%, 92%) — the very bottom of the image, in the fire-effect zone. Bbox size was plausibly face-shaped, so the size filter didn't catch it. The discriminator turned out to be position: phantoms at non-zero rotations almost always land in the outer 10% strip of source (rotated-frame edge artifacts), while real faces sit comfortably inside.

```ts
if (rotation !== 0 && isInEdgeGuard(sourceCenter)) continue;
```

0° detections are exempt from the guard — real composition can legitimately place a face near the source edge (a character whose head reaches the top). Rotated-frame edge detections almost never can.

### Refinement 4 — Prefer 0° when 0° is "good enough"

Assassin's Creed II's hero has Ezio in the upper-right at score 0.962, and a downed character (Cristina) face-up-when-rotated at 180° scoring 0.977. Pure best-score-wins picks the downed character, the cover crop anchors on her, Ezio's face ends up out of frame. The artist's intent is plainly the 0°-upright subject — the 4-rotation pass exists for *inverted* compositions like Stellar Blade, not as a tiebreaker for multi-face shots.

```ts
const PREFER_ZERO_DEG_THRESHOLD = 0.5;
// ...
return zeroDeg !== null && zeroDeg.score >= PREFER_ZERO_DEG_THRESHOLD
  ? zeroDeg
  : best;
```

If 0° produces a face above 0.5, take it. Otherwise fall through to best-rotation. Stellar Blade still works (0° finds nothing → 180° wins). Assassin's Creed II is fixed (0° at 0.962 ≥ 0.5 → Ezio wins).

The composition of these four refinements is the actual interesting part. None of them are individually clever. Each came from one specific asset in the library failing in a specific way, and the filter shape is constrained by what *also* needs to keep working. Threshold-tweaks that fix the loud case without checking the silent cases are how you ship regressions.

## The flip — and why CSS can't carry it through a view-transition

RE4's Leon detection landed at source X ≈ 26%, which is right under the row's wordmark logo (the logo column is roughly the leftmost 25-33% of row width). Anchoring on the face puts the focal element under the logo. The fix that doesn't compromise either is to mirror the hero — Leon at X=26% becomes Leon at X=74%, well clear of the logo. Cyberpunk-style assets where V's face is also leftward got the same treatment.

The threshold for triggering the flip is a column constant, `FLIP_TRIGGER_X_PCT = 33`. Anything under 33% on the X axis flips. The X anchor is also inverted (`100 − X`) at enrichment time so the cover crop still tracks the face after flipping.

The implementation looks simple — apply `transform: scaleX(-1)` to the hero `<img>` and you're done. It is *not* simple, because the row's hero element pairs with the detail page's hero through a view-transition morph on click, and **Chrome's view-transition snapshot does not preserve CSS transforms on the captured pixels.** I verified this by watching the morph: the static DOM at both ends was correctly flipped (Leon on the right), but the morph animation between them showed un-flipped pixels, snapping to flipped at the end of the animation. The captured snapshot is the un-transformed content.

The fix is to bake the flip into the served bytes. Sharp's `.flop()` does a horizontal mirror at the proxy:

```ts
@Get("steam/hero/:flip/:appid/:assetTimestamp.webp")
@Header("Content-Type", "image/webp")
@Header("Cache-Control", IMMUTABLE_YEAR)
async steamHero(
  @Param("appid") appid: string,
  @Param("flip") flip: string,
  @Res() res: Response
): Promise<void> {
  const id = Number.parseInt(appid, 10);
  const resolved = await this.steam.hero(id);
  if (flip === "flip") resolved.params = { ...resolved.params, flop: true };
  await this.proxyWebp(resolved.urls, resolved.params, res);
}
```

And the URL helper carries the flip as a path segment, so the browser caches flipped and unflipped variants independently and the bytes the morph captures are already mirrored:

```ts
export function steamLibraryHeroUrl(
  appid: number,
  assetTimestamp?: number | bigint | null,
  flipHero?: boolean
): string {
  const flip = flipHero ? "flip" : "noflip";
  return `${API_URL}/img/steam/hero/${flip}/${appid}/${cacheKey(assetTimestamp)}.webp`;
}
```

Both the row's `<img>` and the destination page's hero img request the same URL when `flipHero=true`, get the same flipped bytes, and the view-transition pairs flipped → flipped through the morph with no un-flip mid-animation.

This is the kind of footnote you end up googling for. CSS view-transitions are still new enough that the "what survives a snapshot" question doesn't have a tidy reference. The honest answer for now is: visual transforms (`scaleX`, `scale`, `rotate`) don't reliably preserve. Visual filters (`blur`, `brightness`) are dicey. *Pixels in the img bytes* always preserve. If a transform needs to survive the morph, it goes into the bytes, not the CSS.

## Smartcrop is still the fallback

Face detection covers humanoid art. The library also contains Hollow Knight, Tunic, Hades's various non-humanoid pieces — assets with no detectable face. The anchor service falls through to smartcrop when face detection returns null:

```ts
const face = await this.faceDetection.detectBestFace(bytes);
if (face !== null) {
  // Anchor on the face with edge-inset + headroom
  return { appid, anchor: applyFaceBiases(face) };
}
const anchor = await smartcropAnchorFromBytes(bytes);
return { appid, anchor };
```

The smartcrop path uses the window-top + cover-fit transform + upper-portion cap from earlier in the arc. It's not great in isolation — it's why I went looking for face detection in the first place. But for "no face detected" assets, the assumption that focal content sits in the upper half of source holds up empirically, and the cap forces the anchor to honor that.

This is the part of the architecture that I most expect to revisit. If a non-humanoid asset shows up where the focal subject is in the lower half (some indie title with a centered logo and a foreground prop low in the frame), the cap will fight it. The instrumentation to detect that is staring at the library and noticing; there's no automated signal.

## Adjacent polish

Three smaller refinements landed in the same arc because the row redesign forced them:

- **Logo trim at the proxy.** Steam wordmark `logo.png` files ship with wildly inconsistent transparent padding — some are tightly cropped, some have ~30% padding on each side. The frontend's `max-h-16`/`max-w-64` constraints produced visibly different rendered sizes per game. The fix is `pipeline.trim({ threshold: 1 })` in the transcode pipeline, which strips uniform-alpha borders before resize. After trim, every logo's visible bbox matches its visual extent and the size cap produces consistent rendered sizes across the library. The proxy carries a `LOGO_SCHEMA_VERSION` segment in the URL so the bump from "no trim" → "trim" forced existing browsers to re-fetch past their year-cached immutable bytes.
- **Row layout shift.** The original layout had the wordmark logo and a meta line (playtime + last-played) stacked in a single column on the left. Bumping the logo's `max-h` from `h-12` to `h-16/sm:h-20` (post-trim) crowded the meta out. Moving the meta to a bottom-left strip frees the full vertical column for the logo, and the layout reads as "art + title up top, status at the bottom."
- **Rows as the default library view.** The original default was a tile grid (2:3 portrait capsules). After all of the above, the row view became the more polished surface — face-aware crop, trimmed logo, view-transition morph into the detail page. Flipping the default in `use-library-prefs.ts` (DEFAULTS.layout from `"tiles"` to `"rows"`, with the parser coercing unknown values to `"rows"`) gets new visitors into the showcase view. Persisted preferences still win for returning users.

## What I'd do differently

The most expensive lesson from this arc was *trusting smartcrop's skin-tone weighting to track faces*. The library has the docs that say "scoring is `detail + saturation + skin + boost`" and skin is one of four factors. For most game hero art, the bright/saturated/edge-dense regions (armor, weapons) dominate the score so thoroughly that skin's contribution is a footnote. I should have probed actual smartcrop windows on the test set before building the "anchor on saliency centroid" architecture around it; I'd have seen the dark-souls-style mid-body windows immediately.

The face detector approach also has a known soft edge: stylized art that the model doesn't recognize (Remember Me's huge close-up face — Ultraface returns score 0.37 on tiny phantom features, well below the 0.4 threshold; the actual face dominates the source and the model just doesn't see it as a face). Remember Me falls through to smartcrop, which lands the anchor at the top of the frame, which means the visible band shows hair + eyes + nose and clips chin. There's no good answer here — a face that fills 80% of source height in a 3:1 frame *cannot* be shown completely in a 7.5:1 row crop. I documented the limitation, the project owner accepted it, and we moved on.

The third thing worth saying out loud: **route view-transition gotchas compound silently.** Across this arc I hit four of them — the morph un-flipping mid-animation (CSS transforms don't preserve), the row's named groups creating phantom fade-outs on nav (per-row `view-transition-name` exists for reorder VTs but causes cross-talk on nav VTs), the destination's darkening gradient appearing only after the morph completed (the gradient was in the root group, not the named-hero group), and the backdrop layer leaking previous-game pixels behind the profile-backdrop fade-in (a retained `activeClaim` kept the old `<img>` mounted at opacity 0 with cached bytes during src swaps). Each one is a tiny thing. Together they're the difference between "the morph feels natural" and "wait, what just happened." VT debugging needs the *finished* visual standard up front, because each individual quirk reads as acceptable in isolation.

## Code references

- [SteamSubjectAnchorService](../../apps/api/src/steam/subject-anchor.service.ts) — anchor orchestration: face → smartcrop fallback, with all four refinements applied
- [FaceDetectionService](../../apps/api/src/steam/face-detection.service.ts) — Ultraface inference loop with two-stage resize, size filter, edge guard, 0° preference
- [SteamImageService.hero / steamLibraryHeroUrl](../../apps/api/src/img/steam-image.service.ts) — proxy route with `flop` and `trim` baked into the served bytes
- [SteamGameRowShell](../../apps/web/src/steam/_shared/steam-game-row.tsx) — row render using `subjectXPercent / subjectYPercent / flipHero` from the API payload
- [library-row-redesign.md](../working-notes/steam/library-row-redesign.md) — the planning note with the 25-asset sample analysis that drove the abandoned approaches
