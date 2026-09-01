# Landing live-hero swap

**Status:** Parked 2026-09-01 — planned 2026-05-31 and never picked up; the parent arc closed the same day. Trigger: a landing-page pass. Listed in [parked.md](../parked.md). Originally promoted from a one-line candidate in [landing-showcase-arc.md § Scope sketch](landing-showcase-arc.md) into its own sibling note so the design alternatives, infrastructure ties, and reduced-motion contract aren't lost between chunks. **Not** active work; surfaced here so the next pickup of [landing-showcase-arc.md](landing-showcase-arc.md) has a concrete chunk to slot in, not a vague bullet to re-scope from scratch.

Read this when the landing-showcase-arc Composition chunk lands and the next decision is "what does the hero become when the owner is actively playing?"

Sister notes: [landing-showcase-arc.md](landing-showcase-arc.md) (parent arc), [ambient-home-hero.md](ambient-home-hero.md) (current hero — what this swaps over), [live-presence-chip.md](live-presence-chip.md) (always-visible nav chip; shares server infrastructure but **distinct scope** — see § Distinction from live-presence-chip), [self-portrait-surfaces.md § cross-stream synthesis](self-portrait-surfaces.md), [reduced-motion-replacements.md](reduced-motion-replacements.md).

KB anchors: [15-realtime-state-forms.md §SSE vs WebSocket](~/.claude/knowledge/frontend-2026/15-realtime-state-forms.md), [03-motion.md §enter/exit choreography](~/.claude/knowledge/frontend-2026/03-motion.md).

---

## Why

The landing-showcase arc shipped the *teaser version* of activity-reactivity in Chunk 4: ambient hero chroma reflects recent activity intensity (LoL matches in 24h + Steam minutes today). That's information-bearing but *implicit* — a recruiter sees a vibrant palette without knowing why.

The explicit version is the synthesis premise codified in [repo-conventions.md § `/` is synthesis-only](../../repo-conventions.md) and [self-portrait-surfaces.md](self-portrait-surfaces.md): the landing surface answers "what am I doing right now" across streams. When the owner is in a LoL match, the hero swaps to a champion-splash backdrop with match context. When playing Steam, the hero swaps to game art with playtime-today. When idle, the hero falls back to ambient (the current Chunk 4 state) and adds a curated "Today: X hours across Y streams" caption.

This is the single change that turns the landing surface from "calm but generic ambient" into "this site is a presence beacon for one specific person." It's also the chunk that makes the activity-intensity work fully legible — Chunk 4's chroma stops being decorative and becomes the *idle-state* of a larger live-swap system.

---

## What this is NOT

- **Not a full live-game viewer.** That route already exists ([apps/web/src/routes/lol/$accountSlug/live.tsx](../../apps/web/src/routes/lol/$accountSlug/live.tsx)). The hero links *to* it; it does not duplicate it.
- **Not multi-account / multi-user.** Owner-only. Multi-account aggregation is a future arc, not part of this one.
- **Not a replacement for the ambient hero.** Ambient is the **idle state** of this system — it stays. Live state *overlays* or *crossfades* over ambient.
- **Not always-on websocket.** SSE push or visibility-aware short polling — see § Data flow.
- **Not the [live-presence-chip](live-presence-chip.md).** The chip lives in the nav, persists across every page, is small. This is the hero on `/` only. They share server infrastructure but the visual register is different. See § Distinction below.

---

## Distinction from live-presence-chip

Both surfaces answer "what is the owner doing right now," but with different shape and scope. Easy to conflate; worth keeping separate so neither bleeds into the other.

| Aspect | [live-presence-chip](live-presence-chip.md) | This (landing live-hero swap) |
|---|---|---|
| Surface | Nav, every page | `/` hero, landing-only |
| Size | ~28px tall, single line | ~60vh full-bleed |
| Persistence | Stays on screen across navigation | Visible only when on `/` |
| When active | Whenever owner is live OR recently played | Same conditions, but on `/` only |
| Visual register | Calm chip, dot + label | Editorial / cinematic — splash, game art |
| Information density | Minimal — entity name + one stat | Hero — backdrop, headline, secondary stats, deep link |
| Server infrastructure | `PresenceService` + SSE per live-presence-chip.md | **Same** `PresenceService` — this is the consumer-side scale-up |

**Sequencing rule:** the chip's Chunks 1–3 land the `PresenceService` shape. This note's chunks consume it. Don't start hero swap before chip Chunk 3 lands the live state — it's the same data, and shipping two consumers of an un-shipped service doubles the risk of re-shaping the contract.

---

## Design directions

Pick one (or a hybrid) when picking up. Don't try to ship all three behind toggles.

### Direction A — Live-state-only swap

Hero swaps **only** when the owner is actively in a LoL match or actively playing on Steam. Idle (no live signal) = current ambient hero, no change.

- **In LoL match:** champion splash as the hero backdrop (reuse the existing `useSplashChampion` provider + `apps/web/src/lol/_shared/splash-backdrop.tsx` pattern). Headline = "Playing {champion}". Secondary = role, game time (ticking), team comp summary. CTA = "Watch live" → `/lol/$accountSlug/live`.
- **In Steam game:** game header/library art as the backdrop. Headline = "In {gameName}". Secondary = playtime today, total playtime, last achievement (if recent). CTA = "View game" → `/steam/game/{appid}`.
- **Both** (rare — multi-boxing): prefer LoL per [live-presence-chip § Chunk 6 disambiguation rule](live-presence-chip.md).
- **Idle:** unchanged ambient hero.

**Pros:** clearest portfolio signal ("look, the site knows I'm playing right now"). Lowest design risk because the live state is rare and bold — when it fires, it lands. Idle state stays exactly the shipped Chunk 4 ambient.
**Cons:** rarely visible to casual visitors. The recruiter who lands at 11am while the owner is at work sees only ambient, never the live state.

### Direction B — Daily-dominant

Hero always reflects the *dominant stream of the last 24h*, even when nothing is live. If the owner played 2h of LoL and 30min of Steam today, hero shows the most-played LoL champion. If Steam dominated, hero shows the most-played game art.

- Live state still upgrades to "in-game" with a small "live now" badge.
- Idle state never falls back to pure ambient — there's always *some* dominant stream from recent activity.

**Pros:** higher portfolio yield (visitors at any time of day see a personalized hero, not just lucky in-match windows). Stronger "lived-in" feel.
**Cons:** more design judgment about how the daily-dominant hero composes with the still-running ambient. Risk of "Steam-game art permanently dominating the landing page because the owner played Cyberpunk all weekend" — needs a freshness decay or a manual override.

### Direction C — Hybrid (recommended floor, Direction A first)

Land Direction A first. Treat Direction B as a follow-up chunk that adds "if no live state AND last-24h activity exceeds threshold, fall back to dominant-stream hero instead of pure ambient." Decay rule: dominant-stream hero is only valid for ~6h after the last activity tick; beyond that, fall through to ambient.

This sequencing means:
- The first ship of this feature has a small, well-defined scope (live state only).
- The dominant-stream layer is additive and tunable independently.
- The ambient state is preserved as the true idle floor — no risk of permanent "showcase art" sticking past relevance.

**Default recommendation: Direction C** — ship A first, layer B on top once the live-state crossfade is settled.

---

## Infrastructure to reuse

Already shipped, don't rebuild:

- **LoL live signal** — [apps/api/src/lol/live-game-poller.service.ts](../../apps/api/src/lol/live-game-poller.service.ts) (`LiveGamePollerService`). Polls Riot spectator-v5, emits `game-started` / `game-ended` events, exposes `getForPuuid(puuid): LiveMatch | null`. The hero subscribes via the same event bus the existing `/lol/$accountSlug/live` route uses.
- **Steam live signal** — `SteamPlaySession` rows with `endedAt: null` (open session = currently playing). Already queried in the activity-intensity service ([apps/api/src/home/home-activity-intensity.service.ts](../../apps/api/src/home/home-activity-intensity.service.ts) `clipSessionMinutes`). A "currently-playing appid" lookup is one extra query.
- **Champion splash backdrop** — [apps/web/src/lol/_shared/splash-backdrop.tsx](../../apps/web/src/lol/_shared/splash-backdrop.tsx) + `SplashProvider` / `useSplashChampion` already power LoL section backdrops. Mount it the same way on `/`.
- **Steam game art** — already proxied via the image pipeline ([apps/web/src/steam/library/](../../apps/web/src/steam/library/) library tiles use it). Same asset, larger crop.
- **Activity-intensity scalar** — newly shipped [HomeActivityIntensity](../../packages/shared/src/home/activity-intensity.ts). The daily-dominant variant (Direction B) consumes this directly; live state can override it.
- **Backdrop primitives** — `apps/web/src/_shared/backdrop/` ships `useRefCountedClaim` + `<BackdropPortal>` (already powers Steam + LoL backdrops). The landing hero can mount through the same portal.
- **`PresenceService` shape** — to be defined by [live-presence-chip § Data flow](live-presence-chip.md) Chunks 1–4. Don't fork it; consume it.

---

## Reduced-motion contract

Hard requirement per [reduced-motion-replacements.md](reduced-motion-replacements.md): no element here can simply be disabled — every motion gets a replacement.

- **Hero swap (live ↔ idle):** under reduced-motion, no crossfade. Hard cut on next route mount (i.e., on navigation to/from `/`). Within an open `/` tab, fall back to a once-on-state-change hard swap rather than continuous animation.
- **Backdrop animation:** ambient drift already pauses under reduced-motion (shipped). Live-state splash backdrop should follow the same rule — static splash, no Ken-Burns pan.
- **Game-time ticker:** in-match game-time text updates once per second. Under reduced-motion, update once per 10 seconds (still useful information, less twitchy).
- **Daily-dominant decay:** the "this is fresh" / "this is stale" visual cue should not animate — render the same icon/badge with no transition under reduced-motion.

The information content of the hero is identical with or without motion — that's the rule, and it holds here because the headline + backdrop image already carry the meaning, the animation is decoration.

---

## Open decisions

Resolve when picking up:

1. **Direction A vs B vs C.** Default recommendation is C (ship A first, B follow-up). Confirm at pickup.
2. **Crossfade duration and shape.** 200ms cross-dissolve? Slide-up? Held still until next route mount? Bento behavior during the swap (does the bento backdrop-blur intensity change with the hero, or stay constant)?
3. **Idle threshold for Direction B.** How recent does the dominant stream need to be? 6h? 24h? Tied to activity-intensity decay.
4. **Steam multi-game disambiguation.** If the owner played 3 Steam games today, which gets the hero? Most playtime is the obvious answer; document.
5. **CTA labeling.** "Watch live" vs "Currently playing" vs no CTA (let the splash itself be the link).
6. **Cold-start behavior.** First paint while the presence query is in flight — does the hero render ambient (safe default, no flash) or show a skeleton? Per the [Skeleton loaders must mirror the layout they replace](../repo-conventions.md) rule, if the live hero has a structurally-different layout than ambient, the skeleton must too.
7. **OG image impact.** The `/` OG image ([og-image-pipeline.md](og-image-pipeline.md)) currently bakes a static landing — does it follow the live state, or stay frozen? Live = stale OG cache risk; frozen = inconsistent with what visitors actually see.

---

## Sequencing

**Hard prerequisite:** [live-presence-chip](live-presence-chip.md) Chunks 1–3 (server `PresenceService` shape stable, live-state coverage for LoL). Without that, this note's chunks would either fork the contract or block on it.

**Soft prerequisite:** [landing-showcase-arc.md](landing-showcase-arc.md) Chunk 5 composition pass (bento backdrop-blur tuning). Live-state hero is visually busier than ambient; composition tuning against the ambient hero should land first so the bento doesn't get re-tuned twice.

**Relative to ambient-home-hero arc:** this note is the natural Chunk 8+ of [ambient-home-hero.md](ambient-home-hero.md) (after current Chunks 5 cursor parallax / 6 composition / 7 WebGPU stretch). Or, more cleanly, it can live as its own arc since the scope is large enough (server + client + design alternatives + reduced-motion variants).

**Recommended sequencing:**
1. live-presence-chip Chunks 1–3 (server shape + LoL live).
2. landing-showcase-arc Chunk 5 (composition pass against current ambient).
3. This arc Chunk 1 — Direction A live-state-only on `/` hero, hard-cut swap, LoL only.
4. This arc Chunk 2 — Steam live state.
5. This arc Chunk 3 — Direction B daily-dominant layer (additive, gated by `useReducedMotion()` and freshness threshold).
6. This arc Chunk 4 — crossfade choreography + tooltip CTA polish.

---

## Risks

- **"Generic gaming landing page" risk.** Many gaming-tracker sites swap to game art on activity — looks like Steam Big Picture or a Twitch panel. Mitigation: keep editorial typography dominant, treat the backdrop as ambient (not "screenshot of game"). The headline carries the personality.
- **OG / SEO interaction.** Dynamic content on `/` complicates the static OG snapshot. May force `/` into client-only-render territory more aggressively than the rest of the app, which has SSR plans ([tanstack-start-migration.md](tanstack-start-migration.md)).
- **Splash asset coverage.** Riot ships splashes for every champion; Steam game header art is reliably present. No coverage holes expected, but verify on pickup for any champions added between shipping this and now.
- **Permanent-Cyberpunk problem.** Without a freshness decay (open decision 3), a long-play weekend could pin the hero to one game for days. Decay needs to be tuned against actual play patterns, not guessed.
- **Reduced-motion regression risk.** Adding live state without thinking through reduced-motion replacement is the most likely silent regression. Treat the contract above as a hard checklist, not a goal.

---

## Cross-references

- [landing-showcase-arc.md](landing-showcase-arc.md) — parent arc; this is the surfaced version of its "Cross-stream synthesis hero" scope-sketch candidate.
- [ambient-home-hero.md](ambient-home-hero.md) — the hero this swaps over; ambient is the idle floor.
- [live-presence-chip.md](live-presence-chip.md) — hard prerequisite (server) + visually-distinct sibling (nav chip).
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — broader self-portrait framing.
- [reduced-motion-replacements.md](reduced-motion-replacements.md) — standing rule, applies here.
- [og-image-pipeline.md](og-image-pipeline.md) — interacts with dynamic landing.
- [tanstack-start-migration.md](tanstack-start-migration.md) — SSR coordination.
- [repo-conventions.md § `/` is synthesis-only](../../repo-conventions.md) — the convention this operates inside.
