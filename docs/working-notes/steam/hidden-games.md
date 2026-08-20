# Steam — per-game privacy (hidden games)

**Status:** Active — **chunk 1 shipped 2026-08-20** (`SteamGameCuration` table, the two-axis filter contract in `@vyoh/shared`, and the cached `SteamGameCurationService`). Nothing reads the overlay yet; chunks 3–5 are what make it visible. Chunk 2 (the owner-only write API) is next.

Read this when: touching any Steam read path that names a game, the recap's subject-chapter selection, the now-playing strip, or the owned-games poller.

## Why

The owner does not want every title in their library named to friends and visitors on vyoh.gg. The request enumerated wishlist, activity and achievements, which reads as *everywhere* rather than as a request for per-surface granularity — so the default is that a hidden game is hidden on every surface, and any exception is deliberate.

Scope limit worth stating once: this hides games **on vyoh.gg**. The owner's Steam profile is a separate surface with its own privacy settings, and a friend reading the Steam client sees whatever *Game details* is set to there. This feature cannot and does not change that.

## Decisions

Four calls the owner made up front, all of which shape the architecture rather than just the UI:

1. **The owner still sees hidden games.** Not a hard exclude. This is the decision that forces every affected response to become viewer-aware, and it is the reason `curationForOwner()` exists.
2. **Aggregates count hidden games anonymously.** Hours, sessions and hour-buckets keep including them; the game is never named. This is also the cheaper implementation — the eight numeric `home/*` services need no changes at all, because they emit no identity.
3. **New titles are quarantined, and the owner is told.** A newly-discovered appid is private on arrival and stays private until the owner rules on it, with a needs-review indicator visible on any owner visit rather than only on `/status`.
4. **Now-playing in a hidden game shows nothing** — the page reads idle, rather than "playing something private", which would be a worse tell than the game's name.

## Two axes, not one flag

The overlay carries **two independent** nullable timestamps, mirroring how `LolAccount` took `hiddenAt` and `syncPausedAt` separately rather than collapsing into a status enum:

- **hidden** (`hiddenAt`) — privacy. Never named to a visitor, anywhere.
- **unfeatured** (`unfeaturedAt`) — editorial. Listed normally; never promoted to a subject chapter on `/`.

Hiding implies unfeaturing; unfeaturing implies nothing about privacy. The first cut of the plan had chunk 5 simply *absorbing* the two hardcoded curation lists (`RECAP_HIDDEN_APPIDS` in [recap-curation.ts](../../../apps/api/src/recap/recap-curation.ts) and `HIDDEN_APPIDS` in [landing-config.ts](../../../apps/web/src/home/landing-config.ts)) into the new privacy flag. That would have been wrong, and the existing comment says why: Cyberpunk 2077 is on those lists because it has *"high lifetime hours, but stale; don't feature on `/`"*. That is art direction, not secrecy. Collapsing the axes loses "fine in my library, just don't make it a hero chapter", and worse, un-hiding a game for privacy would silently re-promote it to a chapter.

Both existing entries therefore migrate to **unfeatured**, not hidden, and current behaviour is preserved exactly.

## Data model

`SteamGameCuration` is keyed on the bare appid and is deliberately **not** a column on `SteamOwnedGame` nor an FK to it. Three cases break that shortcut: a wishlisted title is unowned by definition, a family-shared title produces `SteamPlaySession` rows without ownership (that model's own comment records why its `appid` is non-FK), and pre-hiding a game *before buying it* is the whole point of keeping a purchase private.

`reviewedAt` is the quarantine mechanism: a row with `hiddenAt` set and `reviewedAt` null is awaiting the owner's ruling and is counted by the review badge. Deliberately hiding a game sets both — the decision is already made.

The migration creates the table **empty**, which is what keeps the existing 195-game library out of quarantine. Only appids the poller *newly inserts* get quarantined (chunk 6).

## The SSR hazard

The four Steam route loaders ([wishlist](../../../apps/web/src/routes/steam/wishlist.tsx), [upcoming](../../../apps/web/src/routes/steam/upcoming.tsx), [portrait](../../../apps/web/src/routes/steam/portrait.tsx), [achievements](../../../apps/web/src/routes/steam/achievements.tsx)) all `ensureQueryData`, and `setupRouterSsrQueryIntegration` dehydrates that into the client cache **as authoritative**. A loader runs server-side, where the visitor's cookie is not in scope — the same constraint documented at length in [use-viewer.ts](../../../apps/web/src/auth/use-viewer.ts), which is why the viewer query is client-only.

So a naively viewer-aware endpoint would have the owner's browser hydrate the *public* (filtered) payload and treat it as fresh. The fix is to put `isOwner` **into the React Query key**: SSR primes the public key, and an owner's client fetches a different key. No hydration mismatch, no manual invalidation, no SSR cookie forwarding (technically reachable via `getWebRequest` in Start 1.168, but it would make the owner's HTML uncacheable for no gain).

Cache-safety was checked rather than assumed: nginx `proxy_cache` is scoped to `/img/*` only, so no JSON endpoint is shared between viewers by a cache. Viewer-dependent responses still get `Cache-Control: private`.

## Accepted leaks

Recorded so they don't get re-raised as defects:

- **`/img/steam/...` stays unfiltered.** It is appid-addressable, nginx-cached, carries no viewer context, and isn't enumerable. Someone who already knows the appid can confirm art exists; they learn nothing they didn't bring with them.
- **Aggregate totals include hidden hours**, by decision 2. A visitor diffing lifetime hours against the sum of listed games can infer that a gap exists — not what fills it. This is the intended trade.

## Chunk plan

| # | Scope | Status |
|---|---|---|
| 1 | `SteamGameCuration` migration, `packages/shared/src/steam/curation.ts` filter contract, cached `SteamGameCurationService` | **Shipped 2026-08-20** |
| 2 | Optional-owner param decorator (resolves the viewer without ever 401ing) + owner-gated `admin-steam-games` controller: hide / unhide / unfeature / approve / list | |
| 3 | Filter the itemized read paths — owned-games, achievements (recent / rarest / completion), wishlist + upcoming, game-recap, wishlist-hero. Owner-gated `includeHidden`, `Cache-Control: private` | |
| 4 | The identity leaks outside the list endpoints: suppress `currentGame` in [player-state.service.ts](../../../apps/api/src/steam/player-state.service.ts), the game refs in [portrait.service.ts](../../../apps/api/src/steam/portrait.service.ts), and the Steam branch of `home-first-played.service.ts` | |
| 5 | Retire the two hardcoded lists onto the **unfeatured** axis; point [steam-moments.service.ts](../../../apps/api/src/recap/steam-moments.service.ts) and [recap-subjects.service.ts](../../../apps/api/src/recap/recap-subjects.service.ts) at the service, and drop the hand-mirrored web copy | |
| 6 | Quarantine newly-inserted rows in the owned-games poller | |
| 7 | Web: viewer-aware query keys + an in-context hide toggle on the library tile/row and game detail | |
| 8 | Web: `/status` hidden-games section + the owner needs-review indicator (nav badge) | |
| 9 | `conventions.spec.ts` lint for `excludeHiddenGames` — both the `.filter()` and the `for…continue` shapes, per the remake precedent — plus the repo-conventions entry | |

## Emit-shape survey

Read paths were classified before any were changed, which is what reduced 36 candidate sites to 8. Recorded because the classification is the expensive part and it will go stale silently:

- **Numbers only — no filter needed.** All eight `home/*` services (lifetime-totals, today, weekly-totals, session-lengths, day-split, chronotype, activity-intensity), `steam-chronotype.service.ts`, `subject-anchor.service.ts`, `play-sessions.service.ts`.
- **Identity, already gated on the hardcoded list** (so chunk 5 is a repoint, not new filtering): `recap/steam-moments.service.ts`, `recap/recap-subjects.service.ts`.
- **Identity, unfiltered today** — the real work: `steam/portrait.service.ts`, `steam/player-state.service.ts`, and the Steam branch of `home/home-first-played.service.ts`, plus the chunk-3 list endpoints.
