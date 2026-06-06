# Self-portrait recap arc

**Status:** Active 2026-06-01. Page-shape arc (R-1→R-15) substantially shipped 2026-06-07; remaining open work is **R-10** (Steam beat-4 trailer slot promotion). R-11 (reduced-motion + Safari engine-gate) verified 2026-06-07; R-7i Lane A's first detector (`FAVORITE_CHAMPION_OF_PERIOD`) shipped 2026-06-07. Supersedes [atmosphere-arc.md](atmosphere-arc.md) A-3 onward (A-1 / A-2 / A-2a remain as the shipped substrate). Builds on top of [motion-choreography-arc.md](motion-choreography-arc.md) for entrance vocabulary. Resolves [landing-showcase-arc.md](landing-showcase-arc.md) D4-2's stripped-image interim state by re-introducing recognizable imagery via the substrate-supported claim system, but inside an editorial framing the original D4-2 lacked.

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

**New.** Original brainstorm mentioned teaser trailers as a chapter visual element. Video adds real weight (5–15 MB per chapter, autoplay policies, reduced-motion respect, mobile/data, a11y). MVP uses screenshots only (Steam's `screenshots[]` field — cheap, already API-available, no autoplay complexity). One Steam chapter type promotes to "screenshots + optional trailer" as a follow-up beat after the rest of the page is solid. Doing it earlier means a third of arc budget tuning video. **Follow-up substrate:** the MVP shape now lives in R-13 chunk 2's `SteamChapterCloserMedia` slot; R-10 promotes the slot in place rather than touching beat-4 JSX.

### ADR-6: Hard-coded curation, not admin UI

**New.** [`landing-config.ts`](../../apps/web/src/home/landing-config.ts) is a committed source file. Owner edits it by hand. Admin UI is a tempting product idea but adds non-trivial complexity (auth, write surface, deploy/cache invalidation). Edit-by-hand stays cheap for a single-user portfolio; promote later only if friction is real.

---

## Chunk plan (MVP-first)

Substrate (A-1 / A-2 / A-2a) already shipped from atmosphere arc — chapters build on it.

**R-1. Chapter scaffolding primitives.** Create [`apps/web/src/home/recap/`](../../apps/web/src/home/recap/) directory. Build `ChapterContainer` (sticky-pin wrapper with scroll-progress context), `ChapterOpener` / `ChapterDetail` / `ChapterStats` / `ChapterCloser` band primitives, `useChapterProgress` hook (scroll progress through the pin window). Asset-claim variant of `useAtmosphereClaim` that carries `image` + per-claim blur. Tests for each primitive (claim registration, progress hook math, reduced-motion collapse). **No visible UI yet** — pure scaffolding.

**R-2. Ahri subject chapter (hardcoded data). ✅ SHIPPED 2026-06-01.** First end-to-end chapter. Hardcoded skin list, server-side recap deriver (365d window) replacing the early client-side filter, four-band layout in one pinned viewport, splash-rotation beat with blur-bloom transition, editorial verdict prose with structured segments, signature game receipt as a bare editorial block, enriched recent-matches strip with role icons + filtered opponent names, peak chips with count-up cascade, paint-order outline on accent text. **Design vocabulary crystallized in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md) — every R-2 polish iteration is one bullet there. Read that spec before R-3 to skip re-discovery.**

**R-3. Steam subject chapter (hardcoded appid).** Second chapter type, hardcoded to a known appid (e.g. latest-unlock game). Pulls game hero image, unlocks, playtime. Screenshots rotator (trailer deferred per ADR-5). **Two chapters visible; eyeball the chapter-to-chapter crossfade. Pre-flight checklist + per-subject hooks table both in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md).**

**R-4. `useChapters()` selection logic. ✅ SHIPPED 2026-06-02.** Scoring function (true-half-life decay, HALF_LIFE=14d), floor threshold, per-kind caps (K=3 Steam subjects). Discriminated `ChapterDescriptor = steam-subject | lol-moment | steam-moment` so R-6 / R-7 are additive. API at `apps/api/src/recap/` (parallel reads of `getOwnedGames()` + `steamPlayerUnlock.groupBy`), web hook at `apps/web/src/home/recap/use-chapters.ts` mirroring `useSteamGameRecap`'s 30-min staleTime. `landing-config.ts` curation overlay (`HIDDEN_APPIDS`, `PINNED_CHAPTER`, `CHAPTER_COPY_OVERRIDES`) layered client-side so the API stays a pure ranker. Ahri anchor kept hardcoded above the algorithmic list per owner's on-brand framing. Tests cover scoring, cap, floor, hidden-appid filter, freshest-signal precedence, pin/override helpers. Lands in three commits: `f804c34f` (api + scoring), `3a5078d2` (hook + overrides), `db4a7941` (steam-chapter prop + index swap). **Page is now data-driven.**

**R-5. Conclusion refactor. ✅ SHIPPED 2026-06-02.** Bento retired. Conclusion lives at [`apps/web/src/home/conclusion/`](../../apps/web/src/home/conclusion/) — `ConclusionRhythmBand` absorbs `TileChronotype` + `TileDaySplit` + `TileSessionLengths` into one chromed band with three sub-strips ("When" / "Where" / "How long"); `LifetimeTotalsStrip` absorbs `TileWeeklyTotals` as a chip row (the spec called for alltime aggregates — those need a dedicated `/home/lifetime-totals` endpoint and landed as a follow-up so R-5 didn't fork into API work; current strip surfaces the existing weekly window honestly framed); `EditorialCloser` is the page's pause ("That's the picture. Built with React 19, NestJS, Postgres, and far too many Ahri games."); `ConclusionFooterChips` absorbs `TileBuildBadge` + `TileDomainAge` into an inline marginalia strip. Atmosphere fades back to painterly via a second `<AmbientHero>` palette claim scoped to the conclusion ref — proximity weighting picks it over distant chapter claims once the user scrolls past the last chapter. All 8 retired tile files + `BentoGrid` deleted; `useHome*` data hooks stay (now consumed by the rhythm band / totals strip). **Page has its ending.**

**R-6. First moment chapter — `OFF_META_PICK`. ✅ SHIPPED 2026-06-02.** Detector at `apps/api/src/recap/lol-moments.service.ts` — main-pool top-5 over 90d (groupBy `champion`), then `findFirst` outside that pool within the 30d candidate window, owner-filtered via `IdentityService.getOwnerPuuids()`. Returns ≤1 candidate per call (`OFF_META_PICK`), flagged `offMeta: true` so the selector applies `RECAP_OFF_META_BOOST`. Merged into `RecapSubjectsService.getChapters()` via `Promise.all([collectSteamSubjectCandidates, lolMoments.detectAll])` → single `selectChapters` pass; per-kind caps + cross-kind ordering handle the rest. Web chapter at `apps/web/src/home/recap/lol-moment-chapter.tsx` ships the silhouette-dissolve signature beat: anchor splash (Ahri) → off-meta champion splash via `useState` swap after `useChapterNudge` + 800ms hold; atmosphere layer handles the visual transition between image URLs. Renders an `Off-meta pick · {daysSince}` eyebrow + champion masthead-as-link + "stepped off Ahri for a one-off run on {X}" prose. R-7 generalises to RANK_UP / KDA_OUTLIER / STREAK / RETURN_FROM_HIATUS / MARATHON using this chapter as the structural template. Specs: `lol-moments.service.spec.ts` (no puuids / no main pool / all-in-pool / valid pick / top-5 slice / clock skew) + `lol-moment-chapter.test.tsx` (eyebrow + masthead + when-line + link gating + anchor-first claim + slug attrs + preload + daysSince formatting boundaries).

**R-7. Moment chapter expansion.** Add `RANK_UP`, `MARATHON_SESSION`, `KDA_OUTLIER`, `STREAK_5W` / `STREAK_5L`, `RETURN_FROM_HIATUS`, `ACHIEVEMENT_CLUSTER`, `FIRST_TIME_GAME` detectors + signature beats. Each its own commit or pair of commits; not all need landing simultaneously.

- **R-7a. `RANK_UP` — ✅ SHIPPED 2026-06-02.** Detector at `LolMomentsService.detectRankUps()` scans up to 80 recent ranked matches (newest-first) within the 30d window where both the before- and after-snapshot columns are populated. Picks the first match crossing a tier-or-division boundary in the up direction (LP-only gains don't qualify — chapter framing needs "you climbed", not "+12 LP"). Magnitude: tier-string change → `RANK_UP_TIER_SIGNAL = 35`; division-only change → `RANK_UP_DIVISION_SIGNAL = 22` — both clear the score floor at the 14d half-life, both decay below it past ~35d. Returns ≤1 candidate per call (most recent climb), carries `matchStats` + new `rankUp: { fromTier, fromRank, fromLp, toTier, toRank, toLp }`. `LolMomentChapter` branches on `momentType` via a `momentCopy()` helper — RANK_UP renders "Rank up" eyebrow, destination `formatRankTitle(toTier, toRank)` masthead (apex tiers omit division, e.g. "Master"), "Climbed from {fromTitle} to {toTitle}, championed by {champion}" prose. `LolRankUpDelta` + `formatRankTitle()` (no-LP variant) added to `@vyoh/shared`. Specs added: detector cases (no puuids / no rows / LP-only / demotion / division-up / tier-up / freshest-qualifier-when-newer-is-LP-only / ranked-queue+snapshot filter) + chapter cases (RANK_UP eyebrow + destination masthead + climbed-from prose + apex-tier formatting + chapter-label data attr + null-rankUp fallback). **Emblem polish:** the RANK_UP masthead leads with the destination-tier emblem (80px, sm:96px, decorative `alt=""`) inline-paired with the headline via an inner `items-center` flex; the outer Link stays `items-baseline` so the trailing "open →" hover chip still aligns to the H2 text baseline. `momentCopy()` grew a `leadingVisual: ReactNode | null` slot that other momentTypes can populate (KDA_OUTLIER → trophy-style accent, STREAK → W/L pip row, etc.).
- **R-7b. `KDA_OUTLIER` — ✅ SHIPPED 2026-06-03.** Detector at `LolMomentsService.detectKdaOutliers()` reads all ranked matches in the 90d window, computes the owner's mean KDA as the baseline, then picks the HIGHEST-KDA match (not the most recent) that clears BOTH `≥ baseline × 1.8` (`KDA_OUTLIER_RATIO`) AND `≥ 6.0` absolute (`KDA_OUTLIER_ABSOLUTE_FLOOR`). Highest-not-most-recent because the editorial story is "this was your best game"; recency decay through `recapScore` handles freshness on top. Requires `≥ 8` baseline games (`KDA_OUTLIER_BASELINE_MIN_MATCHES`) — below that "your average" isn't a real average. Window bumped from 30d → 90d (matches the LoL profile peaks chip framing — KDA averages need more games than rank deltas to stabilise; decay still suppresses ancient peaks). `baseSignal = matchKda × 3` so a 7 KDA → ~21 raw, a 12 KDA → ~36 (clears floor at 14d, decays past ~30d for typical magnitudes). Carries new `kdaOutlier: { matchKda, baselineKda }` on the descriptor (`LolKdaOutlierStats` in `@vyoh/shared`); chapter renders "Standout game" eyebrow + champion-name masthead (performance is centerpiece, not rank) + "Posted a *X.X* KDA on *Champ* — *Y.Y×* the 90-day baseline" prose. No leadingVisual (skipped for first pass — text-only masthead reads clean). Specs added: detector cases (no puuids / below baseline floor / ratio+floor pass / ratio pass + floor fail / floor pass + ratio fail / highest-not-most-recent / ranked-queue filter) + chapter cases (Standout eyebrow + champion masthead + KDA/multiplier prose / no emblem / Standout chapter-label / null-kdaOutlier fallback / baseline=0 degraded contract). **findMany mock infrastructure:** `LolMomentsService.spec.ts` `makeService` now discriminates `findMany` calls by `where.snapshotTier` presence (rank-up uses it, KDA detector doesn't) so the two detectors can be tested in the same spec without a shared-mock collision. Bonus fix: `HomeActivityIntensityService` now accepts an injectable `now` so the `steamMinutesToday` test isn't wall-clock-dependent (was flaking when run within 30min of midnight Brussels).

- **R-7h. Moment chapter visual differentiation pass.** Shipped 2026-06-03 in three independently-committable chunks:
  - **R-7h.1 — Per-momentType accent tint.** New `apps/web/src/home/recap/moment-accent.ts` exports `momentAccentClass(momentType)`. Each of the 9 momentTypes gets a tailwind `text-*-300` class (RANK_UP=amber, KDA=yellow, STREAK_5W=emerald, STREAK_5L=rose, MARATHON=orange, RETURN=violet, OFF_META=sky, FIRST_TIME=teal, CLUSTER=fuchsia). Threaded into both chapters' eyebrow + every inline `<Accent>` span (via a `className` override that replaces the default `text-foreground/95`). Atmosphere backdrop tint stays game/champion-derived — only the typographic register shifts per type, so each chapter has an at-a-glance colour signature without breaking spatial harmony.
  - **R-7h.2 — Per-momentType leadingVisual.** Every moment type now has a recognisable inline visual paired with its masthead. Lucide icons: KDA→Trophy, MARATHON→Clock, RETURN→Hourglass, FIRST_TIME→Sparkles, CLUSTER→Award (sized `size-16 sm:size-20`, accent-coloured via R-7h.1 class, matching drop-shadow). STREAK gets a custom pip row (5+ coloured dots, capped at 7 to avoid layout blow-up — the actual count still appears in the prose). RANK_UP keeps its destination-tier emblem from R-7a. OFF_META_PICK has no leadingVisual (the off-meta champion's splash IS the visual departure). Steam chapter masthead JSX was updated to mirror the LoL chapter's `<span className="items-center gap-x-4">{leadingVisual}{H2}</span>` pattern.
  - **R-7h.3 — Per-momentType receipt shape.** Sequence/standout types now lead their receipt strip with the type's load-bearing number (count, gap, KDA) instead of the bare W/L+K/D/A strip designed for single-match moments. New `headlineReceipt({ value, label, accentClass, substats })` helper drives KDA_OUTLIER (`13.0 KDA · 5.2× baseline`), STREAK (`5 in a row · W · 7/4/11`), MARATHON (`7 games across 4.5h · W · 7/4/11`), RETURN (`Three months quiet · W · 7/4/11`). RANK_UP + OFF_META_PICK keep the default `matchStatsReceipt` (W/L pill + K/D/A + duration) — single-match moments where the per-game perf IS the receipt. Receipt JSX is now built inside `momentCopy()` rather than inline in the chapter render, so per-type customization stays declarative. `matchStats` threaded into `momentCopy()` args; new `matchStatsSubstat()` helper builds the compact `W · 7/4/11` substat shared by sequence-shaped receipts. Specs added: each per-type receipt + matchStats-null fallback for both default-shape and custom-shape types.

- **R-7h-original. Moment chapter visual differentiation pass.** Lands AFTER R-7f/g so it covers the full moment-type set (LoL + Steam) at once. Surfaced during R-7e visual review: the five LoL moment types currently differ only in eyebrow text + a one-line prose variation — champion masthead, full-bleed splash, and W/L+KDA stat strip are identical across all types, so the chapters read "samey" despite carrying different framings. The `leadingVisual` slot exists (RANK_UP uses it for the tier emblem) but the other four types render `null`. Three levers to apply across all momentTypes (LoL + Steam):
  1. **Populate `leadingVisual` per type.** STREAK → row of 5 W/L pip dots, MARATHON → clock/session-stack glyph, RETURN_FROM_HIATUS → hourglass or "X days" badge, KDA_OUTLIER → large multiplier glyph or trophy, ACHIEVEMENT_CLUSTER → mini-grid of unlock icons, FIRST_TIME_GAME → "new" sigil or first-play timestamp. Each gives the chapter an at-a-glance silhouette before the prose lands.
  2. **Per-type stat strip.** Current W/L+KDA strip is shaped for single-match moments (OFF_META, RANK_UP, KDA, FIRST_TIME_GAME); wrong-shape for sequence moments. STREAK → pip row (5 colored dots showing W/L sequence), MARATHON → match count + session span + winrate, RETURN_FROM_HIATUS → "X days quiet" + first-back KDA, ACHIEVEMENT_CLUSTER → list of unlocks with timestamps.
  3. **Per-type accent tint.** `--accent` could shift by momentType — Hot streak gold, Cold streak rose, Marathon amber, Return violet — without new components, just a color override on the `Accent` span. Lowest-cost differentiator; consider whether it's worth doing without (1) and (2) since accent alone may not move the needle vs full visual identity.

  Single batch is the right shape — designing differentiation piecemeal as each chunk landed would have produced inconsistent visual vocabulary across types. Steam-moment chapter types (R-7f/g) get folded into the same pass so the LoL/Steam moment visual language is unified.

- **R-7g. `ACHIEVEMENT_CLUSTER` — ✅ SHIPPED 2026-06-03.** Second Steam-moment chapter; closes the steam-moment momentType union (FIRST_TIME_GAME + ACHIEVEMENT_CLUSTER both shipping). Detector at `SteamMomentsService.detectAchievementClusters()` reads all `SteamPlayerUnlock` rows in the 30d window joined with `SteamGameAchievement.displayName` + `SteamOwnedGame.{name,removedAt}` for a single round-trip, then walks a sliding 24h window per appid. The densest qualifying window (≥ `CLUSTER_MIN_UNLOCKS = 5`) becomes the cluster; ties prefer the LATER cap (recency tiebreak). Filters: non-game `appType` + curated hidden appids + refunded games (`removedAt !== null` — the achievements survive in DB for historical accuracy but the moment shouldn't surface). `baseSignal = min(unlockCount, 10) × 4` → 5-cluster ≈ 20 raw (clears floor at 14d half-life), 10+-cluster caps at 40. Descriptor extended with `cluster: { unlockCount, spanHours, capUnlockedAt, unlockNames }` (`SteamAchievementClusterStats` in `@vyoh/shared`); `unlockNames` capped at 5 names with the chapter rendering "and N more" beyond. `SteamMomentChapter` `momentCopy()` branches on `spanHours`: ≤2h → "back-to-back in 90m", 2–8h → "made an afternoon of it", >8h → "binged it across the day". The cluster receipt block sits below the firstTime block in the same ChapterDetail — different momentType, different receipt shape, neither block renders when its stats are null. R-7h polish will replace the unlock-name list with an icon-grid leadingVisual. **Mock infrastructure:** detector spec added an `unlockAt()` helper that builds joined unlock rows by relative `hoursBefore NOW`, lets specs declare clusters by time offsets without ISO bookkeeping. Specs added: detector cases (empty / below-threshold / ≥5 in 24h valid / outliers excluded / unlock-names cap / non-game appType / refunded game / equal-window recency tiebreak / per-appid independence / detectAll fan-in) + chapter cases (cluster eyebrow + masthead / receipt count+span+names / "and N more" overflow / 3 span-prose branches / null fallback / chapter-label data attr).

- **R-7f. `FIRST_TIME_GAME` — ✅ SHIPPED 2026-06-03.** First Steam-moment chapter; opens the steam-moment block on `/` that was previously empty (descriptor union had the kind reserved but `routes/index.tsx` rendered `null`). New service at `apps/api/src/recap/steam-moments.service.ts` mirroring `LolMomentsService` shape (`detectAll(now)` + per-momentType detectors). `detectFirstTimeGames()` reads `SteamOwnedGame` where `firstSeenAt >= now - 30d` and `removedAt: null`, filters non-games via `SteamGameEnrichment.appType` (skip `appType !== null && !== 0`) + the curated hidden-appid list, and excludes "bootstrap days" — UTC-day buckets of `firstSeenAt` carrying ≥4 rows are flagged as the owned-games sync's first observation, not editorial first-times. Survivors must accumulate ≥ `FIRST_TIME_MIN_PLAY_MINUTES = 30` of `SteamPlaySession` duration starting at-or-after `firstSeenAt` (sessions without `endedAt` and sessions predating `firstSeenAt` are dropped). `baseSignal = windowPlayMinutes / 15` → a 2h first session at daysSince=0 lands score=8 (above floor=5), 6h at daysSince=7 lands ≈ 12.7 — first-times outpace dormant subjects without dominating RANK_UP. Descriptor extended with `name` (carried inline so the chapter skips a `useSteamGameRecap` roundtrip) and `firstTime: { windowPlayMinutes }` (`SteamFirstTimeStats` in `@vyoh/shared`). `RecapSubjectsService` gained the third feed-source: `Promise.all([steamSubjects, lolMoments.detectAll, steamMoments.detectAll])` → `selectChapters` handles per-kind cap + cross-kind ordering. New `apps/web/src/home/recap/steam-moment-chapter.tsx` mirrors `lol-moment-chapter` structural template — `momentCopy()` branches on momentType (FIRST_TIME_GAME implemented; ACHIEVEMENT_CLUSTER placeholder until R-7g), `steamLibraryHeroLargeUrl(appid)` provides the atmosphere claim, masthead links to `/steam/game/$appid`, single-stat receipt shows `formatPlaytime(windowPlayMinutes) + "in the books"`. R-7h polish pass will populate per-type leadingVisual/stat strip/accent across both LoL + Steam moments. Specs added: detector cases (empty window / 30m+ play valid / brief-launch floor / non-game appType filter / bootstrap-day exclusion / pre-firstSeenAt session drop / null-endedAt drop / detectAll aggregation) + chapter cases (eyebrow + masthead + when-line + Steam-game link / hero preload / atmosphere claim / slug+label data attrs / firstTime-null receipt omission / ACHIEVEMENT_CLUSTER placeholder eyebrow) + `RecapSubjectsService` cross-kind merge spec covering steam-moment fan-in.

- **R-7e. `MARATHON` — ✅ SHIPPED 2026-06-03.** Detector at `LolMomentsService.detectMarathons()` reads all owner ranked matches in the 30d window ASC by playedAt, then walks a 12h sliding window across consecutive matches. Any cluster of ≥ 6 matches inside the 12h span qualifies as a marathon session; ties prefer the most-recent end (cap match) with larger count as secondary tiebreaker. The cap match's champion drives the splash; spanHours is the elapsed wall-clock span from first to last (rounded to 1 decimal). `baseSignal = min(matchCount, 15) × 2` → 6-marathon ≈ 12 raw, 10 ≈ 20, 15+ → 30 max (modest by design — marathons are notable but shouldn't dominate over rank-ups or KDA peaks). Carries new `marathon: { matchCount, spanHours }` on the descriptor (`LolMarathonStats` in `@vyoh/shared`); chapter renders "Marathon" eyebrow + champion-name masthead + "*N* ranked games in one sitting, capped on *Champ*" prose. No leadingVisual. **Mock discriminator gained a fourth axis:** marathon uses `orderBy.playedAt: "asc"` (vs KDA's desc) so the spec mock cleanly routes between them. Five detectors now share one `findMany` mock with no overlapping where-shape collisions. Specs added: detector cases (no puuids / fewer than minimum count / span too wide / 6-in-window valid / most-recent-of-multiple / count-cap / orderBy-asc-discriminator+ranked-queue filter) + chapter cases (Marathon eyebrow + 'games in one sitting' prose / chapter-label data attr / null fallback).

- **R-7d. `STREAK_5W` / `STREAK_5L` — ✅ SHIPPED 2026-06-03.** Detector at `LolMomentsService.detectStreaks()` reads the top `STREAK_SCAN_LIMIT = 20` ranked matches DESC by playedAt, requires the head match to be within 30d (`STREAK_WINDOW_DAYS` — old streaks aren't current news), then walks forward counting consecutive same-result games until the first opposite-result. If length ≥ 5 (`STREAK_MIN_LENGTH` — Riot's own hot-streak threshold), emits one candidate as either `STREAK_5W` or `STREAK_5L` depending on the head match's `win` value. `baseSignal = min(length, 15) × 3` → 5-streak ≈ 15 raw, 8-streak ≈ 24, 15+ → 45 max. Carries new `streak: { result, length }` on the descriptor (`LolStreakStats` in `@vyoh/shared`); chapter renders "Hot streak" or "Cold streak" eyebrow + champion-name masthead (the head match's champion as the visual anchor) + "*N* ranked wins in a row, last on *Champ*" / "*N* ranked losses straight, last on *Champ*" prose. No leadingVisual. **Mock infrastructure:** `findMany` discriminator gained a third branch — `take` presence routes to `streakRows` (KDA + hiatus don't pass `take`). Specs added: detector cases (no puuids / fewer than minimum / head-run-too-short / head-out-of-window / 5W head / 5L head / longer-run-counted / cap-at-length / take-discriminator+ranked-queue filter) + chapter cases (hot eyebrow + wins prose / cold eyebrow + losses prose / both chapter-label data attrs / null fallback).

- **R-7c. `RETURN_FROM_HIATUS` — ✅ SHIPPED 2026-06-03.** Detector at `LolMomentsService.detectReturnsFromHiatus()` reads ALL owner ranked matches (ASC by playedAt), walks consecutive pairs, and surfaces the most-recent match where the gap to the previous owner ranked game is ≥ 14d (`HIATUS_THRESHOLD_DAYS`) AND the return match falls within 30d of now (`HIATUS_RETURN_WINDOW_DAYS`). Editorial framing: "X days/weeks/months away, then back on Champ" — the gap *length* is the magnitude, not the recency of the break itself. `baseSignal = min(gapDays, 90) × 0.4`: a 14d break → 5.6 raw (marginal at floor), 30d → 12, 60d → 24, 90d+ → 36 capped. Beyond 90d the story is "you came back from dormancy" regardless of exact duration. Carries new `hiatusReturn: { gapDays }` on the descriptor (`LolHiatusReturnStats` in `@vyoh/shared`); chapter renders "Return" eyebrow + champion-name masthead + "*N weeks/months* away from ranked, then back on *Champ*" prose via a new `formatHiatusGap()` helper (14–29d → "N weeks", 30–59 → "A month", 60+ → "N months"). No leadingVisual. Specs added: detector cases (no puuids / no qualifying gap / return out-of-window / threshold+window pass / 90d cap / freshest-of-multiple-hiatuses / single-match-no-prev / ranked-queue filter) + chapter cases (Return eyebrow + champion masthead + gap-away prose / each gap-format boundary / chapter-label / null fallback). **`findMany` mock evolution:** the spec's `makeService` now discriminates three call shapes — rank-up (has `where.snapshotTier`), KDA (no snapshotTier but has `where.playedAt`), hiatus (neither) — so all three detectors test cleanly against shared infrastructure.

- **R-7i. LoL dry-spell top-up — Lane A first detector SHIPPED 2026-06-07.** R-7b.1 parked the symmetric question ("should LoL have a top-up?") on the bet that more detectors would fill the LoL slot probabilistically. Six detectors later (RANK_UP, KDA_OUTLIER, RETURN_FROM_HIATUS, STREAK_5W/5L, MARATHON, OFF_META_PICK) that bet has empirically not converged for a 30-day dry spell. Owner unparked.
  - **Lane A — additional detectors that don't require recent excitement.** Lower-magnitude `baseSignal` than rank/KDA outliers — these are "filler" tier by design, decay below floor at first sign of a real moment. Categorically still moments, no architectural change.
    - **`FAVORITE_CHAMPION_OF_PERIOD`. ✅ SHIPPED 2026-06-07.** First Lane A detector. `LolMomentsService.detectFavoriteChampions(now)` groups owner ranked matches in the 30d window by `champion` + `win` in a single `groupBy` read (gives wins/losses split per champion in one round-trip). Sorts desc by game count, excludes `FAVORITE_ANCHOR_CHAMPION = "Ahri"` (the unconditional subject chapter — duplicating it would be redundant framing), and emits one candidate for the top eligible champion when it has ≥ `FAVORITE_MIN_GAMES = 5` games. When Ahri tops the period the detector picks #2 — chapter framing becomes "side-project of the month, outside Ahri"; when no eligible champion clears 5 games the detector emits nothing. `baseSignal = FAVORITE_BASE_SIGNAL = 10` (constant) — calibrated to clear the score floor for ~14d after the most recent overall ranked match, then decay below floor. `daysSince` anchors on the OVERALL most-recent ranked match in the window (not just on the favorite's last game) so the "this month" framing tracks page-level activity recency. Receipt anchors on the highest-KDA match on the favorite champion in the window — gives the chapter a concrete "best game of the month" matchId + matchStats. Descriptor extended with `favoriteChampion: { gameCount, winCount, lossCount, championAlias }` (`LolFavoriteChampionStats` in `@vyoh/shared`); chapter renders "Side-project" eyebrow + champion-name masthead + "Outside of Ahri, *Champ* took *N games* this month — *W-L*" prose. Headline receipt leads with the gameCount lede (aggregate framing) + W/L substat; the match-stats default receipt is skipped because aggregate-framed chapters read odd with a "best game's K/D/A" receipt — the matchId carries that click-through on its own. Lime accent (`text-lime-300`) sits alongside OFF_META_PICK's sky in the "side-step from the OTP" register so the two read as related but distinct in the chapter list. Specs added: detector cases (no puuids / no rows / Ahri-excluded with #2 picked / below-minimum-games dropped / no-Ahri-play path / daysSince anchored on overall most recent / highest-KDA receipt anchor / empty most-recent / ranked-queue+remake filter) + chapter cases (Side-project eyebrow + champion masthead + outside-of-anchor prose / gameCount lede + W/L substat / null-favoriteChampion fallback to OFF_META default).
    - Remaining Lane A detectors (`LANE_SHIFT`, `MASTERY_TIER_UP`, `PEAK_RANK_OF_PERIOD`) parked behind measurement — if the dry spell still surfaces with FAVORITE alone, the additional shapes get built; if not, leaving them un-implemented keeps the chapter list legible (more detector kinds = more eyebrows competing).
  - **Lane B — explicit dormant top-up source, analogous to `collectDormantTopUp`.** Still parked. When active LoL moment count < cap, pull from a fallback pool. Candidates for the pool: cached lifetime-peak ranked snapshot (framed retrospectively — "You climbed to Plat IV last season"); long-tail champion mastery milestones older than 30d; the head row of a `lol-season` aggregate descriptor narrowed to a single editorial framing per call. Original park rejected aggregate `lol-season`-shaped descriptors as a category mismatch — un-park-able if the chapter framing carries clearly retrospective register ("Looking back —") so the reader doesn't expect recent-moment energy. Re-evaluate after FAVORITE has been live long enough to observe whether Lane A's fill rate is sufficient on real activity patterns.

- **R-7b.1. Recap ordering + dormant top-up — ✅ SHIPPED 2026-06-03.** Two cross-cutting tweaks landed after R-7b's first review surfaced the "Standout sits between RE4 and (future) Steam moments" awkwardness and the "RE3/Pragmata/RE2 fall out of the page" dry-spell problem. **(1)** Cross-kind order in `selectChapters` flipped from `steam-subject → lol-moment → steam-moment` to `lol-moment → steam-subject → steam-moment` — now the page reads Ahri-anchor → LoL block → Steam block → conclusion with one platform jump instead of Steam → LoL → Steam thrashing. **(2)** Per-kind caps bumped: `steamSubjectCap` 3 → 5, `lolMomentCap` 3 → 5, `steamMomentCap` 2 → 3 (page felt thin at 4–5 total chapters). **(3)** Dormant fallback promoted from "fires only when active is empty" to "always tops up remaining Steam slots": `RecapSubjectsService.getChapters` now counts active steam-subjects, computes slack against `STEAM_SUBJECT_HARD_CAP = 5`, and pulls dormant lifetime-ranked rows (5h floor) into the trailing slots, excluding appids already in the active block. Active rows still sit first inside the Steam block ("Playing lately on RE4"); dormant rows trail ("Earlier this year on RE3"). Same descriptor kind, daysSince-bucket eyebrows on the web side carry the editorial register split. The asymmetric concern ("should LoL have a similar top-up?") is parked at the end of R-7 — for now the answer is "let more detectors do the filling"; aggregate "lol-season"-shaped descriptors would be a category mismatch with the moment slot. `collectDormantFallback` renamed to `collectDormantTopUp(now, take, excludeAppids)`; `DORMANT_CAP` constant removed (replaced by the dynamic `take` parameter). Tests updated: `dormant fallback` describe block renamed to `dormant top-up`, two existing tests rewritten to reflect always-on behavior, two new tests added (top-up trailing position, appid-exclusion).

**R-8. Caret-clicks-advance-by-chapter. ✅ SHIPPED 2026-06-02.** `NextChapterCaret` discovers chapters via `[data-recap-chapter]` DOM scan (no provider registry needed — scroll/resize/MutationObserver re-computes), click scrolls to next chapter's outer-top, dead-zone (`SKIP_PAST_PX = 80`) skips the current chapter when sitting inside its pin. **End-of-page "back to top" flip rejected** — the global `<ScrollToTop />` (mounted in [routes/\_\_root.tsx](../../../apps/web/src/routes/__root.tsx), bottom-right corner, fires above `scrollTop > 500px`) already covers the return-to-hero intent. A second back-to-top control at bottom-center would duplicate it and blur the caret's editorial role of advancing the reader through chapters; landed the flip in `a8d12aea`, reverted in the next commit after side-by-side review against the existing ScrollToTop affordance. Pin-end advance within a chapter is deferred to R-13 — there are no internal beats to advance through until the multi-beat retrofit lands. Commit: `43fee803` (chapter-snap CSS substrate).

**R-9. Asset preloading. ✅ SHIPPED 2026-06-02.** Two-tier preload: `<link rel="preload" as="image">` injection for critical-path chapter assets (Ahri base splash + first algorithmic Steam chapter's hero), `useAssetPreload` hook gates non-critical chapter assets behind IntersectionObserver `rootMargin: 50%` so they only fetch when the chapter approaches viewport. Replaces the prior unconditional `new Image()` preloads in `ahri-chapter.tsx` and `steam-chapter.tsx` that competed with critical-path resources during initial page load. Steam chapter accepts a `priority: "critical" | "lazy"` prop; `routes/index.tsx` passes `"critical"` to the first chapter in the algorithmic stream. Helpers and tests in `apps/web/src/home/recap/preload-link.{ts,test.ts}` and `use-asset-preload.{ts,test.tsx}` (`<link>` injection is idempotent + cleanup-aware; hook has SSR/no-IO fallback).

**R-10. Trailer polish (ADR-5 promotion).** One Steam chapter shape gets an optional trailer in the closer band — landing in **beat 4** of the multi-beat layout (R-13). Autoplay keys on `useBeatIndex` going active for beat 4, not on pin-enter; pin-enter fires while the title is still being read, beat-active is the correct lifecycle. Pauses when the user scrubs past or back. Trailer renders via the `SteamChapterCloserMedia` slot introduced in R-13 chunk 2 (screenshots-only today, screenshots-or-trailer when R-10 lands), so R-10 swaps the slot's content rather than touching beat-4 JSX. Mute by default, reduced-motion-respecting, mobile-data-aware (Save-Data header + `connection.effectiveType`).

**R-11. Reduced-motion + Safari engine-gate. ✅ VERIFIED 2026-06-07.** The static chapter rendering path landed organically during R-13 / R-14 build (rather than as a separate chunk): `ChapterMultiBeat` collapses to a vertical stack of beats with no sticky stage, no horizontal track, no editorial chrome when `useReducedMotion()` returns true; `useSkinRotation` gates the rotation timer on the same hook; `BeatAccentSlash` renders at static end-state via Motion's auto-collapse under the global `MotionConfig reducedMotion="user"` setting in [main.tsx](../../../apps/web/src/main.tsx). Audit confirmed by cross-engine probe (Chromium + Firefox) at [scripts/probe-reduced-motion.mjs](../../../scripts/probe-reduced-motion.mjs) — every multi-beat chapter on `/` (Ahri + 4 Steam subjects + Conclusion = 6 chapters, ≥20 beats) renders all beats at full opacity with content under `reducedMotion: reduce`, structural primitives correctly absent. **WebKit verification** is owner-side (devcontainer's headless WebKit binary lacks libgstreamer/libgtk-4 system libs); follows the [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) precedent of owner-confirmed engine behavior. No code changes shipped under R-11 — the contract was already in place; this chunk was verification only.

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
- **Exit-dissolve research + spike plans.** See [r13-exit-dissolve.md](./r13-exit-dissolve.md). Three lanes evaluated (pure CSS `animation-timeline: view()` / Motion `useScroll` with `target`+`offset` / sticky restructure); recommendation is Motion `useScroll` because it auto-selects ScrollTimeline on Chrome/Safari with rAF fallback on Firefox (owner's primary review browser). Includes root-cause writeup of the prior thrashing arc (reverted in `4d4b83cc`) — the fix is to read scroll progress on the compositor thread, never via `getBoundingClientRect`.

- **Exit-dissolve — SHIPPED 2026-06-04 (IntersectionObserver-triggered fade).** After three failed scroll-coupled approaches (counter-translate via Motion `useScroll`, sticky-based CSS `animation-timeline: view()`, hybrid engine-gated variants), landed on the architecturally simplest pattern: each beat watches its own intersection via Motion `useInView`, and when the beat scrolls out (intersection drops below 50%), a Motion `animate()` call drives opacity/blur/scale to the exit state over 400ms. Reverses on re-entry. That's the whole exit-dissolve — no `useScroll`, no `useTransform`, no view-timeline, no CSS animation-timeline, no sticky, no counter-translate, no engine gate. The fade runs concurrent with the browser's native scroll-snap motion; by the time snap completes, the outgoing beat is faded out and the incoming beat is in place. Visually reads as a page-turn dissolve. Tuning knobs: `FADE_DURATION` (0.4s), `FADE_AMOUNT` (0.5 IO threshold), `FADE_EASE` (easeOut). **Lessons (final):** scroll-coupling buys nothing for snap-paginated UX and costs enormous cross-engine complexity. The "in-place" perception comes from the fade timing (400ms fade vs ~300ms snap), not from literally pinning content via sticky or transform. Full audit trail in [r13-exit-dissolve.md](./r13-exit-dissolve.md) "Resolution v2".

- **Small-screen layout collision (NEW, 2026-06-04). ✅ RESOLVED.** The fix landed in R-14's stage-restructure (`0740849d`): the chapter stage became `flex flex-col` with the masthead `shrink-0` and the track `flex-1 min-h-0`, so the beat content's available height naturally subtracts the masthead's. No need for an explicit `--masthead-h` CSS var — the flex layout does the bookkeeping. Verified 2026-06-07 across viewport heights 600 / 680 / 720 / 768 / 900px via headless probe: beat content starts at masthead.bottom in every case, no overlap.

- **Outgoing→incoming reveal timing disconnect (NEW, 2026-06-04).** The exit-dissolve completes in ~80% of the snap (~120ms at 150ms snap), but the incoming beat's `ChapterReveal` is gated by `useChapterNudge` which carried `SETTLE_MS = 500` before flipping `nudged` true. Result: ~500ms gap between outgoing-fully-faded and incoming-fade-in-start, perceived as "dead air" or "discontinuity" between beats. **First probe shipped 2026-06-04**: dropped `SETTLE_MS` from 500 → 120ms so the incoming reveal overlaps with the back half of the outgoing dissolve. Test boundary in `use-chapter-nudge.test.tsx` updated. If the at-mount cascade ends up feeling rushed at the new setting (the 500ms was originally tuned for first-page-load chapter reveals), split into two constants — snap-triggered nudges keep 120ms, at-mount nudges restore something closer to 300–500ms. Options (b) trigger-from-outgoing-scrollYProgress and (c) inter-beat reveal context remain on the table if 120ms isn't enough on its own.

- **Counter-translate breaks Chrome/Safari scrolling — RESOLVED 2026-06-04** by abandoning the counter-translate architecture entirely and switching to `position: sticky` for pinning. Root cause confirmed via diagnostic console output: Chrome/Safari's `getComputedStyle` reported the expected `translateY(998px)` on the counter-translated inner div but the painted box was visually unaffected — the scroll-snap compositor silently optimized away the per-descendant transform. Sticky pinning sidesteps this entirely because sticky is layout (compositor can't optimize away). See the resolution section above; full audit trail in [r13-exit-dissolve.md](./r13-exit-dissolve.md).

**R-14. Ahri retrofit to multi-beat.** Once Steam is signed off in R-13, port Ahri to three beats:
1. Identity + verdict (current opener + verdict prose).
2. Signature game + recent matches (current detail band).
3. Peak chips + new LoL stats (top synergies, lane-phase win rate, rank trajectory).

**Background skin rotation stays exactly as is — no foreground skin treatment.** The rotation does real work as ambient texture (skins frame the chapter; Ahri is the subject), and pulling it foreground would turn aesthetic texture into demanded attention, fighting the chapter's central framing. An earlier draft of this chunk proposed a 4th "skin gallery" beat — rejected; documented in the spec doc's "Rejected experiments" section as part of R-14's landing.

**Beat counts don't have to match across chapters.** Steam earns 4 beats because it has dense achievement + stats + screenshot data competing for room. Ahri is content-leaner and reads better at 3. If a future Ahri data source genuinely justifies a 4th beat, brainstorm content first; don't reach for "skin gallery" as filler.

Likely 1-2 commits. Re-tune cascade delays inside each beat so they don't try to fire all at the prior R-2 timings against the new beat-onset moment.

**R-12. Editorial pass. ✅ SHIPPED 2026-06-04→06.** Ran as ten focused polish chunks against the shipped multi-beat model from R-13/R-14, not the transitional layout. Sub-chunks:
- **R-12.1** — align beat content reading column with chapter masthead (`d862f93b`).
- **R-12.2** — expand Ahri beat 2 with peaks caption and streak eyebrow (`9bdfc1bd`).
- **R-12.3** — Steam screenshot strip becomes filmstrip marquee with contact sheet (`5c21ea98`).
- **R-12.4** — per-beat entrance variety; retire templated slide-from-side cascade in favor of HERO-tier scale+blur entrances on signature elements and softer blur-dissolve on supporting rows (`fea7bfdb`).
- **R-12.5** — group LoL moments into multi-beat aggregator chapter, framed "Moments / where the routine cracked" (`038a7f28`).
- **R-12.6** — group Steam moments into multi-beat aggregator chapter, framed "Highlights / what stuck this season" (`b11a784e`).
- **R-12.7** — per-momentType entrance variety in aggregator beats; each moment type now has its own entrance shape (RANK_UP, OFF_META, KDA_OUTLIER, STREAK, RETURN_FROM_HIATUS, MARATHON) (`a8dd0336`).
- **R-12.8** — first-word typographic kinetic on verdict prose: hero word shrink-blurs into the prose; iterated to land 0.2s into the parent reveal so the eye sees the lead word distinctly settling (`277433ca` + `95607a04` + `2218a601`).
- **R-12.9** — accent slash re-entry pulse: slash fires brief opacity keyframes on backscroll re-entry instead of sitting at static end-state (`5fb7fc0a`).
- **R-12.10** — landing kicker line + voice-led caret labels on aggregator chapters (`4a16d501`).
- **Path B atmosphere on aggregators** — per-beat HD splash claims via `FocalBeatAtmosphereClaim`, replacing shared-chapter atmosphere; the focal beat's champion/game drives the backdrop (`5b8f08b3`).
- **Various copy + visual fixes**: negative gold lead reframed as "behind" then dropped when deficit (`e771cd10` + `c0ee6c63`), "games" replaces roguelike-flavored "runs" (`348eacaf`), atmosphere palette flash on Ahri skin rotation eliminated via two-layer image stack (`4e121476`).

**R-15. Conclusion multi-beat. ✅ SHIPPED 2026-06-05→07.** The re-eval (originally parked post-R-13/R-14) concluded the conclusion's pieces DO read as "lenses on one subject (me)" — the rhythm/trajectory/lifetime/closer arc maps to the owner as the page's final subject — so multi-beat won. Landed as five sub-chunks:
- **R-15.1** — `ConclusionChapter` becomes a 4-beat owner-as-subject chapter mirroring Ahri's at the top of the page (subject → subject → subject → SUBJECT). Beats: (0) live presence + rhythm, (1) rank trajectory + today pulse, (2) lifetime totals, (3) editorial closer + footer chips. Dual-platform identity in the masthead (LoL + Steam avatars stacked, `{owner}'s portrait · {rank} · {persona} on Steam`). Atmosphere is palette-only with explicit warm-amber accent `#f0c878`. The original two snap-aligned siblings (`conclusion-recent` + `conclusion-alltime`) retired. Sticky-unpin slide at chapter exit (caught by owner during R-15.1 review) fixed by `-mb-6` consuming the route wrapper's bottom padding (`be4a843c`, `4d484347`, `82404841`, `af64111b`, `b48f7ea9`).
- **R-15.2** — de-chrome chip-shaped conclusion strips (`LifetimeTotalsStrip`, `TodayStrip`, `NowPlayingStrip`). Drop `rounded-md border bg-card/40` chip chrome + `rounded-full border bg-card/40` pill; restyle to bare PeakChip register (text-2xl/3xl tabular-nums value + 10px uppercase tracking-[0.2em] label, SHADOW_BODY/SHADOW_LABEL). Conclusion-chapter test added covering beat partitioning, masthead identity, atmosphere claim, sticky-pin fix (`77361ee6`).
- **R-15.3** — de-chrome chart-shaped strips (`ConclusionRhythmBand`, `RankTrajectoryStrip`). Drop `rounded-lg border bg-card/50 p-4` wrappers; charts live bare against palette backdrop like Steam's `UnlocksPerWeekBand`. Headers switch `CardTitle` → `SectionTitle`. Folded into R-15.3 commit alongside the cascade work below.
- **R-15.3** (same commit) — per-beat `ChapterReveal` cascades wired through render-prop `nudged` on each beat, plus opening `BeatAccentSlash` on beat 0 (mirrors Ahri's opener slash). Beat 3 deliberately omits the closing slash because `EditorialCloser` already performs the chapter-close typographic gesture — stacking a slash would double-signal the sign-off. `edgeDwellUnits={0}` override removed (was leftover compensation for the sticky-slide bug `-mb-6` actually fixes); restored to default 3, which gives 900px of entrance buffer + 463px of exit dwell where the beat indicator stays visible past track settlement (`2d0d5956`).
- **R-15.5** (chrome gate fix) — `editorial-chrome.tsx` visibility gate's bottom check switched from `section.bottom >= main.bottom` to `stage.top >= main.top - 4`. Original gate was fragile on the conclusion: `-mb-6` makes `section.bottom` equal `main.bottom` *exactly* at maxScroll, and subpixel rounding flipped the strict comparison off for individual frames, hiding the indicator at page bottom. The stage uses `position: sticky; top: 0`, so `stage.top` tracks `main.top` exactly while pinned and drops MANY pixels when sticky disengages on a Phase-3 exit — much larger signal margin. Regression-probed across every chapter transition on both Chromium and Firefox: no overlap, no false-hide (`294ffaa0`).

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
