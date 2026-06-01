# Subject-chapter design spec

Crystallized from the R-2 Ahri chapter build. Read this before scoping or implementing any new per-subject chapter (R-3 Steam game subjects, future LoL champion chapters, moment chapters). Skim time: ~5 minutes. Implementation time saved: hours of re-discovering rejected paths.

This is a **vocabulary doc**, not a plan. The "what we build next" lives in [self-portrait-recap-arc.md](./self-portrait-recap-arc.md). This file documents the *how*: which primitives are mature, which patterns work, which experiments we tried and rejected.

## How to use this doc

When scoping a new chapter:
1. **Skim the "Primitives" and "Per-subject hooks" sections first** — they tell you what the framework already does for you.
2. **Read "Editorial composition", "Typography & color", and "Animation cascade"** before writing JSX — they encode the rules that made R-2 read as editorial rather than dashboard.
3. **Skim "Rejected experiments" before suggesting any visual flourish that touches the splash backdrop or accent text** — chances are it was tried and rejected with notes on why.
4. **Run through the "Pre-flight checklist"** at the start of the chunk plan.

When iterating an existing chapter, the relevant sections are the same — this doc is the design language, not a one-time onboarding.

## Primitives that already work

All in `apps/web/src/home/recap/` unless noted. None of these need to be invented for a new subject chapter:

| Primitive | Purpose | File |
|---|---|---|
| `ChapterContainer` | Sticky-pin scroll integration, exposes a `nudged` boolean once the chapter is in pin position. Configure `pinViewports` (default current convention: 1) and `pinClassName`. | `chapter-container.tsx` |
| `ChapterReveal` | Per-element entrance — fade + rise + optional `blur` for hero tier. Gated on `active` (typically `nudged`). Cascade via `delay`. | `chapter-reveal.tsx` |
| `ChapterOpener` / `Detail` / `Stats` / `Closer` | Four-band slot layout inside the pinned viewport. `data-band='detail'` etc. for tests. | `chapter-bands.tsx` |
| `VerdictProse` | Renders typed `VerdictClause[]` segments with per-kind typography. Animates number segments via CountUp when `numbersActive` flips on. | `verdict-prose.tsx` |
| `CountUp` | Number tween with `start` gate + `delay` (so it fires AFTER the surrounding reveal lands, not on mount while off-screen). | `apps/web/src/components/count-up.tsx` |
| `parseAnimatableNumber` | Shared parser — extracts `{raw, decimals, suffix}` from values like `"55%"`, `"3.22"`, `"3 games"`. Returns null for compound shapes (`"24/7/14"`). | `parse-animatable-number.ts` |
| `useAssetClaim` | Publishes the chapter's splash claim into the atmosphere substrate (drives the full-bleed splash, `--accent`, blurhash placeholder, bloom MotionValue). | `use-asset-claim.ts` |
| `useSkinRotation` | Auto-cycling rotation index for chapters that rotate through multiple asset variants (skins for LoL, screenshots for Steam). Returns `{activeIndex, bloomBlurPx}`. | `use-skin-rotation.ts` |
| `useChapterNudge` | Polite one-shot IntersectionObserver nudge — fires at 0.5 visibility and ALWAYS snaps the chapter top into viewport-top alignment, regardless of approach direction. Book-page UX: every chapter is a deliberate viewing surface, anywhere you land gets pulled to the canonical top so the cascade reads from beat one. Don't re-implement per-chapter; don't add a "skip if already approximately aligned" tolerance (rejected — kills the book-page intent). | `use-chapter-nudge.ts` |
| `ScreenshotLightboxStrip` | Radix Dialog lightbox for the closer band — thumbnail strip + prev/next + ESC + arrow keys. Scoped to chapter use; reuse it instead of `target="_blank"` thumbnails or rebuilding the lightbox. | `screenshot-lightbox.tsx` |

**Server-side deriver pattern** (in `@vyoh/shared`): the chapter calls a typed recap query hook (`useChampionRecap` for LoL); the API runs `deriveX(...)` over raw match/session rows and returns a slim shape. R-3 Steam should mirror this — don't flatten/filter on the client.

## Editorial composition rules

The single most load-bearing rule from R-2:

> **The chapter is a magazine spread, not a dashboard.** Bare wrappers, no cards around the chapter itself, no card chrome where a typographic statement does the work.

Concrete sub-rules:

- **Bare chapter wrapper.** Children sit on the splash directly, no `rounded-* border bg-card/*` around the chapter. This matches the [compositional chrome rule](../../repo-conventions.md) in `repo-conventions.md` — chrome belongs at the lowest level that visually groups heterogeneous content. The chapter as a whole is too high in the tree.
- **One viewport pin, not two.** `pinViewports={1}` is the current default — early R-2 used 2 and it felt like dead air on the second viewport. Use 2 only if the chapter has a deliberate two-beat reveal that justifies it.
- **Pin padding sits at `pt-[6dvh]`, not 10dvh.** R-3 feedback round: 10dvh felt generous up top and pushed dense chapters (Steam with standout block + screenshots strip) into a tight bottom. 6dvh threads the line between "centered enough to feel composed" and "leaves room for the bottom bands". Adjust higher only if a chapter has a clearly lighter footprint — Ahri reads fine at 6dvh too, so default there.
- **Eyebrow + masthead baseline-aligned on a flex-wrap row**, not stacked. Pattern: `<flex flex-wrap items-baseline gap-x-4>` with `Ahri` (text-6xl) + `the Nine-Tailed Fox` (text-base italic) on the same row. Wraps gracefully on narrow viewports.
- **Verdict prose ties to `max-w-prose`** inside a wider chapter container — body copy needs editorial measure (~65ch) even when sibling tiles (signature game, recent matches strip) stretch to the full container width. The wrapper opens up; the prose closes back down.
- **Choose `SectionTitle` vs `CardTitle` by chrome, not by content semantics.** Per [repo-conventions.md](../../repo-conventions.md). In a chapter, almost every header is page-zone (`SectionTitle`-style) because the chapter has no chrome to host card titles.

### Header primitive choice within a chapter

Most sub-sections inside a chapter use small uppercase-tracked labels (`text-[10px]` or `text-sm uppercase tracking-[0.2em]`). They're inline ad-hoc, not the `SectionTitle` primitive — chapters are deliberately denser typographically than the rest of the app and the chapter primitive owns its own header tier. If a new chapter starts repeating the same header shape three+ times, factor a `ChapterBandHeader` inside `chapter-bands.tsx` rather than reaching for `SectionTitle`.

## Typography & color tiers

Four shadow tiers, defined inline at the top of `ahri-chapter.tsx`. Move these to a chapter-shared module if R-3 reuses them verbatim (likely):

```ts
SHADOW_MASTHEAD  // hero text (h2 masthead + signature KDA)
SHADOW_BODY      // verdict prose, signature meta, recent-rows text
SHADOW_LABEL     // small uppercase labels (eyebrow if no accent, skin label)
SHADOW_ACCENT    // accent-tinted glyphs — paired with paint-order stroke
```

Format is always `[hard zero-blur inner] + [tight halo] + [soft outer glow]`. The hard inner is the load-bearing layer — it cuts the glyph edge from the background regardless of background chroma. Soft blur alone fades into bright splashes.

### Accent text needs `paint-order: stroke fill`

This is the only lever that defeats red-on-red hue collision (e.g. red accent on warm Spirit Blossom / After Hours splashes). Constants live next to the shadows:

```ts
STROKE_ACCENT = "1.25px rgba(0,0,0,0.92)"
```

Applied at the call site:

```tsx
style={{
  color: "var(--accent, currentColor)",
  paintOrder: "stroke",
  WebkitTextStroke: STROKE_ACCENT,
  textShadow: SHADOW_ACCENT,
}}
```

`paint-order: stroke` paints the stroke first then the fill on top — the colored glyph stays at original width, the stroke acts as a true outline around it. Without `paint-order`, a 1.25px stroke would inflate the glyph from inside and look chunky.

### KDA stays white

We considered color-coded K (green) / D (red) / A (blue) for the signature game KDA and rejected it. Reasons:
1. **Editorial vs dashboard vocabulary** — color-coded KDA is op.gg / League scoreboard vocabulary. Importing it onto an editorial spread reads as the same category mismatch as a card border around the chapter.
2. **Color budget** — `var(--accent)` already does per-champion semantic work; win/loss colors sit right below the KDA. Three more semantic colors on K/D/A puts the chapter at six color roles in a ~150px span and dilutes the accent's prominence.
3. **Hero KDA's job is mass** — at `text-5xl` semibold, the score works as a single weighty block. Subdividing it into three colors costs that mass for no signal a position-trained reader couldn't already extract.

The same logic applies to any "color the semantic field" temptation — keep semantic color for the accent token and for win/loss, no further subdivision.

## Animation cascade

Established delays from the Ahri chapter (in seconds after `nudged` flips true):

| Element | Reveal delay | Notes |
|---|---|---|
| Eyebrow | 0.05 | Kicker, plain fade+rise |
| Masthead | 0.18 | Hero tier — `blur=16`, `duration=1.1`, `rise=20` |
| Verdict prose | 0.55 | `blur=6` (lighter hero blur) |
| Signature game block | 0.7 | Standard fade+rise |
| Recent matches header | 0.85 | Standard |
| Recent matches rows | 0.9 + i*0.06 | Staggered per-row |
| Peak chips | 1.25 / 1.32 / 1.39 | Triplet stagger |
| Closer (CTA) | 1.55 | Last beat |

**Blur entrance is the hero marker.** Reserve `blur=...` for the elements you actually want to read as hero-tier (masthead, verdict lede). Apply it to every band and it loses its weight — and it interacts with descendant `backdrop-filter` in surprising ways (parent filter + child backdrop-filter composites weirdly during the transient blur).

**Count-up fires AFTER its surrounding reveal settles**, not on mount. The CountUp `start` prop gates this:
- `start={nudged}` so it only fires once the chapter is actually in view
- `delay` set to (surrounding reveal's delay + its duration + ~0.1s settle)
- For peak chips, that's `delay + 0.7` per chip — chips count up in their own stagger order automatically

Why this matters: without `start`, CountUp would tween while the chapter is still off-screen, and the user would arrive at static final numbers having missed the animation entirely. We learned this the hard way when a parent `opacity 0→1` blocked descendant count-ups (per the CSS Filter Effects spec — an ancestor with `opacity != 1` is a "backdrop root" and descendant `backdrop-filter` sees an empty backdrop). Same class of problem, different lever.

### Cascade pacing principle

The chapter reads top → middle → bottom. Each beat earns its own moment:
1. Verdict prose count-up at ~1.25s (the claim: "76 games, 55%")
2. Signature game block visible (no count-up here — it would be redundant with the prose's `24/7/14`)
3. Peak chips count-up at ~1.95–2.1s (the closing receipt: `55% · 3.22 · 3 games`)

If a new chapter has a different shape (more or fewer numeric beats), adjust the delays so they still cascade top → bottom. Don't bunch them — overlapping count-ups feel chaotic.

## Hover & interaction

- **Dark hover bands**, not white lifts. `hover:bg-black/25` reads calmer over bright splash crops than `hover:bg-white/8` (white washes out). Applies to every click target in a chapter — signature game block, recent matches rows, etc.
- **`cursor-pointer` on every non-anchor click target** (Tailwind preflight resets `<button>` to default — per [repo-conventions.md](../../repo-conventions.md)).
- **`-mx-N px-N` for hover bands extending past natural padding**, so the hover surface feels like a row affordance rather than a tightly-clipped chip.
- **Whole row is the click target** (the `<Link>`), no nested clickables — keeps focus order clean and works for keyboard nav.

## List row patterns (recent matches strip)

The recent-matches strip taught the most about row composition:

1. **Identity column hugs left, meta hugs right, flex space between.** Don't strand a separator dot in the gap — separators only sit between *peer* meta items.
2. **Role icon LEADS the row** (vertical rhythm with the W/L pill and KDA column on the left). `vs Opponent` follows as a continuous phrase without a separator between icon and "vs" — the icon is a leading badge, not a peer of the opponent name.
3. **`useChampionName()` filter on every opponent display.** Riot aliases (`AurelionSol`, `MonkeyKing`, `JarvanIV`) diverge from display names. Same pattern applies to Steam (game app IDs vs display names) and anywhere else identity surfaces. This is a [repo convention](../../repo-conventions.md), enforced at every render site.
4. **`min-w-0 flex-1 truncate` to actually truncate.** Flex items default to `min-width: auto` (content size), which silently blocks `truncate` from kicking in — long names overflow into the next column without showing an ellipsis. Add `min-w-0` to any flex truncate.
5. **Meta column (`duration · days-ago`) hugs right with `shrink-0`.** Separator goes between the two meta fields (peers), not between identity and meta.
6. **Per-row fields the deriver should expose:** opponent, position/role, duration. Days-ago in relative form (`3d ago`), not precise (`35d` reads as noise when all rows are from the same week).

## Per-subject hooks

What every new chapter needs to provide:

| Hook | Ahri example | Steam (R-3) likely equivalent |
|---|---|---|
| Splash subject + URL | `championBackdropSplashUrl(alias, patch)` | Steam game's hero image URL (CDN) |
| Accent color | `championTheme(alias).dominantHex` | Steam app's `dominantHex` (already pipeline) |
| Skin/variant rotation | `AHRI_SKIN_ROTATION` constant + `useSkinRotation` | Screenshot rotation? Or static hero. |
| Title subtext | `CHAMPION_TITLE = "the Nine-Tailed Fox"` | Steam game's tagline / genre line |
| Subject name resolver | `useChampionName()` filter on aliases | Steam game name resolver (display name vs slug) |
| Typed recap query hook | `useChampionRecap(account, key)` | `useSteamGameRecap(appid)` |
| Server deriver | `deriveChampionRecap` → `ChampionRecap` | `deriveSteamGameRecap` → `SteamGameRecap` |
| Deriver fields needed for rows | KDA, win, opponent, position, duration, playedAt | Session length, achievements unlocked, last-played, recent sessions |

The deriver is the load-bearing piece — get the shape right before writing chapter JSX. Reference the Ahri deriver's slim/wide tradeoff: keep the recent-matches projection narrow (no timeline arrays), but wide enough that each row can tell a story (opponent/role/duration, not just bare score).

## Rejected experiments

What R-2 tried and rejected. Don't re-discover these:

- **Top-band darkening gradient over the splash.** Reads as tacked-on; doesn't solve hue collision (red-on-darker-red still loses). Reject any "scrim that fades from the top" suggestion for splash readability.
- **Localized `backdrop-filter` behind accent text.** At subtle strength → barely visible (doesn't carry readability load). At strong → dashboard-y dimming patch. There's no comfortable middle.
- **Color-coded K/D/A in the signature game.** See "KDA stays white" above.
- **KDA count-up in the verdict prose.** Redundant with the signature game block below at hero scale. The deriver-emitted KDA segment is one composite value (`"24/7/14"`) and animating just the leading kill count would silently collapse the segment's meaning. Compound shapes fall through to static render via `parseAnimatableNumber`.
- **KDA count-up in recent matches rows.** 5 rows × 3 numbers = 15 simultaneous tweens in a subordinate strip. The eye is pulled to chaotic motion rather than to the focal verdict / signature beats. Keep secondary strips static; reserve count-up for the chapter's primary beats.
- **Generic chapter skeleton.** Skeleton must mirror the layout it replaces ([repo-conventions.md](../../repo-conventions.md)). A bare chapter mid-load needs a bare-mirror skeleton, not a generic chrome placeholder.
- **Floating skin label as an absolutely-positioned pill.** When the splash extends past the chapter's max-width to the viewport edge, the pill at the container edge reads as inset. Inlining the skin label into the eyebrow row as `VYOH'S AHRI · IMMORTALIZED LEGEND` solves the alignment dispute structurally (chip is content, not chrome).
- **Eyebrow blur entrance over a backdrop-filter child.** The parent `filter:` animation made the descendant backdrop-filter compose weirdly during the entrance, then "pop" the moment the filter hit 0. Either drop the parent blur or move the backdrop child out — usually the backdrop child wasn't earning its complexity anyway.

## Pre-flight checklist

When opening a new subject chapter chunk:

1. [ ] **Deriver shape signed off?** Don't write JSX before the typed recap shape is finalized — slim enough to not bloat the wire, wide enough that each row/block can tell a story.
2. [ ] **Splash subject + accent + skin rotation hooks identified?** All four `useAssetClaim` inputs known.
3. [ ] **Title subtext copy decided?** Editorial subtitle that pairs with the chapter masthead.
4. [ ] **Subject-name resolver decided?** Anywhere the chapter renders a foreign-identity name, the equivalent of `useChampionName()` must exist.
5. [ ] **Animation cascade sketched** — even on paper. Where does the count-up fall in the eye-leading sequence? Don't bunch beats.
6. [ ] **Test fixtures in shared deriver test exist?** Per the [tests-in-same-commit convention](../../repo-conventions.md). Mock for chapter component lives next to chapter file.
7. [ ] **Reads as editorial, not dashboard?** Before merge: scroll into the chapter, count visible card borders, count color roles, count separator dots stranded in flex gaps. Any of these >1–2 → revisit composition.

## Cross-references

- [self-portrait-recap-arc.md](./self-portrait-recap-arc.md) — active arc, chunk plan, ADRs
- [accent-color-system.md](./accent-color-system.md) — accent token cascade contract
- [safari-vt-snapshot-cost.md](./safari-vt-snapshot-cost.md) — engine-gating perf cliffs (cautionary tale, no chapter feature has hit this so far)
- [../../repo-conventions.md](../../repo-conventions.md) — compositional chrome rule, header primitive choice, hover affordance conventions, `useChampionName` rule
