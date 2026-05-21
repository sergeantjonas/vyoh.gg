# vyoh.gg — Lazy ability descriptions (parked follow-up arc)

**Status:** Parked — proposed 2026-05-21 immediately after the 6.5 sync run hit ~58/447 wiki 429s on cold-start (a recurrence of the original arc's known caveat). Owner's question: *"could we not populate as we need rather than getting EVERYTHING?"*

## Motivation

The static-metadata pipeline has six sync paths today, five of which fetch a single bulk Lua module per cron tick:

| Sync path | API shape | Calls/tick | Lazy feasible? |
|---|---|---|---|
| `syncItems` | `Module:ItemData/data` bulk Lua (~410KB) | 1 | No — wiki has no per-item endpoint |
| `syncChampionsAndAbilities` | `Module:ChampionData/data` bulk Lua | 1 | No — same |
| `syncSummonerSpells` | DDragon `summoner.json` | 1 | No — no per-row API |
| `syncPerks` | DDragon `runesReforged.json` | 1 | No — same |
| `syncProfileIcons` | `Module:IconData/data` bulk Lua (~540KB) | 1 | No — same |
| **`syncChampionAbilityDescriptions`** | `Template:Data {Champion}/{Ability}` + `action=parse` | **~800+** | **Yes** |

The first five paths are bulk-only because wiki/DDragon offer no per-row addressable resource. Ability descriptions are the outlier: each ability has its own wiki template page (`Template:Data Ahri/Orb of Deception`, `Template:Data Maokai/Sap Magic`, etc.), and we pull *all* of them every 6h regardless of whether the player ever views that champion. On a cold start the sequence fires fast enough that wiki rate-limits the tail (~58 of 447 today; expected to grow as the champion roster does), and the cron tick re-fires the same calls every 6h even after the first batch lands.

**The 429 spam is symptomatic of a real waste:** the long tail of unplayed champions (the average player touches ~20–40 champions; the roster is 170) gets fetched repeatedly with no consumer.

## What stays bulk, and why

Items, champions, summoner spells, perks, and profile icons all stay on the cron-driven bulk-sync path. Their sync cost is *one* fetch each. Lazy-fetching a single item would require pulling the same 410KB Lua module to resolve one id; that's strictly worse than what we have today.

## What goes lazy: ability descriptions

Switch `syncChampionAbilityDescriptions` from "always fetch all" to "fetch on first read." The skeleton already in place:

- `LolChampionAbility` rows are populated up front by `syncChampionsAndAbilities` (name + slot + abilityIndex, sourced from the champion-data bulk module). Only `descriptionWikitext` / `descriptionHtml` / `iconWikiName` are missing on cold start.
- A new server resolver `ensureAbilityDescription(championId, slot, abilityIndex)` checks the row's freshness (does its `wikiSyncedPatchVersion` match the current patch?) and either returns the cached fields or fetches `Template:Data` + `action=parse`, persists, and returns.
- Concurrent requests for the same ability are deduplicated in-process so a champion-detail page hover spam can't fan out 20 wiki calls — one `Map<key, Promise>` keyed by `${championId}:${slot}:${abilityIndex}` collapses them.

**Re-fetch policy:** patch-version watermark on each ability row. When the patch bumps, every row becomes stale and re-fetches on next request. Within the same patch, an ability is fetched at most once across all viewers. This catches balance-patch description rewrites within one request after the patch lands, while keeping the per-patch wiki budget proportional to *played* champions.

## Approach

### Chunk L1 — backend resolver + lazy endpoint

- Add `wikiSyncedPatchVersion` (nullable string) to `LolChampionAbility`. Migration: pure additive.
- Add `ensureAbilityDescription(championId, slot, abilityIndex)` to `LolStaticSyncService`. Returns the persisted ability row's `{descriptionWikitext, descriptionHtml, iconWikiName}`. Internally:
  - Reads the row from Prisma.
  - If `wikiSyncedPatchVersion === currentPatchVersion` → return cached.
  - Else → fetch `Template:Data X/Y`, render via `action=parse`, upsert, return. Dedupe concurrent calls via in-process `Map<key, Promise>`.
- Add `GET /lol/static/ability/:championId/:slot/:abilityIndex` controller route hitting the resolver. Returns a small `LolAbilityDescriptionDto` (description fields + icon). Cache-Control on the response is short (`max-age=300` is enough — the client will TanStack-Query cache it longer).
- Remove the call to `syncChampionAbilityDescriptions` from `syncAll()`. The method can stay as a manual entry point for full warmup if anyone wants it. Update the `syncAll` return shape.
- Tests in the same commit: resolver dedup, fresh-row fast-path, stale-patch refetch, network 429 graceful degradation (return whatever's in the DB, don't throw).

### Chunk L2 — web switchover

- New hook `useAbilityDescription(championId, slot, abilityIndex)` — TanStack Query against the new endpoint. `staleTime: Infinity` because the server already handles patch invalidation. Query key includes `championId+slot+abilityIndex+patchVersion`.
- `useChampionSpells(championName)` keeps its current bundle-derived synchronous shape for `iconUrl` + `name`, but `description` becomes a per-spell async fetch resolved by `useAbilityDescription`. The consumer ([match-skill-order.tsx](../../../apps/web/src/lol/matches/match-skill-order.tsx)) renders the tooltip with name + icon immediately and streams in the description when ready. Skeleton/placeholder for the description body.
- Tests in the same commit: skeleton renders synchronously, description fills in after fetch resolves.

## Risks

- **First-hover latency.** Each ability's first view per patch eats ~200–400ms (wiki RTT + `action=parse`). The icon + name render instantly from the bundle; only the description body is blocked. Match-skill-order today is the only consumer, and its tooltip is hover-triggered — there's a natural ~100ms hover-delay buffer before the user even reads the description.
- **Wiki 429 on a hot champion-detail page.** If a future champion-detail page eagerly renders all 5 ability tooltips on mount (instead of on hover), and 50 users hit that champion the moment a new patch ships, the wiki could 429. Dedup helps within a single API process; multi-process needs a shared lock (Redis when it lands) or just tolerance — the resolver should return DB-cached values on 429 instead of throwing, so users see the previous patch's description momentarily and the next view gets the current one.
- **Empty-state UX on cold-start dev DBs.** A fresh-cloned dev DB has zero ability descriptions until something hovers a tooltip. The skeleton state must look intentional, not like a broken tooltip. Reasonable solution: render `name` + `icon` synchronously, and the description area shows a one-line shimmer until the fetch resolves. Same skeleton-mirrors-layout rule from `docs/repo-conventions.md`.
- **Per-ability vs per-champion granularity.** This note proposes per-ability. Per-champion (5 abilities at once) is also reasonable — concentrates wiki traffic but renders the full champion in one go. Decide before chunk L1; per-ability is simpler and recommended unless tooltip rendering is changed to eager-render-all.

## Out of scope

- Items, champions, profile icons, perks, summoner spells — these stay bulk-cron. Lazy doesn't help them.
- Image binaries — already lazy via the image proxy. Not in question.
- Replacing the cron tick entirely — items + champions + profile icons still need it. Cron tick gets *shorter*, not removed.
- Changes to `descriptionHtml` rendering (still `stripWikitext` plain-text). The [[rich-descriptions]] arc owns that.

## Done criteria

- Cron tick wall time drops from minutes (~800 wiki calls serialized) to seconds (5 bulk calls).
- A cold-cloned dev DB serves the match-skill-order tooltip on every champion, with the description streaming in within a second of hover.
- A patch bump (manually simulated by clearing `wikiSyncedPatchVersion` on one ability row) triggers a refetch on the next view.
- Zero 429s in `pnpm exec tsx prisma/run-static-sync.ts` output on cold-cloned DB.

## Related

- [[lol-static-metadata-arc]] — shipped 2026-05-21; this is a tuning pass on its cron sync, not a replacement.
- [[unified-image-fallback]] — different parked arc, covering image upstream routing.
- [[rich-descriptions]] — separate parked arc; lazy descriptions and rich-HTML rendering compose cleanly (resolver returns HTML, web does whichever rendering the rich-descriptions arc has shipped).
