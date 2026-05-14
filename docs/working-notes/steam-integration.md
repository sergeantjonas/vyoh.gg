# Steam integration

A working note for the planned Steam integration. Stated cadence (owner, 2026-05-14): **start soon, once the LoL feature backlog runs lower** — Steam is the next big content axis after LoL, not a parallel track.

Steam shares the recap / `ConclusionCard` engine with LoL: *"you played 6h of Helldivers this week, mostly in 2-hour sessions, longest break in three months"* reads exactly like a LoL trends conclusion. The architectural rule: **do not build Steam as a parallel system.** Share the trends/recap primitives, the verdict-card pattern, and the timeseries plumbing.

Sibling doc: [self-portrait-surfaces.md](self-portrait-surfaces.md) — Steam panels are part of the same "vyoh.gg as self-portrait engine" reframe.

---

## Confirmed first surfaces

**Wishlist panel.** *"47 games in backlog."* Steam wishlist is a public-profile endpoint (no OAuth needed for public profiles) and runs entirely server-side. Calm chip + optional drill-in to the list with date-added timestamps. Owner explicitly named this as a wanted surface (2026-05-14).

---

## Candidate surfaces to flesh out when work starts

The following are *plausible* once Steam is wired — none are committed, but all reuse the recap engine:

- **Playtime trends per game.** Weekly/monthly playtime, biggest jumps, gone-quiet flags. Direct analogue of LP/WR trends.
- **Library composition.** Genre mix, average playtime per genre, "you own 412 games and have played 67."
- **"Currently / recently played" strip.** Public-profile-derived. Calm Profile-page chip.
- **Achievement velocity.** Achievements per hour played per game, framed via `ConclusionCard`. Quirky vanity metric, calm copy.
- **Cross-game recap.** Steam playtime + LoL match counts in the same yearly recap — the strongest argument for the "self-portrait engine" reframe.

---

## Open questions (to revisit when scoping begins)

- **Auth model.** Public Steam profile (read-only, no OAuth) covers most needs. Anything that requires non-public data — friends list, transactions, wishlist private notes — needs OpenID/OAuth. Default to public-profile-only until a surface forces otherwise.
- **Rate limits / polling cadence.** Steam Web API limits are looser than Riot's but still need a reservoir. Reuse the Bottleneck pattern documented in the rate-limiter case study; don't introduce a second limiter library.
- **Backfill story.** Steam does not expose deep historical session data — playtime is mostly cumulative. The trends engine may need to start from "now" and accrue, unlike LoL where we backfilled from match-v5.
- **App-id / icon assets.** Mirror the build-time champion-asset pipeline (case study `build-time-champion-assets`) — pull game header/library art at build, don't hotlink Steam's CDN.

---

## Cross-references

- The "Cross-pollination with the Steam roadmap" subsection in [self-portrait-surfaces.md](self-portrait-surfaces.md#cross-pollination-with-the-steam-roadmap) is the parent reframe.
- [vnext-ideas.md](vnext-ideas.md) — Steam integration is implicit there as the next big arc after the documented roadmaps; this doc is the dedicated home.
- Rate-limiter and asset-pipeline approaches: reuse the patterns from existing case studies (`riot-rate-limits`, `build-time-champion-assets`).
