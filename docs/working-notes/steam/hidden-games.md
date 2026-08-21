# Steam — per-game privacy (hidden games)

**Status:** Active — **chunks 1–4 shipped 2026-08-20, chunks 5–6 on 2026-08-21.** The api no longer names a hidden game on any surface: not the library, wishlist, upcoming calendar, achievement feeds, library completion, the recap's chapters, the OG card, the portrait's naming cards, the home first-played tile, or the live now-playing strip, and every `game/:appid/*` route 404s for a visitor. Aggregates still count hidden games anonymously, as chosen. Both hardcoded curation lists are gone — the overlay table is now the only source of curation, on either axis — and a newly-purchased game now arrives quarantined instead of published. The web's fifteen viewer-aware reads are viewer-scoped and send the session cookie, so the owner's browser now actually gets the owner's projection. The feature is **reachable** as of chunk 7: the owner can hide or restore a game from the library hovercard or the game-detail chip row. Chunk 8 (the `/status` overlay table + the needs-review nav badge) is next, then the chunk-9 lint.

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

## Retiring the hardcoded lists (chunk 5)

Migration `20260821035000_seed_steam_curation_unfeatured` seeds the two appids — 1034140 (Subverse) and 1091500 (Cyberpunk 2077) — with `unfeaturedAt` and `reviewedAt` set and `hiddenAt` left null, so both stay fully visible and neither lands in the needs-review queue a hand-made ruling came from. `ON CONFLICT DO NOTHING` keeps it safe against a restore that already has them.

`recap-curation.ts` is **deleted**, and the mirroring comment it carried goes with it. `landing-config.ts`'s `HIDDEN_APPIDS` is deleted too — it turned out to have **no production consumer at all**, only its own declaration and a test asserting the ids were integers. The list that the api's mirror comment told you to "keep in sync" was already inert on the web side, which is the clearest possible argument for the table.

`SteamMomentsService` takes `curation` as a **required** argument on all three public methods rather than injecting the service, matching how chunk 3 threaded the read paths: a new detector cannot compile without deciding what it does about curation. `now`'s default was dropped in the same change — every caller already passed it, and TypeScript forbids a required parameter after an optional one, so keeping the default would have forced `curation` to be optional and defeated the point.

Both recap consumers iterate `excludeUnfeaturedGames(...)` rather than guarding inside the loop, per the repo convention the remake filter established — the `for … if (…) continue` shape is what hid ten remake sites from a dedicated sweep.

**How to probe this at runtime, and how not to.** Clearing `unfeaturedAt` on a curated game and expecting it to appear as a chapter proves nothing: `selectChapters` caps steam-subject at 5, and if five better-scoring games already fill the cap, the un-curated game cannot surface whether the overlay works or not. That probe came back negative against a *correct* implementation. The valid experiment is the inverse — curate out an appid that is currently a chapter. Doing that to 2584270 removed it from both the steam-subject and the steam-moment stream (proving the threading reaches both consumers) and a sixth game backfilled the freed slot, proving the filter runs before the cap rather than after it.

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

**The wiring the controller spec cannot check.** Chunk 2 shipped without `imports: [AuthModule]` on [SteamModule](../../../apps/api/src/steam/steam.module.ts), and the api refused to boot: Nest resolves a guard's own dependencies from the module that declares the *controller*, not from the module that defined the guard. The spec passed anyway, because a Nest testing module lists its own providers — hand-providing `AuthService` there proves nothing about a wiring that cannot start. Four sibling modules already carried the import with a comment explaining why, which is what makes this a lint rather than a note: `conventions.spec.ts` now walks every `*.module.ts`, resolves each declared controller, and fails when one reaches for `OwnerGuard`/`ViewerGuard`/`WithViewer` without the import. The paired fixture test writes the broken wiring to a temp dir and asserts the lint reports it, so the lint cannot pass vacuously.

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

## Quarantining new purchases (chunk 6)

The insert is where privacy has to default, because the poller runs unattended: a game bought at 21:00 is public within fifteen minutes otherwise, and no UI the owner has to visit can beat that. So `syncOwnedGames` mints a `SteamGameCuration` row with `hiddenAt` set and `reviewedAt` null for every appid in `diff.added`, **inside the same transaction as the `SteamOwnedGame` insert** — a crash between the two would publish a game nobody approved.

Three things narrow it to genuinely new titles:

- **`added`, never `reappeared`.** `diffOwnedGames` already separates *never seen* from *seen, removed, came back*. A returning game keeps whatever ruling it had; re-quarantining it would silently revoke an approval.
- **`skipDuplicates: true`** covers the case where the overlay row outlived the owned-game row (hidden before purchase, or refunded and rebought) — a plain insert would overwrite the owner's own decision with a fresh quarantine.
- **The existing library is untouched on first run.** Every currently-owned appid is already in `SteamOwnedGame`, so it classifies as `persisted`; the first poll after this ships quarantines nothing. Worth knowing before reading the deploy's poller log as a no-op.

`invalidate()` fires after the commit and only when something was minted. Inside the transaction it would be worse than useless: a read landing mid-transaction repopulates the cache from pre-insert state and holds the new game visible for a full TTL. The spec pins this by snapshotting the invalidate count at the moment the transaction callback returns and asserting it is still 0.

## Viewer-scoped query keys (chunk 7)

Fifteen routes carry `@WithViewer()`, so fifteen web reads had to stop treating one URL as one cache entry. Each `*QueryOptions()` factory takes `isOwner` and appends `viewerScope(isOwner)` — `"owner"` or `"public"` — as the **last** key segment, which keeps existing prefix invalidation (`["steam", "game", appid]`) working unchanged.

The scope defaults to public wherever it is optional, and that is the same argument the api's `@ViewerIsOwner()` makes: a call site that forgets to ask serves the owner a visitor's view, which is visible to the only person who can fix it and cannot leak the other way. It also means the four route loaders needed no changes — SSR *should* prime the public key, because a loader runs on the server where the visitor's cookie is out of scope.

**The cookie is the half that fails silently.** None of these fetches sent `credentials: "include"`, so even with perfect keys the api would have seen an anonymous request and answered the public projection — which then sits in the owner-scoped entry looking entirely correct. Both halves are now asserted per hook in [use-steam-hooks.test.tsx](../../../apps/web/src/steam/use-steam-hooks.test.tsx), including a paired case for the four Steam reads that are *not* viewer-aware and must not send it.

Two smaller consequences:

- **Prefetches take the viewer's scope, not the default.** The nav's Steam hover-prefetch and the library row/tile achievement prefetch would otherwise warm an entry the destination never reads for the owner — a prefetch that silently stops prefetching.
- **`keepPreviousData` on every viewer-scoped read.** The viewer query resolves a tick after hydration, so the key changes under an already-mounted component; without it every Steam surface drops to its skeleton for one round-trip on each owner load.

The test fallout was more interesting than the change. Eight test files broke, and the second-order failure is worth remembering: `mockResolvedValue(new Response(...))` hands *the same* `Response` to every call, and a body can only be read once — so the viewer query drank the response the assertion was waiting for. `seedViewer(client)` ([mock-viewer.ts](../../../apps/web/src/auth/mock-viewer.ts)) puts the viewer in the cache instead, which also keeps these tests clear of the unmocked-fetch guard in `test-setup.ts`.

## The in-context hide toggle (chunk 7)

One button, in the place the owner noticed the game: `HideGameButton` on the game-detail chip row, and on the library **hovercard** — which both the row and the grid tile already share.

**Why the hovercard rather than the card.** Both list surfaces wrap their entire card in an `<a>`. A `<button>` inside an anchor is invalid HTML and a nested-interactive a11y failure, so an absolutely-positioned control on the tile was never on. The hovercard is already the surface that opens over the card, its content is interactive while hovered, and one insertion point covers both surfaces — [library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) is shared. The press still calls `preventDefault()` + `stopPropagation()`, because the trigger it sits inside is a link.

**The state comes from the admin list, not the game payload.** `useGameCuration(appid)` reads `useAdminSteamGames()` and looks the appid up. A `hidden` field on `SteamOwnedGame` would be one forgotten projection away from announcing exactly what the feature conceals, and the list is a single cached request for the whole page, so a library of rows costs no more than one game. It also only mounts when a hovercard opens.

**Any deliberate press is a ruling**, so `reviewed: true` travels with every flag change — the owner cannot approve a quarantined game and still be asked about it. The inverse (keep it hidden, stop asking) is a two-state edit and belongs on the chunk-8 overlay table, not on a one-button chip. A quarantined row is marked with a dashed border and a tooltip suffix rather than a second control.

The button renders **nothing** for a visitor rather than rendering disabled. `OwnerAction`'s own doc comment draws that line: disable-in-place pays where the surrounding data is worth reading anyway, and a locked "Hide from visitors" beside every game describes a capability the page cannot offer.

`ownerRequest` also learned that a 204 has no body to parse — `res.json()` on an empty body throws, so the `DELETE` route would have looked like a failed request.

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
| 5 | Retire the two hardcoded lists onto the **unfeatured** axis; point [steam-moments.service.ts](../../../apps/api/src/recap/steam-moments.service.ts) and [recap-subjects.service.ts](../../../apps/api/src/recap/recap-subjects.service.ts) at the service, and drop the hand-mirrored web copy | **Shipped 2026-08-21** |
| 6 | Quarantine newly-inserted rows in the owned-games poller | **Shipped 2026-08-21** |
| 7 | Web: viewer-aware query keys + an in-context hide toggle on the library tile/row and game detail | **Shipped 2026-08-21** |
| 8 | Web: `/status` hidden-games section + the owner needs-review indicator (nav badge) | |
| 9 | `conventions.spec.ts` lint for `excludeHiddenGames` — both the `.filter()` and the `for…continue` shapes, per the remake precedent — plus the repo-conventions entry | |

## Emit-shape survey

Read paths were classified before any were changed, which is what reduced 36 candidate sites to 8. Recorded because the classification is the expensive part and it will go stale silently:

- **Numbers only — no filter needed.** All eight `home/*` services (lifetime-totals, today, weekly-totals, session-lengths, day-split, chronotype, activity-intensity), `steam-chronotype.service.ts`, `subject-anchor.service.ts`, `play-sessions.service.ts`.
- **Identity, already gated on the hardcoded list** (so chunk 5 is a repoint, not new filtering): `recap/steam-moments.service.ts`, `recap/recap-subjects.service.ts`.
- **Identity, unfiltered today** — the real work: `steam/portrait.service.ts`, `steam/player-state.service.ts`, and the Steam branch of `home/home-first-played.service.ts`, plus the chunk-3 list endpoints.
