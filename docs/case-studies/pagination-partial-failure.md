# Pagination that survives partial failure

## TL;DR

The match list is paginated with `useInfiniteQuery` over a 20-row cursor. The interesting work is not on the frontend — it's the API-side backfill that materializes a page of summaries from up to 100 underlying Riot detail calls, each subject to independent rate-limit failure. Two structural decisions carry it: `Promise.allSettled` instead of `Promise.all` at two distinct fan-out points (fetch and upsert), so a single 429 sinks one detail rather than the whole page; and a *missing-set* convergence pattern where the client's natural retry refans only the still-missing IDs. The system converges to "page complete" in roughly one extra round-trip on the unhappy path, without any explicit retry queue, exponential backoff, or job table.

## Setup

A user lands on the Profile page and wants to see "Last 100 matches." Riot's match-v5 API gives this in two shapes:

- `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=100` — a paginated *index* of match IDs. One request, returns up to 100 strings.
- `GET /lol/match/v5/matches/{matchId}` — the *detail* for a single match. 100 calls.

The index call is cheap. The detail calls go through [the limiter chain described separately](./riot-rate-limits.md), where any one of them can return 429, time out, or hit the queue's deadline. Worst-case, on a cold cache with the limiter under pressure, 5–10% of those 100 detail calls fail in a single sweep.

The contract the frontend wants is: "give me a list of 100 match summaries, or tell me which ones are missing so I can ask again." The contract the API has to *not* give is: "if any of the 100 fails, the whole page fails."

## Promise.allSettled at the fan-out points

`backfillMissingMatches` has two distinct fan-out phases — fetch, then upsert — and each one is wrapped in `allSettled`:

```ts
// Phase 1: fetch all raw match data before any writes.
const fetched = await Promise.allSettled(
  missing.map(async (matchId) => {
    const raw = await this.riot.getMatchById(matchId, regional);
    const baseSummary = riotMatchToSummary(raw, puuid);
    const { items } = extractItems(raw, puuid);
    // … optional timeline fetch …
    return { matchId, raw, summary, items, rawTimeline };
  })
);

// … snapshot-attachment pass over the fetched batch …

// Phase 3: upsert all fetched matches.
const results = await Promise.allSettled(
  fetched.map(async (r) => {
    if (r.status === "rejected") throw r.reason;
    // … per-match upsert into match, matchDetailCache, matchTimelineCache …
  })
);

const failed = results.filter((r) => r.status === "rejected");
if (failed.length > 0) {
  this.logger.warn(
    `backfill: ${failed.length}/${missing.length} matches failed for ${puuid} — partial results returned`
  );
}
```

Two things load-bear here that aren't obvious from "use allSettled":

- **The fan-out happens in two phases for a reason that has nothing to do with failure handling.** Phase 1 fetches every match before *any* upsert because phase 2 needs to pick the chronologically newest match per ranked queue across the batch, then attach a snapshot to only that one. If we fetched-and-upserted in a single pass, parallel tasks would each see an empty DB for their queue and each claim to be "newest." Separating the phases is correctness, not resilience — but it happens to make the resilience cheap, because each phase has its own `allSettled` already.
- **Phase 3 re-throws inside the map.** `fetched` is itself a settled-results array; phase 3 walks it and throws on any `rejected` entry. That throw is then caught by the *outer* `allSettled`. The effect: a match that failed in phase 1 propagates as a phase-3 rejection rather than being silently dropped. The failure count at the bottom (`failed.length`) accounts for both layers.

The logged line — `backfill: 3/100 matches failed for {puuid} — partial results returned` — is the operational contract. An operator reading the log knows the page is partial; the user sees 97 cards instead of 100. The 3 missing IDs are still in the `missing` set for the next request.

## The missing-set retry pattern

The retry path is implicit in how `backfillMissingMatches` filters its work. It doesn't take a "what to fetch" list — it takes a *target* list and figures out what's already complete:

```ts
const fullysynced = await this.prisma.match.findMany({
  where: {
    puuid,
    matchId: { in: matchIds },
    OR: [{ remake: true }, { items: { isEmpty: false } }],
  },
  select: { matchId: true },
});
const have = new Set(fullysynced.map((m) => m.matchId));
const missing = matchIds.filter((id) => !have.has(id));
```

The `OR: [{ remake: true }, { items: { isEmpty: false } }]` clause is the "fully synced" test. A row is complete if it's a remake (no items expected) *or* if items are populated. A partial row — one that exists in the DB but failed to populate items — fails the test and lands back in `missing`.

That means: a user who refreshes the page after a partial-failure batch implicitly retries only the missing IDs. The cost of the retry is `missing.length` Riot calls, not 100. If the limiter has recovered, those calls succeed, the rows flip from partial to complete, and the next refresh shows the full page.

The convergence guarantee: each round-trip strictly shrinks the missing set or leaves it unchanged. There's no exponential backoff, no jitter, no retry budget — the *client's natural retry cadence* (page refocus, manual refresh, the next IntersectionObserver-triggered "load more") drives convergence. The system can sit in a partial state indefinitely without any background job; it converges only when there's user demand for the still-missing data.

This shape would be wrong for a write-heavy system where partial state is expensive. It's right for a read-derived cache where partial state is *cheap* — the user sees what's available, the missing data doesn't block anything else, and the next refresh tops it up.

## The infinite-query side

The frontend half is a stock `useInfiniteQuery` with a 20-row cursor:

```ts
return useInfiniteQuery({
  queryKey: ["lol", "matches", account?.region, account?.gameName, account?.tagLine, queue],
  queryFn: ({ pageParam }) => fetchMatchesPage(account, pageParam, MATCHES_PAGE_SIZE, queue),
  initialPageParam: 0,
  getNextPageParam: (lastPage, _allPages, lastPageParam) => {
    if (lastPage.length < MATCHES_PAGE_SIZE) return undefined;
    return lastPageParam + MATCHES_PAGE_SIZE;
  },
  enabled: account !== undefined,
});
```

`getNextPageParam` returning `undefined` is what stops the IntersectionObserver — when a page comes back with fewer than 20 rows, the user is at the end of their match history. An `IntersectionObserver` sentinel at the list bottom calls `fetchNextPage`; a "Load more" button calls the same function. Two triggers, one fetch path.

The interaction with partial failure: a page of 20 might return 18 (two failed). The page is "complete" from `useInfiniteQuery`'s perspective — it got an array back. The user sees 18 cards. The next refocus or refresh re-fetches that page, which calls `backfillMissingMatches` on those same 20 IDs, which sees 18 complete and 2 still missing — and tries those 2 again.

## HttpError as the protocol seam

The fetch helper unwraps the body's `message` field when present, falling back to `HTTP {status}`:

```ts
if (!res.ok) {
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.message === "string") message = body.message;
  } catch {
    // not JSON — keep fallback
  }
  throw new HttpError(res.status, message);
}
```

`HttpError` carries the status code, which lets downstream error boundaries branch:

- `404` (account not found): "We don't have this summoner cached — check the spelling?"
- `429` (rate limited): "Riot is rate-limiting us — back in a few seconds."
- `503` (Riot upstream down): "Riot is having a moment — try again."

The protocol seam is intentionally narrow — status code plus message. We don't carry typed error variants across the wire (no discriminated-union `error.kind = "RateLimited"` payload). The status code is enough for the UI; richer error context is logged on the server where it stays operationally useful without being part of the API contract.

## What this earns

- **Bounded blast radius on rate-limit pressure.** A single 429 takes out one detail, not the page. The frontend's "load more" still works; the missing rows show up on the next refresh.
- **Implicit convergence without a job table.** No `RetryQueue` model, no cron worker walking failed IDs, no exponential backoff state. The missing-set test runs every fetch; convergence is a consequence of the read query shape.
- **A frontend that doesn't know about partial state.** `useInfiniteQuery` sees an array; the user sees cards. Partial pages are indistinguishable from complete pages in the React tree — only the row count differs, and the row count was always going to vary anyway.

## What this doesn't earn

- **An explicit "this match failed permanently" signal.** A match that 404s on Riot's side (rare — usually only for tournament-stub games) stays in the missing set forever, costing one Riot call per page refresh until the user stops asking. A graveyard table for permanent failures is a reasonable extension; the system hasn't needed it yet.
- **Progressive streaming of in-flight results.** The current response is "wait for the whole batch, then return what we have." A planned SSE extension would push `{matchId, status: "ready" | "failed"}` events as each detail lands so the web app can swap skeleton rows for real cards progressively. The current global `useIsFetching` indeterminate top-bar covers the "something is happening" signal until that ships.
- **Runtime schema validation of Riot responses.** The shapes are typed end-to-end via `@vyoh/shared`, but a malformed Riot response would crash the per-match async — and land that match in the failed set rather than poisoning the whole page. The `allSettled` shape makes "trust the type system, isolate the failure" a defensible default. This was the framing of [a deliberately descoped case-study candidate](../working-notes/case-study-topics.md) — the resilience pattern absorbs the role schema validation would have played, without taking on the Zod/valibot dependency.

## Looking back

The shape that made this work is "use the read query to define what's missing." Every other resilience pattern — retry queues, backoff jitter, dead-letter tables — adds machinery that only earns its keep if the system writes a lot of partial state. A read-heavy cache that materializes from an upstream API can replace all of it with a `WHERE` clause that filters on "did this row complete," and let user-driven refreshes drive convergence. The interesting engineering is recognizing that you don't need the machinery.
