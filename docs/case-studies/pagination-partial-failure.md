# Pagination and partial-failure resilience

## Infinite scroll with useInfiniteQuery

The match list uses `useInfiniteQuery` with a 20-per-page cursor. An IntersectionObserver at the list bottom auto-fetches the next page; a manual "Load more" button exists as a fallback. The api route `/lol/.../matches?start=N&count=M` plumbs `start`/`count` directly through to Riot's match-v5 cursor.

## Promise.allSettled batching

The first time you ask for "Last 100 games" on an account with little cache, the api fans out up to 100 detail fetches behind the rate limiter. To prevent a single rate-limit-induced 429 from sinking the whole batch, `LolService.backfillMissingMatches` switched from `Promise.all` to `Promise.allSettled` — successful fetches land in the DB, failures are logged with a count, and the response returns whatever's now available. A retry from the user fans out only the still-missing IDs, so the system converges to the requested window in ~one extra round-trip on the unhappy path.

## Open: progressive streaming

A planned next step is an SSE endpoint that streams `{matchId, status: "ready" | "failed"}` events as each Riot detail lands, so the web app can swap skeleton rows for real cards progressively. The current global indeterminate top-bar (driven by TanStack Query's `useIsFetching`) covers the global signal until then.
