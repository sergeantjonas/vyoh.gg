# Visitor-vs-owner comparison

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](../cross-cutting/idea-pool-2026-06.md)), not scoped. **Hard gate: production-tier Riot key** — the dev-tier budget ([riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)) cannot serve untrusted public traffic. Park-class until the key exists; on file because the design is worth having ready.

## Why

The portfolio is read-only: visitors watch the owner's data. One interactive affordance — *enter your Riot ID, see how you stack up* — converts it into a demo the visitor is inside of, which is disproportionately memorable for the gaming-adjacent engineers and recruiters most likely to land here. And the engineering required (rate-limiting untrusted traffic against a shared upstream budget) is itself a case-study chapter extending the existing rate-limits write-up.

Distinct from on-file neighbors: vnext's "cross-account unified identity" (owner's own accounts) and the deferred Riot RSO auth (this needs **no auth** — public-data lookup, no account linkage, nothing persisted to the visitor).

## Shape

- **Flow:** input Riot ID → one-shot fetch (rank + last ~20 ranked matches) → a single comparison card: WR / KDA / favorite champions / chronotype-hour overlap ("we both peak at 21:00") / shared-champion verdict. Ephemeral by design — results cached ~24 h keyed by Riot ID purely to absorb repeat lookups, never listed, never crawlable.
- **Tone:** calm and symmetrical ("you vs me", both can lose) — not leaderboard shaming. The chronotype-overlap line is the characterful hook; raw stat-diffing is what op.gg already does.
- **Rate protection is the feature:** partition the Bottleneck reservoir (owner sync gets a guaranteed floor; visitor lookups get the remainder), per-IP throttle + global daily cap, and a **visible queue position** when saturated — making the rate limiter user-visible turns the constraint into showcase. Degrade honestly: "budget spent, try tomorrow" beats silent failure.
- **Surface:** entry point on the LoL profile or recap ("compare yourself →"); own sub-route; palette verb (`compare <riot-id>`).

## Risks / open questions

- Prod-key application itself is the blocker (and its behavior is a parked case-study topic in [case-study-topics.md](../cross-cutting/case-study-topics.md) — this feature would un-park it).
- Abuse surface: scripted lookups burning budget. Cap + queue handles cost; decide whether a lookup requires a played-this-season check to filter garbage IDs cheaply (account-v1 is the cheap first call).
- Region handling: visitor may be on any shard; v1 could honestly scope to EUW/EUNE ("same servers as me") and say so.
- Owner comfort: the card publishes owner stats next to a stranger's — same data already public on the site, but confirm the framing at scoping.
