# Speculation Rules prefetch / prerender

**Status:** Chunks 1–5 shipped 2026-05-28 as the cheap manual-prefetch path (TanStack Query `prefetchQuery` on hover/touchstart, no Speculation Rules API yet). Match rows, champion grid items, Steam library tiles + rows, and nav links all warm their destination's primary query on a 150 ms hover (100 ms for nav — higher intent), with pointer-down firing immediately for the touch path. Chunk 6 (Speculation Rules `<script>` block) stays gated on the Start migration — it only earns its keep once cross-document navigation is real. See [tanstack-start-migration.md](tanstack-start-migration.md).

Read this before any work on prefetch heuristics; coordinate with TanStack Router's existing route-chunk prefetching to avoid duplication.

KB anchors: [06-performance.md §9.3 Speculation Rules API](~/.claude/knowledge/frontend-2026/06-performance.md). MDN: https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API.

---

## Why

The KB qualifies Speculation Rules as **"less useful for SPAs because TanStack Router already prefetches route chunks."** That's true for the JS bundle but **not for the data**:
- TanStack Router prefetches the route's JS module on hover.
- It does **not** prefetch the route's query data unless the route's `loader` is configured to do so (and even then, only after navigation has been triggered).
- The match-detail page makes 1–3 API calls (match, timeline, related). On a cold visit these add 200–600ms after click.

Speculation Rules can prefetch the **document** as well, which (when the document is the same SPA entry) doesn't help — but they can also issue arbitrary `prefetch` directives that we map to TanStack Query `prefetchQuery` calls on the route's loader. The combined effect: a match row hovered for 200ms triggers both the JS chunk prefetch (already happening) **and** the API data prefetch (new), so clicking lands on a fully-rendered detail page.

For pure SPAs without MPA semantics, the cleaner shape is **manual `queryClient.prefetchQuery` on hover/touchstart** without involving Speculation Rules at all. The Speculation Rules API earns its place when:
- There is **any** MPA-style navigation (post-Start migration would qualify).
- Or when prefetch behavior should be policy-driven by the document (e.g. "moderate eagerness on viewport-visible links").

**Default approach: ship the cheap version first (TanStack Query `prefetchQuery` on hover), then layer Speculation Rules when MPA semantics arrive via the Start migration.**

---

## What this is NOT

- **Not full prerender.** Prerender (`<script type="speculationrules">{ "prerender": [...] }</script>`) renders the page in the background; heavy and overkill for the SPA case. Prefetch the data only.
- **Not aggressive prefetching of everything visible.** Eagerness must be *moderate* — only on actual user interaction (hover ≥150ms, touchstart) to avoid paying the API cost for hovers that won't convert.
- **Not Sentry transaction noise.** Prefetch requests should not pollute web-vitals or error tracking attributes.

---

## Target outcome

After this arc, the following interactions trigger background data prefetch:

1. **Hovering a match row for 150ms** → prefetch match-detail + timeline queries.
2. **Hovering a champion grid item for 150ms** → prefetch champion-detail aggregations.
3. **Hovering a Steam library tile for 150ms** → prefetch Steam game detail.
4. **Hovering any nav link** for 100ms (faster threshold; nav clicks are higher-intent) → prefetch the route's primary query.
5. **Touchstart on mobile** triggers the same prefetch immediately (no 150ms wait — touch is high-intent).

The resulting click navigates to a fully-rendered page with data already in cache. Visible delta: the route-transition fade plays over real content instead of a skeleton.

Optional: when Start migration lands ([tanstack-start-migration.md](tanstack-start-migration.md)) and the site becomes MPA-shaped for crawlers + first paint, **add** a `<script type="speculationrules">` block for moderate-eagerness link prefetching as a layer on top.

---

## Chunked plan

Status: 1–5 shipped 2026-05-28; commits noted inline. 6 deferred to Start migration.

### Chunk 1 — `useHoverPrefetch` hook (shipped: `216821f`)

New file `apps/web/src/lib/use-hover-prefetch.ts`:

```ts
export function useHoverPrefetch<T>(
  trigger: () => void,
  { delay = 150 }: { delay?: number } = {},
) {
  const timer = useRef<number | null>(null);
  const onPointerEnter = useCallback(() => {
    timer.current = window.setTimeout(trigger, delay);
  }, [trigger, delay]);
  const onPointerLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onPointerDown = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    trigger();
  }, [trigger]);
  return { onPointerEnter, onPointerLeave, onPointerDown };
}
```

Test: trigger fires after delay on enter; cancels on leave; fires immediately on pointerdown.

### Chunk 2 — Apply to match rows (shipped: `26ab2b3`)

- [match-row.tsx](../../../apps/web/src/lol/matches/match-row.tsx): add `useHoverPrefetch(() => queryClient.prefetchQuery(matchDetailQuery(matchId)))`.
- Verify the `matchDetailQuery` shape — should be a query options object that's stable per matchId.
- Test: hovering for 150ms invokes `prefetchQuery`; hovering for 100ms does not.
- Measure: match-detail INP after this lands; should drop substantially for the hover-then-click path.

### Chunk 3 — Apply to champion grid + Steam library (shipped: `7e1c4c3`)

- Same pattern, different query keys.
- Champion grid items prefetch champion-detail aggregations.
- Steam library tiles prefetch game-detail.

### Chunk 4 — Apply to nav links (shipped: `1642910`)

- Nav links use a shorter delay (100ms) — nav clicks are high-intent.
- Steam nav item → `steamOwnedGamesQueryOptions()`; Patches → `patchListQueryOptions()`; LoL account rows → `prefetchCachedMatches(qc, account)` (infinite query).
- Home + Status left bare — neither has a single primary query worth prefetching.

### Chunk 5 — Mobile touch path (verified via test, real-device sim owner-side)

- The hook handles `pointerdown` synchronously (no 150ms wait); on touch this fires before `click` → before route nav, so the prefetch lands as the finger touches.
- Hook-level immediacy is covered by [use-hover-prefetch.test.ts](../../../apps/web/src/lib/use-hover-prefetch.test.ts); wired-surface pass-through covered by a `pointerDown` assertion in [library-tile.test.tsx](../../../apps/web/src/steam/library/library-tile.test.tsx).
- Real-device verification (Chrome DevTools mobile sim → Network panel under Slow 3G, tap a tile, observe prefetch fires on `pointerdown` while the route nav fires on `click`): owner-side bench check. Expected head start ~50ms on mobile networks.

### Chunk 6 — (Conditional) Speculation Rules for Start migration

- **Only after Start migration lands.** If/when there is real cross-document navigation, add a `<script type="speculationrules">` block per [06-performance.md](~/.claude/knowledge/frontend-2026/06-performance.md):

  ```html
  <script type="speculationrules">
  {
    "prefetch": [{
      "source": "document",
      "where": { "and": [{ "href_matches": "/*" }, { "not": { "selector_matches": "[data-no-prefetch]" } }] },
      "eagerness": "moderate"
    }]
  }
  </script>
  ```
- Mark high-cost or auth-required links with `data-no-prefetch`.

---

## Files in scope

New:
- `apps/web/src/lib/use-hover-prefetch.ts` + test

Modified:
- `apps/web/src/lol/matches/match-row.tsx` (Chunk 2)
- `apps/web/src/lol/champions/champion-table.tsx` (Chunk 3)
- Steam library tile (Chunk 3)
- `apps/web/src/components/nav.tsx` (Chunk 4)
- `apps/web/index.html` (Chunk 6, conditional)

---

## Risks / open questions

- **Wasted API calls.** Each prefetch is an API request. If a user idly hovers across 20 match rows in 5 seconds, that's 20 prefetches the user may not have wanted. Mitigation: 150ms delay catches "scanning" vs "intent." Measure via API logs after rollout — if waste is >50%, raise the delay.
- **TanStack Query staleTime.** Prefetched data is only useful if the actual page load doesn't refetch immediately. Verify the per-query `staleTime` is at least the typical hover-to-click latency (~5s). Most existing queries should be fine; check.
- **Riot rate limiter.** [apps/api/src/lol/](../../../apps/api/src/lol/) carries a Bottleneck-based Riot rate limiter. Prefetch-driven request bursts must not starve actual navigations. Each prefetch shares the same queue; priority can stay default. Watch for rate-limit errors after rollout; if seen, gate prefetch through a separate low-priority queue.
- **Steam API rate.** Same concern. Steam's per-key rate is more forgiving but not unlimited.
- **Bundle impact**: zero. Just a hook.

---

## Reduced motion

Not motion-related. No `prefers-reduced-motion` interaction.

`Save-Data` is the relevant signal: if `navigator.connection.saveData === true`, **skip prefetch entirely** to respect the user's bandwidth preference. Add to the hook:

```ts
if ((navigator as any).connection?.saveData) return { onPointerEnter: noop, onPointerLeave: noop, onPointerDown: noop };
```
