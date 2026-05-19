# Tabs as routes — moving match-detail navigation from a query param to nested path segments

> The match-detail page in vyoh.gg is the densest single surface in the app: hero, team blocks, builds, timelines, skill order, lane phase, and a queue of owner-only panels coming. The MDN1–MDN4 arc broke it into three tabs (Recap / Your game / Timeline) and then moved tab state from `?tab=recap` to `/recap` — a small URL change with a surprisingly wide blast radius across motion, scroll, and skeleton.

## TL;DR

- **The match-detail page outgrew a single scroll.** Eight sections were already there with six more queued. The fix was three tabs, but the interesting decisions were where tab state lives and how the page-chrome around it behaves.
- **Tabs as routes, not as state.** Initial MDN2 shipped `?tab=recap` via TanStack Router `validateSearch`. The next day it migrated to nested path segments `/lol/$accountSlug/matches/$matchId/{recap,your-game,timeline}`. The trigger: the `?tab=` query persisted on the URL after navigating *away* from match detail — UI state leaking into the section-level URL surface. Path segments scope cleanly to the route.
- **One `layoutId`, two physical instances.** The same `<MatchDetailTabs>` renders twice — once below the hero, once inside the sticky champion strip past the hero. Sharing a single `layoutId` caused Motion to animate the underline across both instances and through whatever sat between them. Two distinct `layoutId`s (`...-tab-indicator` and `...-tab-indicator-sticky`) was the right call — visually identical, no cross-instance morph.
- **Scroll restoration is a section-shell problem, not a route problem.** TanStack Router's `scrollRestoration` is off in this app because the scroll container is `<main>`, not `window`. Every section root resets `mainScrollRef.current?.scrollTo(0, 0)` on `pathname` change. Tabs-as-routes makes every tab click a pathname change — without the existing reset, every tab swap would have scrolled to the top mid-read. The discipline pre-dated the migration; it carried the migration for free.
- **The skeleton has to branch on the active tab.** A generic shimmer would have been wrong the moment the swap to real content reflowed. `MatchDetailSkeleton` accepts a `tab` prop and renders the matching layout (Recap = team blocks, Your game = side panels, Timeline = chart + event feed). One change locked in by repo convention afterward.

## The setup

`/lol/$accountSlug/matches/$matchId` started as a single scroll: hero at the top, then `MatchHeaderStrip`, two `TeamBlock`s, `MatchBuildOrder`, `MatchGoldLead`, `MatchEventTimelines`, `MatchSkillOrder`, `MatchLanePhase`. Eight content sections beneath the hero, all rendered top-to-bottom. The post-Tier-1A ideation sweep queued six more: spell-cast strip, damage profile, CC/death timings, multikill badges, all-10 damage stacked bar, full rune page. At fourteen sections deep, "scroll harder" stops being a UX.

Two constraints framed the redesign:

1. **No new sticky chrome tier.** The app already has three: global nav, account header, and (past the hero) the champion sticky strip. A 2026-05-10 experiment with a fourth sticky controls bar was reverted as structurally too heavy on a 1080p viewport. The match-detail tab bar must live *inside* the existing sticky envelope, not above it.
2. **PG4 is a separate surface.** A peer route at `/lol/$accountSlug/post-game/$matchId` (the share-friendly per-game verdict + baseline deltas) is its own thing. The match-detail tabs cover the structural breakdown of the game; PG4 is the personal verdict layered on top. Don't duplicate either as a tab of the other.

The grouping landed as Recap (all-ten, glance-readable), Your game (owner-deep panels — biggest tab, the one that gets scrollspy), Timeline (chronological — gold-lead chart + event timelines).

## Shape

```
/lol/$accountSlug/matches/$matchId         ← layout route
  ├── /                                    ← redirects to /recap (beforeLoad)
  ├── /recap                               ← Recap tab
  ├── /your-game                           ← Your game tab (scrollspy here)
  └── /timeline                            ← Timeline tab
```

Each tab route is a thin shell — it calls `useMatchTabProps()` (which reads the cached `useMatchDetail` query plus the owner participant) and renders one of the three tab-body components. The shared data lives at the layout route; the tab routes only own their slice of the UI.

[apps/web/src/routes/lol/$accountSlug/matches/$matchId/recap.tsx](../../apps/web/src/routes/lol/$accountSlug/matches/$matchId/recap.tsx) in full:

```tsx
export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/recap")({
  component: MatchRecapRoute,
});

function MatchRecapRoute() {
  const { accountSlug, matchId } = Route.useParams();
  const props = useMatchTabProps(accountSlug, matchId);
  if (!props) return null;
  return (
    <MatchRecapTab
      detail={props.detail}
      myPuuid={props.myPuuid}
      accountSlug={accountSlug}
    />
  );
}
```

[apps/web/src/routes/lol/$accountSlug/matches/$matchId/index.tsx](../../apps/web/src/routes/lol/$accountSlug/matches/$matchId/index.tsx) handles the "no segment" case — `beforeLoad` throws a `redirect` to `/recap`, `replace: true` so the redirect doesn't pollute history.

## Why path segments, not a query param

MDN2 shipped on 2026-05-17 with `?tab=recap` as a TanStack Router search param (`validateSearch`, default `recap` omitted from the URL). Within a day it was clear that wasn't right. The query persisted on the URL after navigating *away* from the match-detail page — clicking from `…/matches/EUW1_123?tab=your-game` to `…/champions` left `?tab=your-game` hanging on the new URL.

That's not specific to TanStack — it's how search params work. They're URL state, scoped to the URL, not to the route. Migrating to a nested path segment fixed it for free: the segment only exists *under* `/matches/$matchId`, so navigating up to `/matches` or sideways to `/champions` strips it as part of the path change.

The migration was structurally small (three new route files + an index redirect + the `validateSearch` removal) but it changed the mental model: the URL is now the canonical handle for tab state, not a hint about what the page should render.

## The two-instance underline

`<MatchDetailTabs>` renders in two places on the same page:

1. **Below the hero** — full-size, visible while the hero is on screen.
2. **Inside the sticky champion strip** — `compact` variant, visible once the hero scrolls past the top.

Both are physically present in the DOM at all times; visibility is toggled by `heroScrolledPast` (`useHeroScrolledPast` hook). The in-page instance gets `invisible` past the threshold so it keeps its layout space without rendering.

The first attempt shared a single `layoutId` between both instances on the assumption that Motion would handle the cross-fade. It didn't — the underline morphed *across* the page from the in-page tab bar to the sticky one (and back), animating through whatever DOM happened to be between them. Two `layoutId` values fixed it:

```tsx
// In-page (below hero)
<MatchDetailTabs ... indicatorId="match-detail-tab-indicator" />

// Sticky (past hero)
<MatchDetailTabs ... indicatorId="match-detail-tab-indicator-sticky" />
```

The underline still slides between tabs *within* each instance — that's what `layoutId` is for. The two instances just don't share an animation namespace.

[apps/web/src/lol/matches/match-detail-tabs.tsx:58-62](../../apps/web/src/lol/matches/match-detail-tabs.tsx#L58-L62) for the actual `<m.div>` with the `layoutId`. The trigger element is a TanStack Router `<Link>` with `replace`, so tab swaps don't pile onto the back stack — clicking from Recap → Your game → Timeline and pressing Back goes to the previous *match*, not the previous tab.

## Scroll restoration carried the migration for free

TanStack Router's built-in `scrollRestoration` is disabled in this app because the scroll container is `<main>`, not `window`. The pattern is enforced as a repo convention: every section root subscribes to pathname changes and resets its scroll container. From `apps/web/src/routes/lol/$accountSlug.tsx`:

```tsx
useEffect(() => {
  mainScrollRef.current?.scrollTo(0, 0);
}, [pathname]);
```

The match-detail layout route renders inside that section root, so the reset already handles tab navigation. Without it, clicking a tab three sections deep would have kept the previous scroll position — landing the user at row 4 of a tab whose row 1 they had never seen. The reset turns every path-change into a "fresh tab" experience.

The migration from `?tab=` to `/recap` made this load-bearing in a way it hadn't been before. With the query param, swapping tabs was *not* a pathname change — the reset didn't fire, and arguably you wanted that (stay at the same vertical position when re-reading the same match). With path segments, every tab swap is a path change, and the reset fires every time. After watching it for a minute, the path-segment behaviour reads correctly: each tab is a different *view*, not a different *slice* of the same scroll. Reset-to-top matches the framing.

## Skeleton-must-branch-on-active-tab

The match-detail skeleton was already tab-aware before the routing migration, but the migration made it a hard requirement. [apps/web/src/lol/matches/match-detail-skeleton.tsx](../../apps/web/src/lol/matches/match-detail-skeleton.tsx) takes a `tab: MatchDetailTabId` prop and branches:

```tsx
function MatchDetailSkeleton({ tab }: { tab: MatchDetailTabId }) {
  if (tab === "your-game") return <YourGameSkeleton />;
  if (tab === "timeline") return <TimelineSkeleton />;
  return <RecapSkeleton />; // default
}
```

The layout route reads the active tab via `useActiveTab(matchId)` and passes it down to the skeleton (and to both `<MatchDetailTabs>` instances). `useActiveTab` derives the tab from the URL — it doesn't keep its own copy of state:

```tsx
function useActiveTab(matchId: string): MatchDetailTabId {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const after = pathname.split(`/matches/${matchId}`)[1] ?? "";
  const trimmed = after.replace(/^\/+|\/+$/g, "");
  if (trimmed === "your-game") return "your-game";
  if (trimmed === "timeline") return "timeline";
  return "recap";
}
```

The string-split approach is deliberately loose — the index route redirects to `/recap` so a valid URL always lands on a tab segment, but during the brief frame before redirect the fallback to `"recap"` keeps the page from rendering anything inconsistent.

The principle was promoted to a repo convention after this arc: *a skeleton loader's job is to reserve the shape of incoming content, not to render a generic shimmer*. The cost of writing three skeleton variants is small; the cost of a generic skeleton causing visible reflow on every swap is large.

## What worked

- **One layout route, three sibling tab routes.** The data fetch (`useMatchDetail`) lives at the layout; tab routes get it via `useMatchTabProps` (cheap thanks to TanStack Query dedup) and render their slice. No prop drilling, no context, no per-tab refetch.
- **`Link replace` on tab navigation.** Tab swaps don't pollute the back stack — back goes to the previous match, not the previous tab. Standard pattern, but easy to miss.
- **Two `layoutId` namespaces for two physical instances.** Solved the cross-page-morph bug without writing any animation code.
- **Index-route `beforeLoad` redirect.** The bare `/matches/$matchId` URL still works — typing it in resolves to `/recap` via `replace`, so bookmarks land on the canonical form. No client-side wrapper needed.

## Surprises

- **The query-param leak across routes.** Predictable in hindsight — search params live on the URL, not on the route — but easy to forget until it bites. The migration window was less than 24 hours, so the lifetime cost was low, but the rule generalizes: tab state that's *scoped to one route* belongs in a path segment, not a query param. Save query params for filters that survive across routes (date range, search term).
- **Shared `layoutId` morphed across the page.** Motion treats `layoutId` as a global identifier — same `layoutId`, any DOM position, Motion will animate between them. Reasonable when intended; surprising when not. Putting two visually identical bars under distinct `layoutId`s is the right answer when only one is mounted-visible at a time but both are physically present.
- **Scroll-to-top-on-tab-swap reads correctly.** The instinct was "stay at the same vertical position when changing tab on the same match" — like an in-page accordion. Watching it, that's wrong: the tabs render different content, not different sections of the same content. Each tab is its own page worth of context. Resetting to top is the right verb.

## Open questions

- **Deep-linkable section anchors.** Scrollspy sub-nav state inside "Your game" is not URL-persisted today. If "open the rune page panel directly" becomes a real use case (e.g. from a Profile-page tile), `#section-id` is the obvious v2. Deferred until that use case shows up — adds noise to history otherwise.
- **MDN5 — does the grouping still hold once the queued sections land?** Spell casts, damage profile, CC time, multikills, all-10 damage stacked bar, full rune page. Re-evaluate the Recap / Your game / Timeline split once those ship. If "Your game" grows past ~7 stacked sections even with scrollspy, splitting runes/build off into its own tab is the most likely move.
- **Champion strip + tab bar — single row or two rows.** Currently two thin rows past the hero (champion info above, compact tab bar below). Denser single-row variant (tabs to the right of K/D/A) was decided against during MDN3 — reads busier on a 1366px viewport.

## Portfolio framing

The arc is small in code (four route files, one hook, one tab-bar primitive) but the decisions stack:

- *Tabs as routes, not as state.* Path segments are scoped; query params aren't. Match the URL surface to the scope of what it represents.
- *Motion as a layout primitive, not a finishing effect.* `layoutId` is a global namespace — the two-instance case forced an explicit decision about whether the underline should morph across the page (no) or just slide within an instance (yes).
- *Skeleton as part of the layout.* When the layout branches, the skeleton has to branch with it. Generic shimmers lie about what's loading.
- *Scroll restoration is one of those repo-wide disciplines that pays for itself the moment routing assumptions change.* The pattern (every section root resets its scroll on pathname change) pre-dated the tab routing migration; the migration didn't notice because the pattern handled it.

The honest pre-existing-convention version of this story: an `?tab=` would have worked. Path segments are the right call because they don't leak — but a project that didn't navigate between sections often, or where match-detail was the terminal surface, could have stayed on query params indefinitely. The migration is a 24-hour course-correct, not a heroic refactor.

## Connections

- [working-notes/lol/match-detail-section-nav.md](../working-notes/lol/match-detail-section-nav.md) — the MDN1–MDN4 chunk plan and the locked Option A grouping.
- [conclusion-card-pattern.md](conclusion-card-pattern.md) — adjacent pattern for the "what this game says" framing inside Recap / Your game.
- [motion-without-gimmicks.md](motion-without-gimmicks.md) — the `layoutId` discipline applied across the rest of the app (account tab bar, sliding indicators).
- [visual-layer.md](visual-layer.md) — the sticky-envelope rule (max three sticky layers) that the match-detail tab bar had to fit inside.
