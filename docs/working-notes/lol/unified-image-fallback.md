# vyoh.gg — Unified LoL image fallback (parked follow-up arc)

**Status:** Parked — proposed 2026-05-21 immediately after the profile-icon resolver (chunks 6.5a/b/c) shipped. Owner-stated principle: *the image proxy should always route images, with the fallback chain as the failure-tolerance layer.*

## Motivation

Today the `apps/web` codebase routes LoL images two different ways depending on the asset type:

- **Through the project image proxy** (`/img/lol/{type}/{id}/{patch}.webp`): champion variants, items, profile icons, runes, summoner spells, role icons. Each has WebP transcoding + immutable caching + an upstream-fallback chain via [fetchUpstreamChain](../../../apps/api/src/img/upstream.ts).
- **Directly to wiki** (`wiki.leagueoflegends.com/en-us/images/...`): champion squares (live-tab), ability icons (champion spell tooltips), minimaps, ranked emblems, the singleton gold/minion/ward/attack icons, and the `wikiStatIconUrl` / `wikiPingUrl` family.

The split is historical accident — the proxy was built to bridge DDragon's PNG-only catalog and grew piecemeal, while the wiki helpers were added later as straight URL builders because no proxy work was needed to make them functional.

Profile icons (shipped in 6.5) are now the only asset type where the proxy carries a wiki-primary + DDragon-fallback chain. The owner's stated principle says every other wiki-sourced image should follow the same pattern: web call sites resolve through the proxy; the proxy decides upstream priority and absorbs failures.

## Why unify

- **Failure tolerance.** Wiki outages today blank out the ability tooltips, live-tab champion squares, and rank emblems with no recourse. Routing through the proxy means the upstream chain can fall over to DDragon (where one exists) or to the most-recent cached copy.
- **One web-side URL shape.** Every component already imports `iconUrl(id, patch)`-style helpers from `_shared/assets/`. Today some return a proxy URL and some a wiki URL — the abstraction leaks.
- **WebP + transcoding for free.** Wiki serves PNG (sometimes 100KB+); the proxy already cuts ~30% via WebP. Real bytes on every cold tooltip.
- **Hide upstream from the browser.** No third-party referrer leaks (`wiki.leagueoflegends.com` in network panels), one connection pool, one cache surface.
- **Forward-compat with wiki URL drift.** If wiki renames `Foo_OriginalSquare.png` → something else, only the proxy needs an update — not every web call site.

## Surface inventory

Direct-to-wiki consumers (each becomes a proxy route in this arc):

| Helper | Used by | Proposed proxy route | Upstream chain |
|---|---|---|---|
| `wikiAbilityIconUrl(champion, ability)` | [use-champion-spells.ts](../../../apps/web/src/lol/matches/use-champion-spells.ts) | `/img/lol/ability/:championId/:slot/:abilityIndex/:patch.webp` | wiki ability icon → CDragon `/champion/{slug}/abilities/{slot}` |
| `wikiChampionSquareUrl(name)` | [live.tsx](../../../apps/web/src/routes/lol/$accountSlug/live.tsx) | already exists: `/img/lol/champion/:alias/square/:patch.webp` — switch the helper to use it | wiki square → CDragon `/champion/{slug}/square` |
| `wikiMinimapUrl(mapId)` | [match-map-overlay.tsx](../../../apps/web/src/lol/matches/match-map-overlay.tsx), [champion-position-heatmap.tsx](../../../apps/web/src/lol/champions/champion-position-heatmap.tsx) | `/img/lol/map/:mapId.webp` | wiki minimap → ??? (no clean DDragon equivalent; cache-only fallback) |
| `wikiRankedEmblemUrl(tier, year)` | [profile-rank-tile.tsx](../../../apps/web/src/lol/profile/profile-rank-tile.tsx), [profile-season-history.tsx](../../../apps/web/src/lol/profile/profile-season-history.tsx) | `/img/lol/rank/:tier/:year.webp` | wiki emblem → cache-only fallback (Riot doesn't publish emblems on a CDN) |
| `wikiGoldIconUrl()`, `wikiMinionIconUrl()`, `wikiWardIconUrl()`, `wikiAttackIconUrl()` | [game-icons.tsx](../../../apps/web/src/components/game-icons.tsx) | `/img/lol/ui/:name.webp` | wiki ui icon → cache-only fallback |
| `wikiStatIconUrl(stat)`, `wikiPingUrl(ping)` | not currently consumed in `apps/web`, but exported | `/img/lol/ui/:family/:name.webp` once consumed | same as above |

Notes on the inventory:

- **Ability icons** are the highest-value entry because wiki's ability tooltips are the surface most user-visible when wiki blinks. The bundle already carries `iconWikiName` per ability so the proxy can read it from Prisma the same way `profileIcon()` reads titles today.
- **Champion squares** are partly migrated already — `/img/lol/champion/:alias/square/:patch.webp` is the CDragon-backed route used everywhere except live-tab. Live-tab switched to wiki for visual fidelity reasons (CDragon's square art is the desaturated client variant); this arc would make the proxy upstream-prefer wiki and fall back to CDragon.
- **Minimaps and rank emblems** don't have a true second upstream. Their "fallback" is cache-only — the proxy still buys WebP transcoding + connection-pool unification + cache-after-first-hit resilience.

## Approach

Build a generic per-row upstream resolver pattern on `LolImageService`. Mirrors the profile-icon lazy-load:

```ts
private async loadX(): Promise<Map<K, string>> { /* lazy, sticky cache */ }
async assetX(...): Promise<Resolved> { /* return urls: [wikiUrl, ddragonUrl?, cacheOnly] */ }
```

Per surface:

1. **Ability icons (chunk A1)** — easiest win, biggest user-visible payoff. Cache `iconWikiName` per `(championId, slot, abilityIndex)` from the bundle. Wiki primary, CDragon `/champion/{slug}/abilities/{slot}` secondary.
2. **Champion squares (chunk A2)** — flip the live-tab consumer to use the existing proxy route. Update `LolImageService.champion()` to return `[wikiUrl, cdragonUrl]` for the `square` variant. The wiki square is `OriginalSquare`; the current proxy returns the desaturated client variant. Decide which variant becomes the primary (the wiki one is what the live tab uses today).
3. **Map / emblem / UI icons (chunk A3)** — bulk migration. These are deterministic-from-input, no Prisma lookup needed. Add proxy routes that build wiki URLs server-side, no fallback beyond cache.
4. **Sweep (chunk A4)** — remove the now-unused `wiki*Url` helpers from `apps/web` callers; keep them in `@vyoh/shared` as building blocks the proxy uses, but mark them server-internal. Possibly relocate them to `apps/api/src/img/wiki-url-helpers.ts` to make the boundary explicit.

## Out of scope

- Adding new wiki upstream sources the proxy doesn't already need.
- Changing the cache-hit / cache-miss semantics. WebP + `IMMUTABLE_YEAR` headers stay as-is.
- Touching Steam image routing (already uses multi-upstream fallback for hashed→legacy).

## Dependencies + risks

- **Bundle-derived id→title lookups** become a Prisma-touch hot path for the ability route. Memoize the same way `profileIconTitles` does. Refresh on a cron tick is fine.
- **Wiki rate limits.** Browser was hitting wiki directly; routing through the proxy concentrates that traffic on the API. Proxy cache hit rate should be very high (immutable headers + deterministic URLs), but watch for a spike on cold deploys.
- **Live-tab visual regression.** The existing `champion()` `square` variant returns CDragon's desaturated client art — flipping it to wiki-primary will make every other consumer of the same route render the wiki art. Either fork the variant (`square` vs `square-original`) or change behavior across the board and accept the visual drift.
- **CDragon-dependent components inherit fallback for free** once their upstream is wiki — but only if a CDragon equivalent exists. Map + emblem + UI icons don't have one, so their fallback is just the proxy's own cache.

## Done criteria

- `apps/web/src/**` contains zero direct `wiki.leagueoflegends.com/en-us/images/` URLs (helpers may still exist in `@vyoh/shared`, just not consumed by web).
- Every image render in the LoL views goes through `/img/lol/...`.
- Each new proxy route has a test covering the wiki-primary, fallback (where applicable), and cache-only behavior.
- A wiki blip during dev does not blank ability tooltips / champion squares — the fallback kicks in.

## Related

- [[lol-static-metadata-arc]] — shipped 2026-05-21; profile icons are the prototype this arc generalizes.
- [docs/working-notes/lol/rich-descriptions.md](./rich-descriptions.md) — separate parked arc; rich tooltips will inline images that this arc's proxy routes will serve.
