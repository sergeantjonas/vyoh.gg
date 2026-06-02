# Self-portrait recap arc

**Status:** Active 2026-06-01. Supersedes [atmosphere-arc.md](atmosphere-arc.md) A-3 onward (A-1 / A-2 / A-2a remain as the shipped substrate). Builds on top of [motion-choreography-arc.md](motion-choreography-arc.md) for entrance vocabulary. Resolves [landing-showcase-arc.md](landing-showcase-arc.md) D4-2's stripped-image interim state by re-introducing recognizable imagery via the substrate-supported claim system, but inside an editorial framing the original D4-2 lacked.

**Premise:** the landing page is an always-on retrospective — a scroll-paced editorial recap of recent activity across LoL and Steam. The page is composed of **chapters**: each chapter is 1–4 stacked bands about one *thing* (a game played, a champion mained, an event worth flagging). Hero opens with painterly time-of-day atmosphere; chapters carry the lived-activity story; conclusion morphs back to atmosphere over rhythm content. Chapter count is variable, ordered by recency-decayed activity score, ungated by any fixed time window.

This is the "Spotify Wrapped, but always-on" reframe of the original atmosphere arc, after three rounds of iteration converged on it. ADR-2 (no recognizable imagery) is explicitly retired below — the seam class that motivated it was structurally killed by ADR-3 (continuous atmosphere substrate), and the composition failure mode it described ("Leon's face in the heading") is an art-direction problem solved by directional masks, not an architecture problem.

---

## Brainstorm-preservation: how we got here (2026-06-01 conversation)

Three rounds of iteration during one conversation:

1. **Round 1 — A-3 as a single Steam claim-only band.** The original atmosphere arc had Steam as one editorial band registering an atmosphere claim. Visually thin: a section title and one achievement on top of a slightly-bluer painterly bg.

2. **Round 2 — assets as background instead of atmospheric color.** Owner pushed back: "we have splash art and game hero images, why not use them." Reframed: blur becomes per-claim parameter, asset claims use light blur + directional mask, atmosphere claims stay heavy-blur ambient. ADR-2's no-recognizable-imagery rule retired (the seam problem that motivated it was already gone post-ADR-3).

3. **Round 3 — chapters, not bands.** Owner pushed again: "bands need to tell an activity story." Reframed: page is an editorial recap of *what's been happening*. Multi-band chapters (one per game / champion / event), scroll-pin reveals (Apple product page pattern), variable chapter count, recency-decayed score with no fixed window. Page becomes "always-on Wrapped."

4. **Round 4 — refinements.** (a) Ahri-OTP confirmed; LoL subject chapter rotates through favorite skins as an in-chapter scroll beat. (b) "Playing X lately" as Steam chapter copy framing, not "Steam · latest unlock." (c) Steam app-type filter (`type === "game"`) + curated `HIDDEN_APPIDS` blacklist. (d) Conclusion keeps structural-rhythm beats (chronotype, totals) but tightens the bento clutter.

5. **Apple-pattern register confirmed.** Owner referenced Apple product pages — pin sections + scroll-coupled progressive reveal + signature beats per scene. This is a *register shift* from the original arc's restrained Linear/Resend reference. Atmosphere is still restrained at the page level (entry + conclusion); chapters are cinematic.

---

## Model

### Chapter kinds

Two shapes, distinguished by what the chapter is *about*:

**Subject chapters** — about a *thing* the owner spends time on. Multi-band, full-bleed asset bg, pinned reveal. The page's main beats.
- **Ahri** (always present; LoL OTP). Splash-rotating bg across owner-curated skin list.
- **Steam game** (0–3 at a time, scored by recency-decayed playtime). Hero library image bg, screenshots/trailer rotator.

**Moment chapters** — about an *event* worth flagging. Single-band or 2-band, vignette-style asset, non-pinned scroll-through. Variety + character.
- See "Moment chapter catalog" below.

### Recency-decayed scoring (no window gate)

```
score(chapter) = base_signal × exp(-days_since / HALF_LIFE)
```

`HALF_LIFE ≈ 14d`. Chapter is included if `score > FLOOR`. No fixed "this week" or "last 30 days" gate — the recap surfaces the most recent activity worth talking about, however old, until score decays below noise floor.

`base_signal` examples:
- Steam game: total playtime × 1.0 + achievement_count × 0.5
- LoL Ahri: always a constant high signal (it's the subject chapter, score's only used for ordering vs other chapters)
- RANK_UP moment: 1.0 (binary event)
- OFF_META moment: 1.0 boosted to 1.5 (contrast against Ahri-OTP routine — see "off-meta visibility" below)
- MARATHON moment: scaled by session length

### Inclusion rules

- **Ahri subject chapter** is unconditional — always present.
- **Steam subject chapters**: top-K by score where `score > FLOOR`, K capped at 3.
- **Moment chapters**: any qualifying event with `score > FLOOR`, capped at 3 LoL + 2 Steam at a time.
- **Off-meta moment**: any non-Ahri LoL match in the last `4 × HALF_LIFE` window gets a chapter, regardless of score (rarity itself is the signal).
- **Lifetime fallback**: if all chapter scores are below floor (deep hiatus), page collapses to hero + conclusion only. Conclusion editorial copy adapts ("Quiet stretch — here's the structural shape").

### Honest recency framing

Chapter copy adapts to age bucket so framing matches data:

| Age bucket | Steam framing | LoL moment framing |
|---|---|---|
| 0–7d | "Playing X lately" | "Last week" |
| 8–30d | "Recently into X" | "This month" |
| 31–90d | "Spent {N}h on X this season" | "Earlier this season" |
| 91d+ | "Was deep in X this {winter/spring/...}" | "Earlier this year" |

The page never lies about recency. A 47-day-old latest-unlock is framed as 47 days old, and that *itself* becomes a portrait detail — quiet stretches are honest, not hidden.

### Sequencing

Pure score order, interleaved across streams. Caret-clickable hero scroll-hint advances by *chapter*, not by viewport. Ahri usually leads (OTP signal is strong) but a RANK_UP moment can outrank it some weeks; a Steam game with 30h sunk this week can outrank both.

---

## Subject chapter scroll-timeline

The Apple-style pattern: each subject chapter has a sticky-pinned window during which scroll progress drives a progressive reveal. Reaching the bottom of the pin unpins and the next chapter starts painting from below.

```
┌─ chapter approaches viewport
│   bg: heavily blurred asset (32px), dim 0.5, low chroma
│   copy: off-screen below
├─ chapter top hits sticky line ───── pin starts ─────
│   bg crystallises: blur 32→4px, dim 0.5→0.95, chroma 0.7→1.1
│   eyebrow word-by-word reveal (~250ms each)
│   title fade-in + scale (large display type)
│   metric line slides up from below, CountUp ticks
│   detail rows reveal one-by-one (achievements / matches / unlocks)
│   stat bars draw in (width 0 → measured, ~600ms each)
│   icons walk in left-to-right with scale-pop on land
│   signature beat fires (chapter-type-specific — see catalogs)
├─ pin holds at final state ~15% of viewport
└─ chapter unpins; bg crossfades into next chapter's asset
```

Pin window ≈ 1.5–2× viewport tall. All motion is `scrollY`-coupled — no time-based animation, every frame deterministic from scroll position. Apple feel.

### Ahri subject chapter (always present)

Pin window ~2× viewport. Bands stacked vertically within pin:

1. **Opener** — splash bg, "Your Ahri", mastery level + points (CountUp tick).
2. **Recent sessions strip** — last 5–10 Ahri matches, KDA + outcome + duration, scannable row.
3. **Trends** — winrate over rolling window, KDA distribution, build variation (mythic / boots / 3rd item choices that recur), matchup heatmap.
4. **Standout moment** — one match flagged (highest damage share, biggest comeback, longest game, perfect KDA), linking to `/lol/$accountSlug/matches/$matchId`.

**Skin rotation** — within the pin window, splash rotates through curated skin list at e.g. 25 / 50 / 75% scroll progress. Transition shape: both splashes briefly bloom to 32px blur at peak (so neither is recognizable for ~150ms), then resolve to new splash at 4px. The "ethereal blur moment" between concrete states is the signature; reads cleaner than a hard crossfade.

**Curation:** owner-selected skin list in [`landing-config.ts`](../../apps/web/src/home/landing-config.ts) (to create). Default placeholder: `["Base", "K/DA", "Spirit Blossom", "Star Guardian", "Elderwood"]`.

### Steam game subject chapter

Pin window ~1.5–2× viewport. Bands:

1. **Opener** — game library hero bg (light blur 4px), "Playing {Game} lately" / "Recently into {Game}" / age-bucket-appropriate framing, total playtime CountUp.
2. **Recent unlocks** — last N unlocks for this game, achievement icons + names, revealing one-by-one as scroll progresses. Progress-toward-100% bar at end.
3. **Stats** — playtime sessions (e.g. last 2 weeks shape), achievement %, optional ranking ("top X% of players on this achievement" if Steam exposes it — see [steam-api-unused-data.md](steam-api-unused-data.md)).
4. **Closer** — screenshots / trailer rotator (already exists at [microtrailer-hover-preview.md](microtrailer-hover-preview.md) and game-detail page). MVP uses screenshots only; trailer is a follow-up beat (see ADR refresh below).

**Filter:** Steam store API `type === "game"` (excludes Wallpaper Engine, 3DMark, utility apps that happen to have achievements) + `HIDDEN_APPIDS` curated list in [`landing-config.ts`](../../apps/web/src/home/landing-config.ts).

---

## Moment chapter catalog

Each moment is single-band or 2-band, scrolls through naturally (no pin), with one signature beat as its memorable visual. Whitelist-driven — open detection produces noise.

| Event type | Detection | Signature beat | Source data |
|---|---|---|---|
| `RANK_UP` | Tier or division increases vs prior recorded | Rank icon flips old→new, divisions tick down, chevrons populate | LoL ranked snapshot, cross-time comparison |
| `RANK_DOWN` | Tier or division decreases | Same flip in reverse; honest framing | Same |
| `OFF_META_PICK` | Non-Ahri LoL match within `4 × HALF_LIFE` | Ahri silhouette dissolves into N champion silhouette | Match history |
| `MARATHON_SESSION` | ≥4 LoL matches within 6h window | Clock face spinning through session window; match pips dropping onto timeline | Match history clustering |
| `KDA_OUTLIER` | Match KDA in top 1% or perfect (0 deaths) of last 100 | Numbers scaling in with weight; participant comparison strip | Match details |
| `STREAK_5W` / `STREAK_5L` | 5 consecutive wins / losses | Pips lighting up along a row in sequence | Match history |
| `RETURN_FROM_HIATUS` | ≥21d gap between last 2 matches | Calendar visualisation showing the gap, then activity resuming | Match history |
| `ACHIEVEMENT_CLUSTER` | ≥5 unlocks on one Steam game in 24h | Icons cascading + game capsule pulsing | Unlock timestamps |
| `FIRST_TIME_GAME` | Steam game with first achievement unlock within window | Capsule revealing from blur with "First steps" framing | Unlock history |

The whitelist grows over time; each new moment type adds one signature beat. Generic "you did a thing" detection is deliberately out — it produces noise.

### Off-meta visibility boost

As Ahri-OTP, *contrast* is part of the self-portrait. Non-Ahri moment chapters get score × 1.5 so they don't get buried by routine Ahri activity. "The three non-Ahri games this year" is more interesting than the 50th Ahri game.

---

## Hero & conclusion

### Hero (unchanged from atmosphere arc)

Painterly time-of-day atmosphere (substrate A-1 / A-2 / A-2a shipped). Orb is the focal point. Scroll-hint caret advances to first chapter on click. The hero is the only painterly atmospheric region between asset-driven chapters; it's the page's quiet entry.

### Conclusion (refined from original arc A-6–A-8)

After the last chapter unpins, bg fades from asset → atmospheric (painterly time-of-day returns, dimmed). Conclusion bands:

1. **Editorial closer** — single line / short paragraph framing the page. E.g. "That's the picture. Built with React 19, NestJS, Postgres, and far too many Ahri games. — Jonas". Reduced motion, no signature beat — this is the page's pause.
2. **Rhythm band — three structural dimensions of activity.** Full-width band that absorbs [`TileChronotype`](../../apps/web/src/home/tile-chronotype.tsx) (hour-of-day), [`TileDaySplit`](../../apps/web/src/home/tile-day-split.tsx) (day-of-week), and [`TileSessionLengths`](../../apps/web/src/home/tile-session-lengths.tsx) (typical session duration) into one editorial beat with three sub-strips. Reads as "when does Jonas play" with three orthogonal answers: which hours, which days, what shape of session. One beat, three dimensions — not three competing bento tiles.
3. **Lifetime totals strip** — tight chip row: total LoL matches, total Steam playtime, oldest tracked match date, oldest tracked unlock date. Absorbs [`TileWeeklyTotals`](../../apps/web/src/home/tile-weekly-totals.tsx).
4. **Footer chips** — build hash, domain age, links. Replaces [`TileBuildBadge`](../../apps/web/src/home/tile-build-badge.tsx) / [`TileDomainAge`](../../apps/web/src/home/tile-domain-age.tsx).

The entire bento retires. Tile-by-tile migration map:
- `TileSignatureGame` → Ahri chapter opener (mastery + most-played)
- `TileLastMatch` → Ahri chapter recent-sessions strip
- `TileChronotype` → conclusion rhythm band (hour sub-strip)
- `TileDaySplit` → conclusion rhythm band (day sub-strip)
- `TileSessionLengths` → conclusion rhythm band (session-shape sub-strip)
- `TileWeeklyTotals` → conclusion lifetime totals strip
- `TileBuildBadge` / `TileDomainAge` → conclusion footer chips
- `LandingSteamBand` (interim-stripped) → Steam subject chapter (R-3)

---

## Cross-cutting concerns

Three constraints that span the arc and need explicit owners so they don't get implicit-retired:

### Accent token cascade

Per-route `--accent` already shifts on `/lol/$accountSlug/...` (splash dominant) and `/steam/game/$appid` (`dominantHex` pipeline) — see [accent-color-system.md](accent-color-system.md). The recap arc is the natural place to extend this to `/`: each chapter that carries an asset claim can drive a parallel `--accent` shift sourced from the asset's dominant color, alongside the `--atmosphere-tint-h` the substrate already publishes. Hero and conclusion regions fall back to the default neutral accent. Lands during R-2 / R-3 (first chapter implementations) so the cascade contract is wired in from the first chapter, not retrofit. The atmosphere arc cross-referenced this in its own ADRs but never hooked it up — A-2 / A-2a touched only the orb's tint hue, not the broader cascade (scrollbar, focus rings, sparklines, `<meta name="theme-color">`).

### Perf-baseline measurement

Atmosphere arc said "the atmosphere layer must not regress LCP/INP." That constraint extends here with more surface area: chapter pin sections + signature beats + asset preloading + chapter-to-chapter crossfade all have realistic ways to regress LCP/INP/CLS on `/`. Capture baseline against [perf-baseline.md](perf-baseline.md) before R-2 lands, then re-measure at R-9 (asset preloading) and R-12 (editorial pass). Lighthouse on real Firefox + Safari per the host-Chrome capture pattern documented in perf-baseline.

### Reduced-motion contract

Inherited from the atmosphere arc's ADR-4 with broadened scope per this arc's ADR-4. Every new motion surface added in R-N must ship its reduced-motion variant in the same commit per the global [reduced-motion-replacements.md](reduced-motion-replacements.md) standing rule. Specifically: chapter pin → no pin, content stacks vertically; signature beats → static end-state; skin rotation → single splash; chapter crossfade → instant transition.

---

## Curation config

A new module: [`apps/web/src/home/landing-config.ts`](../../apps/web/src/home/landing-config.ts).

```ts
// Owner-curated overlay on the algorithmic chapter selection.
// Hard-coded (no admin UI) — committed file, edit by hand.

export const AHRI_SKIN_ROTATION = [
  "Base",
  "K/DA",
  "Spirit Blossom",
  "Star Guardian",
  "Elderwood",
] as const;

// Steam apps to never surface as a subject chapter, even if score qualifies.
// Note: `type !== "game"` already filters most utilities (Wallpaper Engine,
// 3DMark) — this list is for apps that ARE games but the owner doesn't want
// surfaced on the portfolio.
export const HIDDEN_APPIDS: number[] = [];

// LoL queue IDs to exclude from moment-chapter detection (custom games,
// tutorials). Ranked / draft / aram / arena stay included.
export const HIDDEN_QUEUE_IDS: number[] = [];

// Optional: pin one chapter to the top regardless of score. null = pure
// algorithmic ordering. Set to a chapter slug to override.
export const PINNED_CHAPTER: string | null = null;

// Optional: per-chapter editorial copy overrides. Falls back to age-bucket
// defaults when not set.
export const CHAPTER_COPY_OVERRIDES: Record<string, { eyebrow?: string; title?: string }> = {};
```

Hard-coded MVP. Promotes to admin UI later only if editing weekly becomes annoying.

---

## Architecture decision records (refresh)

### ADR-1: Pure JS via motion/react (carried over from atmosphere arc)

Unchanged. Firefox lacks `timeline-scope`; we use `useScroll` + `useTransform` for scroll-coupled interpolation. Adds: same engine choice extends to the chapter pin + reveal patterns. CSS scroll-driven animations may layer in as enhancement later.

### ADR-2 (RETIRED 2026-06-01): No recognizable imagery

**Retired.** Original rationale was D4-2's "Leon's face in the heading" failure — full-bleed game hero with no directional mask intruded on copy region. With ADR-3's continuous-atmosphere substrate, the seam class that motivated heavy blur is gone, and the composition failure is solved structurally:

- **Directional gradient mask** — instead of a centered ellipse, asset-claim chapters use a top-fade-to-dark mask (op.gg pro-player banner pattern, Spotify Now Playing pattern) that darkens specifically where copy lives.
- **Off-center asset positioning** — chapter assets compose with copy in mind (asset breathing in lower 2/3, copy in upper 1/3 or in side-vignette region).
- **Per-claim blur parameter** — atmosphere claims keep heavy blur (80px); asset claims use light blur (4–8px) so art is recognizable.

Recognizable game art and champion splashes are now the *point*, not the failure mode.

### ADR-3: Continuous atmosphere substrate (carried over, foundational)

Unchanged. One atmosphere layer behind the whole page, claims drive its state, no band has its own backdrop element. Now extended: claims can carry asset images with per-claim blur. Substrate is fixed; chapter rendering composes on top.

### ADR-4: Snap, not morph, under reduced-motion and Safari (carried over, expanded)

Carried over with broader scope. Reduced-motion + Safari paths:

- No sticky pins (chapters scroll through naturally)
- No scroll-coupled progressive reveal (chapter content visible immediately)
- No skin rotation (single splash, no transition)
- No signature beats (static end-state)
- Editorial cards stack vertically as conventional editorial content

Same content, no scroll-coupled motion. Engine-gate detection lives in [`apps/web/src/lib/is-webkit.ts`](../../apps/web/src/lib/is-webkit.ts) (already in tree per [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md)).

### ADR-5: Trailer / video deferred to polish pass

**New.** Original brainstorm mentioned teaser trailers as a chapter visual element. Video adds real weight (5–15 MB per chapter, autoplay policies, reduced-motion respect, mobile/data, a11y). MVP uses screenshots only (Steam's `screenshots[]` field — cheap, already API-available, no autoplay complexity). One Steam chapter type promotes to "screenshots + optional trailer" as a follow-up beat after the rest of the page is solid. Doing it earlier means a third of arc budget tuning video.

### ADR-6: Hard-coded curation, not admin UI

**New.** [`landing-config.ts`](../../apps/web/src/home/landing-config.ts) is a committed source file. Owner edits it by hand. Admin UI is a tempting product idea but adds non-trivial complexity (auth, write surface, deploy/cache invalidation). Edit-by-hand stays cheap for a single-user portfolio; promote later only if friction is real.

---

## Chunk plan (MVP-first)

Substrate (A-1 / A-2 / A-2a) already shipped from atmosphere arc — chapters build on it.

**R-1. Chapter scaffolding primitives.** Create [`apps/web/src/home/recap/`](../../apps/web/src/home/recap/) directory. Build `ChapterContainer` (sticky-pin wrapper with scroll-progress context), `ChapterOpener` / `ChapterDetail` / `ChapterStats` / `ChapterCloser` band primitives, `useChapterProgress` hook (scroll progress through the pin window). Asset-claim variant of `useAtmosphereClaim` that carries `image` + per-claim blur. Tests for each primitive (claim registration, progress hook math, reduced-motion collapse). **No visible UI yet** — pure scaffolding.

**R-2. Ahri subject chapter (hardcoded data). ✅ SHIPPED 2026-06-01.** First end-to-end chapter. Hardcoded skin list, server-side recap deriver (365d window) replacing the early client-side filter, four-band layout in one pinned viewport, splash-rotation beat with blur-bloom transition, editorial verdict prose with structured segments, signature game receipt as a bare editorial block, enriched recent-matches strip with role icons + filtered opponent names, peak chips with count-up cascade, paint-order outline on accent text. **Design vocabulary crystallized in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md) — every R-2 polish iteration is one bullet there. Read that spec before R-3 to skip re-discovery.**

**R-3. Steam subject chapter (hardcoded appid).** Second chapter type, hardcoded to a known appid (e.g. latest-unlock game). Pulls game hero image, unlocks, playtime. Screenshots rotator (trailer deferred per ADR-5). **Two chapters visible; eyeball the chapter-to-chapter crossfade. Pre-flight checklist + per-subject hooks table both in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md).**

**R-4. `useChapters()` selection logic. ✅ SHIPPED 2026-06-02.** Scoring function (true-half-life decay, HALF_LIFE=14d), floor threshold, per-kind caps (K=3 Steam subjects). Discriminated `ChapterDescriptor = steam-subject | lol-moment | steam-moment` so R-6 / R-7 are additive. API at `apps/api/src/recap/` (parallel reads of `getOwnedGames()` + `steamPlayerUnlock.groupBy`), web hook at `apps/web/src/home/recap/use-chapters.ts` mirroring `useSteamGameRecap`'s 30-min staleTime. `landing-config.ts` curation overlay (`HIDDEN_APPIDS`, `PINNED_CHAPTER`, `CHAPTER_COPY_OVERRIDES`) layered client-side so the API stays a pure ranker. Ahri anchor kept hardcoded above the algorithmic list per owner's on-brand framing. Tests cover scoring, cap, floor, hidden-appid filter, freshest-signal precedence, pin/override helpers. Lands in three commits: `f804c34f` (api + scoring), `3a5078d2` (hook + overrides), `db4a7941` (steam-chapter prop + index swap). **Page is now data-driven.**

**R-5. Conclusion refactor.** Retire bento. Add editorial closer, full-width chronotype, lifetime totals strip, footer chips. Atmosphere fades back from asset to painterly. **Page has its ending.**

**R-6. First moment chapter — `OFF_META_PICK`.** Detector + signature beat (Ahri-to-other silhouette dissolve). Establishes the moment-chapter pattern in code. Test against fixtures. **One moment chapter as proof-of-pattern.**

**R-7. Moment chapter expansion.** Add `RANK_UP`, `MARATHON_SESSION`, `KDA_OUTLIER`, `STREAK_5W` / `STREAK_5L`, `RETURN_FROM_HIATUS`, `ACHIEVEMENT_CLUSTER`, `FIRST_TIME_GAME` detectors + signature beats. Each its own commit or pair of commits; not all need landing simultaneously.

**R-8. Caret-clicks-advance-by-chapter.** Update hero scroll-hint to compute chapter boundaries from refs registered via the atmosphere provider; click scrolls to next chapter's pin-start (or pin-end if already in a pin). End-of-page state: caret flips to "back to top."

**R-9. Asset preloading.** Intersection-observer ahead-of-viewport (`rootMargin: 50%`) preload for chapter assets so the bg snap-in isn't visible. `<link rel="preload">` injection for first 2 chapters at app load.

**R-10. Trailer polish (ADR-5 promotion).** One Steam chapter shape gets an optional trailer in the closer band. Autoplay-on-pin, mute by default, reduced-motion-respecting, mobile-data-aware.

**R-11. Reduced-motion + Safari engine-gate.** Static chapter rendering path (no pins, no progress reveal, no skin rotation, no signature beats). Verify on real WebKit per [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) precedent.

**R-13. Multi-beat chapter model — Steam retrofit + new stats.** Chapter shifts from "single editorial moment in one viewport" to "multi-beat narrative pinned across N viewports". Scroll progress through the pin drives a beat index; prior beat animates out, next animates in. Solves the dense-content overflow case ([Silksong screenshot evidence](https://github.com/anthropics/claude-code/issues) — 5 unlocks + verdict + standout + stats + screenshots was already crowding the pin) and opens slots for stats that didn't fit the single-pin shape.

- **New primitive `ChapterBeats` + `ChapterBeat`.** Slotted multi-beat container inside `ChapterContainer`. Beats stack absolutely inside the pin and crossfade based on `useBeatIndex(progress, beatCount)`. `ChapterContainer` accepts `beats={N}` and scales its outer height to `N × beatViewports × 100dvh` (default `beatViewports ~= 0.6` — felt-right starting point per the open decision below).
- **Beat-scoped progress signal.** The signal that R-1 removed (because it fired band reveals while bands were off-screen) is re-introduced *scoped to the sticky child*. Now the bands are inside the pin and visibility is implied, so the original failure mode doesn't apply. `useChapterProgress` returns a MotionValue 0–1 through the pin window; `useBeatIndex` derives an integer index from it with transition zones (e.g. 0.0–0.2 = beat 0 fully shown, 0.2–0.25 = transition, 0.25–0.45 = beat 1 fully shown, etc.).
- **Steam chapter beat structure (4 beats):**
  1. **Identity + verdict** — eyebrow, masthead, tagline, verdict prose, standout milestone receipt.
  2. **Recent unlocks** — current 5-row strip with breathing room, plus an unlocks-per-week sparkline as a header band.
  3. **Stats deep-dive** — current `completion / 2-weeks / rarest` strip + new stats: average achievement rarity (median percentile), time-to-100% percentile (if completed), achievements-remaining ladder (if not), playtime trend (active / dormant / spike). Pulled from data we already have ([steam-api-unused-data.md](steam-api-unused-data.md) entries graduate here).
  4. **Screenshots** — `ScreenshotLightboxStrip` larger and full-bleed inside the beat, behaves as a horizontal gallery rather than a teaser sliver.
- **Steam chapter is the proof.** Retrofit Steam first; Ahri stays single-pin until R-14 to keep the comparison side-by-side during review.
- **Engine-gate + reduced-motion fallback.** Both engines collapse to a vertical stack of all beats with no pin, no progress signal, no crossfade — the same "tail of stacked bands" shape they already produce in R-11. The pin model is the canonical experience; the static path is the accessible / engine-conservative substitute. No new code path here — `pinViewports={1}` collapse + bands rendered in document order already covers it.
- **Spec doc revision (`subject-chapter-design-spec.md`).** The "one viewport pin, not two" rule changes to "one pin window per chapter, beat count drives pin length." Animation cascade table gets a per-beat extension: each beat has its own delay 0 reset when it becomes active. Add a "beat composition" section between "Editorial composition" and "Animation cascade". Add at least one rejected experiment from R-13 work (TBD during build).
- **Tests:** `useBeatIndex` threshold math (transitions, boundaries, edge cases beat=0 / beat=N-1), `ChapterBeats` renders correct beat at progress=X, engine-gate fallback renders all beats stacked.

**R-14. Ahri retrofit to multi-beat.** Once Steam is signed off in R-13, port Ahri:
1. Identity + verdict (current opener + verdict prose).
2. Signature game + recent matches (current detail band).
3. Peak chips + new LoL stats (top synergies, lane-phase win rate, rank trajectory).
4. Skin gallery as an explicit beat — the current background-only rotation becomes a foreground gallery moment with skin name + rarity tier + first-acquired year. Foreground skin gallery is a small editorial upgrade enabled by the beat model; the background substrate rotation continues independently.

Likely 1-2 commits. Re-tune cascade delays inside each beat so they don't try to fire all at the prior R-2 timings against the new beat-onset moment.

**R-12. Editorial pass.** Full visual review against real data, tune blur values, mask shapes, beat timings, copy bucketing. Likely 2–3 polish commits. **Now happens after R-13/R-14 — the editorial tuning needs to land on the final beat model, not on a transitional layout.**

---

## Open decisions

1. **Ahri skin rotation list.** Default placeholder in plan; owner edits before R-2 ships. Five skins felt right for a ~2× viewport pin (rotation at 25 / 50 / 75% progress, plus the initial state); fewer or more shifts the rotation pacing.

2. **"Lately" copy thresholds.** Age-bucket boundaries (7d, 30d, 90d) are first guesses. Tune against owner's actual activity rhythm. Worst case the page reads slightly off for a window before being corrected.

3. **Conclusion editorial copy.** Single static line, or owner edits in `landing-config.ts` between deploys? Static for MVP; revisit if owner wants it living.

4. **Off-meta visibility boost magnitude.** Score × 1.5 is a guess. May need × 2 or × 3 if Ahri-routine signal swamps it. Tunable in `useChapters`.

5. **Chronotype scope.** Original A-6 planned it as full-width. With chapter chronotype now in conclusion, does it stay full-width or become a half-width / chip-strip closer? Visual review during R-5.

6. **Chapter-to-chapter crossfade window.** ~30% viewport scroll between pin-end of A and pin-start of B is a guess. Eyeball during R-3.

7. **Trailer source.** Steam's `movies[]` field (store API) vs the existing microtrailer pipeline used in game-detail. Probably reuse pipeline. Settled during R-10.

8. **Reduced-motion / Safari path UX.** Static stack of editorial cards is the plan, but worth eyeballing on real Safari before committing — the visual loss vs full path may be steep enough to warrant a middle ground (e.g. discrete-state transitions without scroll coupling).

9. **R-13 pin distance per beat.** Starting guess: 60dvh of scroll per beat (so a 4-beat chapter is `4 × 0.6 × 100dvh = 240dvh` outer height, pinned across 240dvh of scroll). 100dvh per beat felt like a scroll-trap on paper — Apple's product pages skew closer to 50–70dvh per beat to feel like swipe pacing. 60dvh per beat keeps a 4-beat chapter inside `~2.4×` viewport scroll, comparable to two of the current single-pin chapters. Tunable per chapter via a `beatViewports` knob on `ChapterContainer`. Eyeball during the R-13 Steam build before settling.

10. **R-13 stats picked to fill beat 3 — Steam.** Average achievement rarity, time-to-100% percentile, achievements-remaining ladder, playtime trend are the starting set. We may discover one or two read as filler under real data and want to swap. Confirmed during R-13.

11. **Beat-crossfade vs slide.** Crossfade (fade + small translate) is the starting choice — matches the prior chapter-to-chapter crossfade vocabulary. A horizontal slide reads as a carousel, which would clash with the editorial framing. Settled during R-13 build.

---

## Cross-references

- [atmosphere-arc.md](atmosphere-arc.md) — substrate (A-1 / A-2 / A-2a shipped; A-3+ superseded by this arc).
- [landing-showcase-arc.md](landing-showcase-arc.md) — original interim arc where D4-2 stripped the band; resolved by this arc.
- [motion-choreography-arc.md](motion-choreography-arc.md) — entrance vocabulary every chapter inherits.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — engine-gate precedent for ADR-4.
- [microtrailer-hover-preview.md](microtrailer-hover-preview.md) — trailer pipeline to reuse for R-10.
- [steam-api-unused-data.md](steam-api-unused-data.md) — Steam fields not yet surfaced (playtime sessions, top% rankings) that chapter content can draw on.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — broader self-portrait framing this arc operationalises.
- [elevation-arcs.md](elevation-arcs.md) — needs index update referencing this arc.
- [command-palette.md](command-palette.md) — possible follow-up: "jump to chapter" deep-links from the palette.
