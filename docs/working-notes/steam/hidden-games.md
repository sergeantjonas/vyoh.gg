# Steam — per-game privacy (hidden games)

**Status:** Active — **chunks 1–4 shipped 2026-08-20.** The api no longer names a hidden game on any surface: not the library, wishlist, upcoming calendar, achievement feeds, library completion, the recap's chapters, the OG card, the portrait's naming cards, the home first-played tile, or the live now-playing strip, and every `game/:appid/*` route 404s for a visitor. Aggregates still count hidden games anonymously, as chosen. Chunk 5 (retire the two hardcoded curation lists onto the `unfeatured` axis) is next; nothing is user-reachable until chunks 7–8 build the UI.

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

## Viewer resolution (chunk 2)

`OwnerGuard` exists to reject; the public Steam routes need the opposite — *who is asking*, with no gate on the answer. That lives in [viewer.ts](../../../apps/api/src/auth/viewer.ts) as three pieces:

- **`ViewerGuard`** is a guard only because a guard is the earliest hook that can inject `AuthService`. A param decorator receives just the `ExecutionContext` and cannot inject, so the resolution has to happen where DI reaches and be left on the request.
- **`@ViewerIsOwner()`** reads it. It defaults to `false` when the guard never ran, so a route that declares the parameter but forgets `@WithViewer()` serves the *public* projection to everybody, owner included. That is the right way round — the mistake is visible to the only person who can fix it, and it never leaks.
- **`@WithViewer()`** bundles the guard with `Cache-Control: private, no-cache`. Two viewers get different bytes from one URL, so a shared copy is the failure mode; nothing shared caches JSON today, and the header is what keeps that true when the caching layer changes.

`ViewerGuard` swallows resolution errors and answers `false`. A public read path must not 500 because the session table was unreachable — the honest degraded answer is "not the owner", which is correct for every visitor and merely dull for the owner.

## The write API (chunk 2)

`admin/steam-games` is owner-gated on **reads too**, and for a sharper reason than the roster's: an enumeration of the games the owner hid is precisely the secret the hiding exists to keep. `no-store` throughout, and all four routes are pinned by name in `conventions.spec.ts` — an ungated read here would defeat the feature while every public surface kept filtering correctly, which is exactly the kind of failure that is invisible in review.

Three shape decisions:

- **One `PATCH` rather than hide/unhide/feature/approve verbs**, mirroring `updateLolAccount`. Booleans in the DTO against timestamp columns, because the api owns the clock — a client that could send its own "hidden since" could write a row hidden in the *future*, and a row hidden in the future is a row visible now.
- **`reviewed` is its own field, not implied by a visibility change.** Approving a quarantined game and hiding it for good are both rulings and both clear the badge; they differ only on `hidden`. Folding review into visibility would make "leave it quarantined but write a note" unexpressible.
- **`DELETE` is distinct from `{ hidden: false }`.** Un-hiding keeps the row, and with it the note and the record that a decision was made here; deleting returns the game to plain default.

Rows the owner creates by hand are `reviewedAt`-stamped on arrival — a hand-made row *is* the ruling, so it must not land in the queue it came from. Only the poller mints unreviewed rows.

## Filtering the read paths (chunk 3)

**No `includeHidden` param.** The plan called for one, owner-gated; the viewer mechanism made it redundant. Who is asking already determines the answer, and a query param would have been a second way to ask the same question — one that has to be re-checked at every call site.

**The services take the curation sets as a required argument** rather than injecting the service and reaching for them. That is the load-bearing choice: a new read path does not compile until it has answered "whose view is this?". Injection would have let a new aggregation quietly default to the owner's view, which is the failure this whole feature is about. It also means one resolution per request is shared by a route that hits two services.

**Filter placement matters more than it looks.** In `getOwnedGames` the filter runs before the enrichment and 30-day-sparkline queries, so a hidden game's art paths and playtime series are never fetched — not fetched-then-dropped. `getOwnerWishlist` filters before name resolution, which is an upstream call per unknown appid.

**Limit-capped feeds filter in SQL, not in JS.** `achievements/recent` and `achievements/rarest` take a `limit`, and filtering after the `take` would return eight rows for a request for ten — a length that is itself the tell. Both use `visibleAppidFilter()`, a named `where`-fragment helper in the shared curation module, so the invariant still has one definition.

**Per-app routes refuse rather than filter.** The four `game/:appid/*` routes shape their response from a single appid, so `assertVisible()` throws `NotFound`. An empty achievements payload would say "this game has none" — false, and a tell. `NotFound` is what those routes already return for an untracked appid, so a hidden game is indistinguishable from one the owner never bought. `game/:appid/recap` needed no gate at all: it looks the game up in `getOwnedGames`, which already filtered, and its existing not-in-library `NotFound` fires.

**Two leaks found while wiring, not in the original survey:**

- **`/steam/summary` carries `currentGame`**, not just `/steam/player-state`. Both are chunk 4.
- **The Steam OG card** (`generateSteamGameCard`) renders the game's name into a public, cacheable, shareable image. It now reads the *public* curation unconditionally — an OG card has no viewer to be aware of, and a cached card naming a hidden game would be the one copy of that name to outlive the hiding.

**Internal callers had to choose explicitly**, which is what the required argument bought. The enrichment poller, the enrichment backfill script and the image prewarm all pass `NO_CURATION`: they are data maintenance on the owner's real library, and hiding a game from visitors is not a decision to stop tracking it.

## The live and named surfaces (chunk 4)

**Two independent copies of the now-playing leak**, and both had to be closed or the surfaces disagree about the same moment. `/steam/player-state` reads the poller's cached row; `/steam/summary` calls Steam per request. Neither returns a redacted placeholder — the session reads as *no session*, so the owner appears online and playing nothing. "Playing something private" would announce, at the exact moment it is happening, that there is something to hide, which is a worse tell than the title. The poller keeps writing the row and the play session; only the projection drops it, so the hours survive for the aggregates.

**The portrait splits on a line the feature already drew.** `lifetime`, `recent` and `posture` are pure aggregates — genre shares, counts, minutes — and keep counting hidden games. `anti`, `backlog` and `completion` name titles and see only the visible set. `backlog` is still *scored* against the unfiltered lifetime fingerprint: the recommendation stays calibrated on everything the owner actually plays, it just cannot name a hidden game as the pick.

One knowing inconsistency: the naming cards' own inner counts (tasted count, completion cohort size) run over the visible set, so they narrow while `posture` does not. That is the right way round — a card whose purpose is to put names next to a number should not count what it cannot name — but it does mean `posture.tastedCount` and `anti.tasted.count` can disagree by the number of hidden games in that cohort.

**The home first-played tile takes the public curation unconditionally**, like the recap's chapter selection and for the same reason: it names one game as the headline fact on `/`, and hiding a game rules it out of that slot for the owner too. Neither surface is viewer-aware, which also keeps every `/home/*` endpoint out of the viewer-aware set.

## Accepted leaks

Recorded so they don't get re-raised as defects:

- **`/img/steam/...` stays unfiltered.** It is appid-addressable, nginx-cached, carries no viewer context, and isn't enumerable. Someone who already knows the appid can confirm art exists; they learn nothing they didn't bring with them.
- **Aggregate totals include hidden hours**, by decision 2. A visitor diffing lifetime hours against the sum of listed games can infer that a gap exists — not what fills it. This is the intended trade.

## Chunk plan

| # | Scope | Status |
|---|---|---|
| 1 | `SteamGameCuration` migration, `packages/shared/src/steam/curation.ts` filter contract, cached `SteamGameCurationService` | **Shipped 2026-08-20** |
| 2 | Viewer resolution that never 401s + owner-gated `admin/steam-games` controller | **Shipped 2026-08-20** |
| 3 | Filter the itemized read paths — owned-games, achievements (recent / rarest / completion), wishlist + upcoming, game-recap, wishlist-hero, and a refusal gate on every `game/:appid/*` route | **Shipped 2026-08-20** |
| 4 | The identity leaks outside the list endpoints: `currentGame` on both live surfaces, the portrait's naming cards, the home first-played tile | **Shipped 2026-08-20** |
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
