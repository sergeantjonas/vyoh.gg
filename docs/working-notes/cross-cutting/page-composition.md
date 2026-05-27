# Page composition — section structure + container convention

**Status:** Planned — opened 2026-05-27 after the editorial-typography arc closed out. Three rounds of typography sweeps surfaced a structural-level inconsistency the typography arc couldn't address: pages use different IA (flat list of cards vs grouped under section dividers) and different container patterns (chrome around sections vs bare) without a shared rule. This arc decides the rules and sweeps.

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
