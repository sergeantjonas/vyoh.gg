# Page composition — section structure + container convention

**Status:** Mostly shipped 2026-05-27 — Chunks 1 (audit), 2 (top-3 surface decisions + reframed compositional rule), 4 (LoL profile header sweep, one commit), 5 (repo-conventions.md writeback) all landed in one session. Chunk 3 (side-by-side visual capture) deferred as owner-run documentation; not blocking. Secondary surfaces (LoL recap, champion-detail chrome→bare, trends grouping, Steam achievements/signature) remain on the standing backlog if/when picked up. Opened 2026-05-27 after the editorial-typography arc closed out. Three rounds of typography sweeps surfaced a structural-level inconsistency the typography arc couldn't address: pages use different IA (flat list of cards vs grouped under section dividers) and different container patterns (chrome around sections vs bare) without a shared rule. This arc decides the rules and sweeps.

## Why this arc exists

The [editorial-typography.md](editorial-typography.md) arc landed `SectionTitle` (page-zone divider, more prominent) and `CardTitle` (inside card chrome, quieter) as named primitives. The primitive choice is determined by a structural test ("does the header sit inside `rounded-lg border bg-card/…` chrome?"). That rule works only as well as the underlying layout decisions are consistent — and right now they aren't.

Two visible symptoms during typography review:

1. **Steam game-detail flat-cards vs LoL profile grouped-sections** — Steam game-detail presents all cards as flat siblings (ABOUT THIS GAME, UNLOCK TIMELINE, COMPLETION, TIMELINE, LAST PROGRESSED, SIGNATURE, RAREST UNLOCK, ACHIEVEMENTS — all at the same level). LoL profile groups its tiles under section dividers (PRE-GAME, POST-GAME, RECENT FORM each grouping ~5 cards). Same kind of information, different IA. Owner observation: Steam game-detail could use section dividers grouping the cards into conceptual zones.

2. **Match-detail chart sections sit bare on page background** — Gold lead chart, Kill & objective timeline, Lane phase, Build order, Damage profile, etc. all render as `<section>` with `SectionTitle` header + chart body directly underneath, no card chrome. Equivalent Steam surfaces (UNLOCK TIMELINE chart, ACHIEVEMENTS list) wrap header + body in `rounded-lg border bg-card/50 p-4` chrome. Same body shape, different containment.

Both symptoms are LAYOUT-level decisions, not CSS. Doing them inline mid-typography-sweep meant scope-creep into design judgment. Scoping them as their own arc means we can audit, decide rules, and sweep deliberately.

## Three questions this arc answers

These cascade — each depends on the one above:

| Question | Decision needed |
|---|---|
| **(a) Section structure / IA** | Per surface: which pages group their cards under section dividers, which present them flat? Driven by content — does the surface have conceptual zones (Overview / Achievements / etc.) that map naturally to dividers? |
| **(b) Container convention** | When does a section body get wrapped in card chrome (`rounded-lg border bg-card/…`)? Probably "chrome when body is a chart/timeline/grid, bare when body is text/sentences/chip-row" — but needs to be codified. |
| **(c) Title primitive** | Already decided by the chrome rule from the typography arc (in-chrome → CardTitle, bare → SectionTitle). This arc just makes sure the chrome rule is consistently applied after (a) and (b) settle. |

## Chunked plan

### Chunk 1 — Audit pass

Enumerate every product surface and capture:
- Current IA shape: flat list / partially grouped / fully grouped under dividers
- Current container shape: bare sections / chrome sections / mixed
- One-line "what would be more coherent" observation

Surfaces to audit:
- `/` (Home synthesis bento)
- `/lol/$accountSlug` (profile)
- `/lol/$accountSlug/matches/$matchId` — Recap / Your Game / Review / Timeline tabs
- `/lol/$accountSlug/trends`
- `/lol/$accountSlug/champions/$championKey`
- `/lol/$accountSlug/recap`
- `/steam` (profile)
- `/steam/game/$appid`
- `/steam/library`
- `/steam/wishlist`
- `/steam/achievements/*` (signature, rarest, all)
- `/status`

For each, name the conceptual zones already implicit in the content (whether or not dividers exist today). Output is a per-surface table.

### Chunk 2 — IA decisions

For each surface from Chunk 1, decide: add dividers / keep flat / remove existing dividers. Driven by:
- If the surface has clear conceptual zones with ≥2 cards per zone → add dividers
- If the surface has 1–2 cards total per zone → flat is fine
- If existing dividers don't reflect actual content groupings → remove

Owner-flagged candidates so far:
- Steam game-detail → likely "Overview" (About + Unlock timeline) / "Achievement metrics" (the 4 tiles) / "Achievement detail" (Rarest unlock + Achievements panel). Confirm zone names with content review before sweeping.

Output: per-surface decision recorded in this note's "Decisions" section (added during the chunk).

### Chunk 3 — Container convention

Decide the rule for when a section body gets wrapped in card chrome. Three candidates:

| Option | Rule | Pros / Cons |
|---|---|---|
| **All chrome** | Every section body wraps in `rounded-lg border bg-card/…` chrome | Maximally consistent; risks "every card looks the same" heaviness, especially on dense pages like LoL match-detail |
| **All bare** | No section body gets chrome; cards inside sections are themselves bordered | Lightest visual rhythm; loses the Steam-pattern containment that already reads well |
| **Body-shape rule** | Chart / timeline / grid bodies get chrome; text / sentences / chip-row bodies stay bare | Matches existing intuition (Gold lead chart deserves containment; Decision quality sentences don't); needs the rule explicit so future surfaces don't drift |

Likely outcome: option 3, but ratify with a side-by-side visual comparison on one representative surface before committing.

### Chunk 4 — Sweep per surface

One surface per commit, applying the IA + chrome decisions from chunks 2 + 3. Visual sign-off between commits. Order TBD by the per-surface plan but rough priority:

1. Steam game-detail (highest visible IA improvement)
2. LoL match-detail tabs (highest chrome impact, ~8 chart sections)
3. Home synthesis bento
4. Steam profile
5. Smaller surfaces (achievements list, status, etc.)

Tests in same commit as code per [repo-conventions.md § "New interactive surfaces get a test in the same commit"](../../repo-conventions.md). Existing tests that assert on text shouldn't break; chrome class changes don't affect text-content assertions.

### Chunk 5 — Convention update

Once the rules are decided and the sweep is complete, extend [repo-conventions.md § "Header primitives"](../../repo-conventions.md) with:
- The IA rule (when to add section dividers)
- The container rule (when section bodies get chrome)
- A short worked example for a future contributor scoping a new surface

These join the existing "pick CardTitle if header is inside chrome, else SectionTitle" guidance so the three rules form a coherent ruleset.

---

## Files in scope

This note doesn't enumerate every file because the audit (Chunk 1) is the inventory. Rough scope:
- ~10 route components (the page roots)
- ~30-40 section components rendered inside those routes
- 1 conventions file
- 0 new primitives (SectionTitle + CardTitle from the typography arc cover this arc's needs)

## Out of scope

- New typography primitives — covered by editorial-typography
- CardShell internals — already migrated to use CardTitle
- Tooltip / hover-card / dialog chrome — those are overlay surfaces, separate convention
- Home page rework as a portfolio showcase — that's [landing-showcase-arc](landing-showcase-arc.md)

## Open questions (resolve during chunks)

- Should section dividers ever wrap in chrome themselves? (Probably no — chrome implies containment, dividers imply separation. But check during Chunk 3.)
- How prominent should new section-divider headers be when added to surfaces that currently lack them (e.g. Steam game-detail)? Default to current SectionTitle weight; revisit only if it under/overshoots.
- Does the LoL match-detail "team-section" header in [match-detail-view.tsx:793](../../../apps/web/src/lol/matches/match-detail-view.tsx#L793) belong in chrome? It currently uses SectionTitle with inline Win/Loss + gold-lead chips. Re-evaluate during Chunk 4.

## How to resume

When picking this up next session:
1. Start with Chunk 1 (audit pass). It's read-only — no code changes. Output goes in a new section "## Audit (Chunk 1)" appended below this scaffolding.
2. Bring the audit table back to the owner for sign-off before Chunk 2 (IA decisions).
3. Don't skip ahead to sweeps — the per-surface decisions in Chunks 2 + 3 are the load-bearing part. Sweeping without them produces the same kind of drift the typography arc had to clean up three times.

---

## Audit (Chunk 1) — shipped 2026-05-27

Read-only enumeration of every product surface, their current IA shape, container shape, and implicit conceptual zones. Done via an Explore subagent pass over the route trees + their section components. Evidence column points to representative file:line for the most load-bearing finding per surface.

| Route | IA shape | Container shape | Conceptual zones implicit in content | What would be more coherent |
|---|---|---|---|---|
| `/` (Home synthesis bento) | Flat list | Bare | Bento spans self-organize by weight (no zones) | Leave as-is. Bento IA is inherently flat; grouping would fight the layout. |
| `/lol/$accountSlug` (profile) | Partially grouped | Mixed | Pre-game · Post-game · Form history · Role distribution · Calendar · Multikill · Synergy · Duos | Pre/Post-game already grouped under `SectionTitle`; sibling tiles (RankTiles, Stats, Duos, Synergy, Calendar) sit ungrouped at the same depth. Either group all top-level chunks or commit to flat. Current state reads as two patterns side-by-side. |
| `/lol/.../matches/$matchId` — Recap | Flat list | Bare | Blue team · Red team | Two side-by-side `TeamBlock`s in a grid. Implicit grouping (the two teams) is conveyed by layout, not divider. Fine as-is. |
| `/lol/.../matches/$matchId` — Your Game | Flat list | Bare | Build · Casts · Damage · Stats · Skills · Lane phase | Six sections in flex-col, each with its own `SectionTitle`, no shared wrapper or zone grouping. Pure linear scroll. Per arc opening: chart bodies sit bare on page bg vs equivalent Steam surfaces which wrap in chrome. Container rule decision needed. |
| `/lol/.../matches/$matchId` — Review / Timeline | Flat list | Bare | Team participants · Objectives · Event timeline | Same shape as Your Game. No dividers, no chrome. |
| `/lol/.../trends` | Flat list | Bare | Grid of 18+ trend tiles by priority | Single `SectionTitle` at top with range selector; grid cells follow. No grouping by trend category (form/champion/role/etc.). Worth considering whether ~18 tiles benefit from category dividers. |
| `/lol/.../champions/$championKey` | Partially grouped | Chrome | Hero · Stats deltas · Win rate chart · Build path · Patch history · Matchups · Heatmaps | DeltaTiles wrap in `rounded-lg border bg-card/50` (chrome) but subsequent sections render bare. Mid-page chrome→bare transition with no clear rule. |
| `/lol/.../recap` | Flat list | Bare | Rank arc · Champion · Most improved · Signature game · Patch · Duo · Insight | Seven stacked components; each renders its own heading inline, no shared `SectionTitle`/divider. Reads as a slideshow of cards, not a structured doc. |
| `/steam/` (profile) | Flat list | Mixed | Now playing · Trophy strip · Recent unlocks · Wishlist · Library · Platform mix | No dividers; `TrophyCaseStrip` renders its own card chrome internally, siblings sit bare. Chrome appears only inside one tile, not at section level. |
| `/steam/game/$appid` | Fully grouped | Mixed | Identity (hero + about) · Editorial (screenshots + body) · Progress (timeline + verdict grid + achievements) | Three explicit bands. Identity band wraps in `rounded-lg border bg-card/50`; Editorial and Progress bands use bare `<section className="flex flex-col gap-4">` wrappers despite carrying the same CardTitle + content shape. Asymmetric — reads as incomplete migration. |
| `/steam/library` | Flat list | Bare | Virtual grid/list of games | Pure inventory; no zones. Fine as-is. |
| `/steam/wishlist` | Flat list | Bare | Chronological list of wishlist items | Flat by definition. Fine. |
| `/steam/achievements` | Flat list | Bare | Recent unlocks feed (virtual list) | Header + flat list. Fine. |
| `/steam/achievements/signature` | Partially grouped | Bare | Completionist axis · Chronotype · 100% hall · Rarest | Four components stacked; `HundredPercentHall` and `RarestSection` each carry their own `SectionTitle` internally, but no outer divider grouping the trio. Mid-page primitive switch without zone framing. |
| `/status` | Fully grouped | Bare | Rate limiter windows · Rate limiter methods · Recent ticks · Match sync | Four `SectionTitle`-headed sections stacked directly on page bg. Already the cleanest reference pattern in the app for "flat list of bare sections under dividers." |

### Top 3 priority surfaces for the sweep

Driven by the audit. These will be the first sweep targets in Chunk 4 (order TBD).

**1. Steam game-detail (`/steam/game/$appid`)** — owner-flagged. Three bands already exist (Identity / Editorial / Progress) but only Identity wraps in chrome. Either commit all three bands to chrome (option `body-shape rule` from Chunk 3) or strip Identity's chrome to match the others. Current asymmetry is the loudest "incomplete migration" reading in the app.

**2. LoL profile (`/lol/$accountSlug`)** — partially-grouped IA. Pre-game / Post-game / Recent form sit under `SectionTitle` dividers but ~5 sibling tiles (RankTiles, Stats, Duos, Synergy, Calendar, Multikill, Role distribution) live ungrouped at the same depth. Decision: invent zones for the unyoked tiles (e.g. "Identity & rank" / "Companions" / "Patterns") or demote the existing dividers so the whole surface reads as a flat tile mosaic.

**3. LoL match-detail "Your Game" tab** — flat-bare-chart pattern that the arc opening explicitly called out as inconsistent with equivalent Steam surfaces. Six chart sections (Build, Casts, Damage, Stats, Skills, Lane phase) sit on page bg; the analogous Steam `UnlockTimeline` chart wraps in card chrome. Container rule decision lands here. Likely outcome per Chunk 3 candidate option 3: chart/timeline bodies → chrome; text/sentence bodies → bare. Apply across all 6 sections.

### Secondary sweep candidates (deferred to per-surface judgment in Chunk 4)

- LoL recap — invent a `SectionTitle` divider scheme or accept the slideshow framing as intentional.
- LoL champion-detail — chrome→bare transition mid-page; pick a rule.
- LoL trends — consider grouping ~18 tiles by category (form / champion / role / habit) under dividers.
- Steam achievements/signature — wrap the four components in shared zones or leave as flat.

### Reference surface (don't touch)

- `/status` is the cleanest existing instance of "flat sections under SectionTitle dividers, bare bodies." Use as the model when the container-rule decision in Chunk 3 is being ratified.

---

## Decisions (Chunk 2) — shipped 2026-05-27

Per-surface IA + container decisions for the top 3 priority surfaces. A reframed candidate container rule emerged from working surface #1 and is carried forward into Chunk 3 ratification.

### Reframed container rule (carried into Chunk 3)

Earlier draft was content-shape-based ("chart/timeline/grid → chrome, text/sentence → bare"). Working surface #1 surfaced a cleaner formulation:

> **Chrome belongs at the lowest level that visually groups heterogeneous content. Don't nest chrome inside chrome.**
>
> - If a section's children each carry their own chrome (`rounded-lg border bg-card/…`), the outer wrapper stays bare.
> - If a section's children are bare inline content (text, chips, a single chart), the wrapper carries chrome.
> - A `<section>` whose role is purely to group sibling sections under one `SectionTitle` divider stays bare regardless of child content — it's an IA scope marker, not a visual band.

The compositional rule subsumes the content-shape rule and makes the existing Steam game-detail layout the **reference implementation** rather than a defect. The Chunk 1 audit's "incomplete migration" reading on `/steam/game/$appid` was a false-positive — bands 2 and 3 are bare because their children already chrome themselves.

### Surface #1 — Steam game-detail (`/steam/game/$appid`)

**No change. Promote to reference.**

Three bands: Identity (line 188, chrome), Editorial (line 267, bare wrapper around `GameScreenshotStrip` + `GameAboutBlock`), Progress (line 278, bare wrapper around `GameUnlockTimeline` + `completion-verdict-card` grid + `AchievementPanel`). All children of bands 2 and 3 carry their own chrome via internal `rounded-lg border bg-card/50` wrappers or `CardShell`. Adding chrome to the bands would create nested borders. Identity carries chrome because its children (price strip, platform pills, review chip, ESRB chip, short description) are bare inline content — exactly the rule's "wrapper carries chrome" branch.

This is the canonical "bare wrapper, chromed children" pattern. Cite it in Chunk 3 when ratifying the compositional rule.

### Surface #2 — LoL profile (`/lol/$accountSlug`)

**Keep flat stack. Migrate three ad-hoc headers to `SectionTitle` in Chunk 4.**

Page is a flat stack of 15 components with an implicit identity → content → strips rhythm:

- **Identity strip:** `ProfileRankTiles`, `LiveGameChip`, `ProfilePatchNotice`
- **Content sections:** `ProfilePregameRitual`†, `ProfilePostGame`†, `ProfileRecentForm`†, `ProfileLpHistory`*, `ProfileSeasonHistory`*, `ProfileNowPlaying`*, `ProfileRoleStrip`†, `ProfileDuos`†, `ProfileSynergy`†, `ProfileQueueDistribution`†, `ProfileActivityCalendar`†
- **Fact strips:** `ProfileStatsBar`, `ProfileMultikillStrip`
- **Recap link tile**

† = already uses `SectionTitle`; * = uses ad-hoc `text-xs uppercase tracking-wide text-muted-foreground` span header (the exact pitfall called out in `repo-conventions.md` § "Header primitives").

The implicit rhythm reads cleanly enough that explicit zone dividers ("Identity" / "Activity" / "Highlights") would feel bureaucratic and add no information the page doesn't already convey by ordering. The asymmetry the Chunk 1 audit flagged is real but localized to the three ad-hoc headers.

**Chunk 4 sweep targets** (one commit):
- `profile-lp-history.tsx:540` — swap span → `SectionTitle`
- `profile-season-history.tsx:213` — swap span → `SectionTitle`
- `profile-now-playing.tsx:65` — swap span → `SectionTitle`

`ProfileNowPlaying` stays mid-page (it's a 7-day recent-form aggregation, not live-match identity — does not belong with `LiveGameChip`).

`ProfileStatsBar` and `ProfileMultikillStrip` stay header-less bottom strips by design (single-row fact displays, not sections that need a title).

### Surface #3 — LoL match-detail "Your Game" tab

**No change. Promote to reference as the counterpart pattern.**

Six chart sections in a flat `flex flex-col gap-6` stack: `MatchBuildOrder`, `MatchSpellCasts`, `MatchDamageProfile`, `MatchOwnerStats`, `MatchSkillOrder`, `MatchLanePhase`. Each child uses `<section className="flex flex-col gap-3">` (bare wrapper) with a top-level `SectionTitle` divider. No chrome anywhere in the tree.

The arc opening read this as "inconsistent with Steam" — but under the compositional rule it's the second valid pattern: **"bare wrapper, bare children, dividers do all the visual lifting."** It works because the children are individual chart bodies of similar visual weight, sitting under an existing scrollspy nav that already implies the section structure. Adding chrome to all 6 would create a heavier "boxy" feel that fights the long-form scrollspy reading flow.

This is the canonical "bare-everything, header-led" pattern. Cite it in Chunk 3 alongside Surface #1 to show both branches of the compositional rule produce coherent layouts.

### Remaining chunks

- **Chunk 3 — deferred (owner-run visual).** The rule is text-defined in this note and codified in `repo-conventions.md`; the side-by-side capture is documentation-only and can be produced from a running dev server when convenient. Not blocking.
- ~~**Chunk 4 — shipped 2026-05-27.**~~ Three ad-hoc span headers on LoL profile migrated to `SectionTitle`: `profile-lp-history.tsx:540`, `profile-season-history.tsx:213`, `profile-now-playing.tsx:65`. One commit. Secondary candidates (LoL recap, champion-detail chrome→bare transition, trends ~18-tile grouping, Steam achievements/signature) remain — each will get a per-surface decision via the same Chunk 2 walk-through pattern if/when picked up.
- ~~**Chunk 5 — shipped 2026-05-27.**~~ Compositional container rule appended to `repo-conventions.md` as a new sub-section "Page composition: chrome belongs at the lowest level that visually groups heterogeneous content," sibling to the existing header-primitives rule. Cross-links the two reference surfaces (Steam game-detail, LoL Your Game) and pairs the chrome decision with the header-primitive decision.
