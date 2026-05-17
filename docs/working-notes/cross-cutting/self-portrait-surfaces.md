# Self-portrait surfaces

**Status:** Active — parent direction note + candidate backlog. Several tile candidates from here have shipped via [home-deck.md](../archive/home-deck.md). Routing principle (cross-stream synthesis on `/`, stream-deep feeds on per-stream routes) sharpened 2026-05-16 and is now the canonical rule.

A working note tracking the "vyoh.gg as self-portrait engine" direction — panels on the site sourced from streams of the owner's life beyond LoL, each rendered as a `ConclusionCard` from the trends-rework engine. The reframe is from *another op.gg clone* to *a self-portrait engine where every panel is a verdict-card from a different data stream*. Stronger freelance signal; reuses every primitive already built (`ConclusionCard`, `RitualSignal`, SSE backfill, recap composer, patch-aware boundaries).

This doc is a sibling to [vnext-ideas.md](vnext-ideas.md) — a backlog, not a phased plan. Pulled out because the direction is broad enough to crowd the parent doc.

---

## Hard filter (owner, 2026-05-14)

Any candidate must satisfy **all three**:

1. **Zero hand-maintenance.** No periodic manual edits. An empty or stale panel reads worse than no panel.
2. **No daemon on the gaming desktop.** Anything that requires a persistent local agent on the gaming machine is out. Plugins on the dev machine are conditional and require explicit OK.
3. **Lives on its own.** Server-side polling against public or OAuth APIs, or derivation from data already in the vyoh.gg DB. After one-time setup, the panel runs without owner involvement.

Items that fail this filter are listed in [Filtered out](#filtered-out) with the reason, so they don't quietly creep back in.

---

## Routing principle (sharpened 2026-05-16)

Each stream owns its own route, not its own tile on `/`. The home page is for **cross-stream synthesis** — content that combines multiple streams into one verdict (chronotype hour-bucketing across LoL + commits, "what am I doing right now" picking the dominant live stream) — not stream-deep feeds. A "latest commit" or "top track this week" tile on `/` is wrong-place: it belongs on `/code` or `/music`.

Concrete implications for the candidates below:

- **Spotify** ships behind a `/music` route. Top tracks/artists, listening history, recap overlays all live there. The home page is eligible only for a single curated highlight (e.g. now-playing chip when active) that links into the deep route.
- **GitHub activity, reframed** ships behind a `/code` route. Streak, language mix, commit clusters, repo-level surfaces all live there. The home page gets at most a synthesis contribution (e.g. commit timestamps feeding the chronotype tile).
- **WakaTime**, if it ever lands, also feeds `/code`.
- **Chronotype** is the canonical `/` shape — it merges hour-bucketing across whatever streams are wired and produces a synthesis verdict no per-stream route could.

Without this rule, `/` accumulates one stream-feed per integration (now-playing track + latest commit + now-playing game + last match) and the synthesis story drowns in feeds. Per-route deep content also reads cleaner for portfolio framing — each integration becomes its own case study (Riot, Steam, Spotify OAuth, GitHub GraphQL) with `/` as the aggregator. See [home-deck.md](../archive/home-deck.md) for the `/` implementation arc.

---

## Live candidates ★★★

**Inferred chronotype panel.** *"Your best ranked hour is 8pm. Your most productive coding hour is 10pm. They overlap on Sundays."* Pure derived insight — no new data sources required. Re-computes nightly on the server from LoL match timestamps already stored (and optionally GitHub commits via public API). Same architectural move as duo/squad detection, pointed at the owner instead of the match. Highest novel-insight-to-build-cost ratio on the board. **Lives on `/`** — canonical cross-stream synthesis shape per the [Routing principle](#routing-principle-sharpened-2026-05-16). LoL chunk shipped 2026-05-14; commit-timestamp source plugs in when `/code` lands.

**GitHub activity, reframed.** Public API, polled server-side. Not the green-square grid — run it through the `ConclusionCard` engine: longest streak, busiest hour, language mix this year, commit clusters tied to case-study milestones. **Lives on its own `/code` route**, not as tiles on `/`. The synthesis-eligible piece for `/` is the commit-timestamp stream feeding chronotype; everything else stays under `/code`.

**Spotify integration.** Server-side OAuth-refresh polls Spotify Web API on a cron; nothing local after one-time auth. **Deep content lives on `/music`** — top tracks/artists, listening history, recap overlays. `/` is eligible at most for a small now-playing strip when active, linking into the deep route. Owner has explicitly OK'd exploring this direction. **Not** Last.fm — owner doesn't use it.

**WakaTime — conditional.** Free IDE plugin → silent timeseries of coding minutes per language/project, exposed via JSON API. Plugin only ever runs on the **dev** machine (never the gaming desktop) and is dormant after install. If "any persistent plugin on any machine" is a no, skip; otherwise it drops into the `/code` route alongside GitHub activity (not a separate surface). Owner has not yet committed either way.

---

## Adjacent directions worth probing

These respect the filter but haven't been pulled into a focused panel yet. Listed for the next round of exploration.

### Riot-side untapped data (LoL only, no new integration)

- **Champion mastery + emblems.** Currently unused endpoint. Surface as its own "I've put 412k points into Vex" panel or feed an existing `ConclusionCard`.
- **Free-week / rotation echo.** *"Three of this week's free-week champions are ones you've never played."* Passive, automatic, calm. Cheap.

TFT lives in its own working note now — see [tft-integration.md](../tft/tft-integration.md). It's a separate game integration, not just an "untapped endpoint."

### Temporal anniversaries (LoL data, all liked 2026-05-14)

- **"On this day."** Surface the match closest to today's calendar date from each prior year. Extension of the Same-Day-Last-Year vNext idea into multi-year; emotional payoff scales with history depth. Re-derives daily from stored matches; no maintenance.
- **Anniversary chips.** *"5,247 ranked games played."* / *"First tracked ranked: 2018-03-14, Yasuo, loss."* Generated once per visit from the match table, never stale.
- **First-of-season firsts.** Auto-detected milestones: first ranked of a split, first win, first new champion of the year. No manual flagging — pure timestamp + roster derivation.
- **Last-time chips.** *"Last AP Yasuo: 8 months ago."* Per-champion / per-build last-played, surfaces on Champion Detail or as a Profile micro-strip.

### Style / signature fingerprint (LoL data, all liked 2026-05-14)

- **Signature radar.** 5-axis "what kind of player are you" chart — KDA shape, CS@10, vision/min, gold conversion, objective participation. Compared against rank-tier averages from cdragon. The visualization op.gg structurally cannot do because they don't curate identity. Pairs with the personal-baselines work — same numbers, different lens.
- **Strongest-against / weakest-against matrix.** Per-champion WR already computed; reframe as a `ConclusionCard`: *"Your three best matchups are X. Your three worst are Y."* New framing on existing data.
- **Map-region heatmap.** Where on the Rift the owner actually spends time. Requires match-timeline position data that match-depth Phase B is already ingesting for the kill-strip morph — falls out of work already planned.
- **Premade ratio.** *"78% solo, 22% with friends."* Pairs naturally with duo/squad detection (both pull from the puuid-co-occurrence work).

### Career narrative (LoL data, 2026-05-14)

- **Career-arc / origin-story panel.** Sports-almanac-of-yourself: peak rank by year, longest climb, biggest fall, first-tracked date, most-played-ever champion, longest gap-then-return. Distinct from Temporal anniversaries — those are date-markers, this is *narrative shape*. Pure derivation from match + rank-snapshot tables. Could be its own `/origin` route or a Profile section. High emotional payoff per line of code.
- **You-vs-you comparison surface.** *"This week's you vs last month's you, on the same five axes."* Same data, different lens — explicitly anti-leaderboard, no other-player exposure. Pairs naturally with the [signature radar](#style--signature-fingerprint-lol-data-all-liked-2026-05-14). Owner flagged as a reasonable idea but *lower priority* than career-arc / tilt-protection / aesthetic responses — keep parked until the higher items prove out.

### Behavioral self-awareness (LoL data, all liked 2026-05-14)

- **Queue-cadence chip.** Match-end-to-next-queue gap, split by win/loss outcome. *"After losses, you queue in 47s on average. After wins, 6 minutes."* Surprisingly intimate insight from zero new data; smallest possible self-awareness panel.
- **Surrender-vote profile.** Match timeline carries ff15 vote events. *"You vote yes 34% of the time. When you vote no, your team wins 18% of those games."* Honest self-mirror, calm copy, no judgment framing.
- **Ping fingerprint.** Most-used ping by champion or by role, if pings are captured at match-depth ingestion. Tiny, quirky.
- **First-blood involvement rate.** One-line derivation.
- **Tilt-protection insight chip.** Negative-space companion to Pregame Ritual: *"You're 2 games above your weekly average and 1 below your average WR — historically, the next game has been 41% WR. Tonight might be a step-away night."* Honest, not prescriptive. Same primitives as Pregame Ritual, opposite intent — the "step away" variant rather than the "queue up" variant. Owner liked this specifically 2026-05-14.

### Site-as-data — meta self-portrait

- **Auto-generated `/changelog`.** Built from git tags or merged-PR titles. Reuses the conclusion-engine format: *"vyoh.gg shipped 8 features in April, peak velocity 2026-04-12."* Calm changelog as freelance signal — a maintained site that proves it's maintained.
- **The site's own commits as `ConclusionCard`s.** Same idea, framed as part of the self-portrait — owner's commits on *this exact site* shown alongside the LoL trends derived by it. Recursive in a good way.
- See also: deploy badge + domain-age chip under [Identity-level passive signals](#identity-level-passive-signals-footer--chip-surfaces).

### Identity-level passive signals (footer / chip surfaces)

- **Domain age / "this site has been live for N days."** Tiny footer line, lives off the build date. Quirky personal-website tradition; zero maintenance.
- **Build / deploy badge.** *"Last deployed 14 hours ago, commit `e1814c6`."* Pulls from CI metadata, never stale by definition.
- **Self-reported Lighthouse / uptime chip.** From the existing pipeline if/when it lands. Reinforces the "this site is a craft object" signal.

### Ambient / aesthetic responses (2026-05-14)

- **Daily-changing accent color from yesterday's session.** Site primary accent tints slightly warmer/cooler depending on the previous day's net-LP outcome. Derived nightly from the last day's rank snapshots; no user touch, no daemon. Tonal flagship in the "site responds to what happened to you" family — quiet enough never to feel gimmicky, present enough that returning visitors notice the room is different. Composes with the existing ambient backdrop polish noted in [vnext-ideas.md](vnext-ideas.md). Owner liked this specifically 2026-05-14.

### Cross-pollination with the Steam roadmap

When Steam integration lands — owner intends to start it *soon, once the LoL feature backlog runs lower* (stated 2026-05-14) — the same recap-engine framing applies: *"you played 6h of Helldivers this week"* reads exactly like the LoL recap. Worth flagging up-front so Steam doesn't get built as a parallel system — share the trends/recap primitives. See [steam-integration.md](../steam/steam-integration.md) for the Steam-specific candidate list (wishlist is the confirmed first surface).

---

## Filtered out

Off the table for the foreseeable future. Listed so they don't reappear in other docs or future suggestions.

**Needs hand-maintenance:**

- `/uses` rig + peripherals page
- Availability / hire-me card
- Anti-resume / project graveyard
- Personal monthly changelog
- Currently-reading panel
- Letterboxd diary

Reason: all require periodic manual updates and an empty/stale version reads worse than no panel. Revisit only if the owner decides to commit to active curation.

**Needs local data collection:**

- Live system snapshot (CPU/GPU/RAM/temp)
- Speedtest / network card
- "Currently working on" derived from local git
- Anything requiring a daemon on the gaming desktop

Reason: owner has explicitly excluded persistent local agents on the gaming desktop.

**Off the table outright:**

- **Strava**, **location / timezone card**, **creative wildcards** (live presence indicator, guestbook, "what I'm into now" rotator). Owner excluded all in the 2026-05-14 brainstorm.
- **Last.fm.** Owner doesn't use it. Spotify is the audio integration to consider.
- **Birthday card.** Owner declined 2026-05-14. The rest of the temporal-anniversary family (on-this-day, first-of-season firsts, last-time chips, anniversary chips) is in scope; the birthday-specific variant is not.
- **External public-activity feeds** — HackerNews, Mastodon, Dev.to, Reddit, Stack Overflow profile, NPM/PyPI maintainership, GitHub Sponsors, AniList / MyAnimeList. Owner declined the category 2026-05-14. The only external public surface still in scope is **Steam wishlist**, which lives under the Steam integration roadmap, not here — see [steam-integration.md](../steam/steam-integration.md).
- **AI-derived weekly narrative.** A server-side LLM call producing a natural-language "you this week" digest as a Coach's note on the recap surface. Owner declined 2026-05-14. Note for future suggestions: do not propose LLM-curated digests as a self-portrait surface; the calm-coaching tone is intentionally human/derived, not generative.
- **Public read-only API of own data** (e.g. `/api/v1/profile/me/recent`). Owner declined 2026-05-14 — not interested in exposing personal data as a public API surface for portfolio reasons.

---

## What to pick first (if asked tomorrow)

1. **Chronotype panel.** Highest insight-to-cost ratio. Lives on `/`. LoL-only chunk already shipped 2026-05-14; the cross-stream extension (folding commit timestamps in) lights up automatically when `/code` lands.
2. **Spotify integration as a `/music` route.** Read the Web API docs, sketch what auth + refresh + DB shape looks like. Deep listening-history surfaces live on `/music`; at most one curated synthesis tile (e.g. now-playing chip) drops into `/`. Owner explicitly invited this exploration. Scope as a route, not a tile.
3. **GitHub activity as a `/code` route.** Public API, low complexity. Streak / language mix / commit clusters live on `/code`; commit timestamps feed the chronotype tile on `/` as the cross-stream contribution. WakaTime, if it lands, joins the same route.

The other live candidates (mastery, free-week echo, TFT) sit one tier behind — promote when the top three have proven the framing, or when an adjacent arc makes one of them cheap to drop in.
