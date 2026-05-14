# Adding motion to a data dashboard without making it loud

## TL;DR

The dashboard moves — match cards have ambient tilt, KDA numbers count up on first paint, freshly-arrived matches pulse green or red for a beat, and clicking a card transitions its rectangle into the detail-page hero rather than cutting. None of it is decorative. Each animation answers a *question the user would otherwise have to construct in their head*: where did this thing come from, what just changed, did the system register what I did. The discipline is mostly about what was *not* shipped — no parallax, no auto-rotating carousels, no entrance animations on cached data, no per-list-row stagger, no looping idle ambience outside the splash backdrop. Two structural decisions carry the rest: `LazyMotion + domMax` at the root so motion ships as a code-split chunk rather than baseline bundle weight, and `useReducedMotion` as a first-class branch in every animated component instead of a CSS afterthought.

## The thesis

A "data dashboard" earns its motion budget by motion that *means something*. Three questions to gate any candidate animation against:

1. **Does the user gain information they didn't have?** A count-up from 0 → 47 tells the user "this is a freshly-computed number, here's its magnitude as it settles." A loop that breathes a card forever tells them nothing after the first 600 ms.
2. **Does removing the animation break the page's spatial story?** A card-to-hero transition makes the back-navigation make sense — the user knows where the detail came from and where they're returning to. A fade-in does neither.
3. **Does it survive `prefers-reduced-motion`?** If the answer requires the user to see the motion to understand the state, the design is wrong. Motion is an enhancement layer.

Every animation in this app has to pass all three or it doesn't ship.

## Bundle posture — LazyMotion + domMax

The full `motion/react` features bundle is ~30 KB gzipped. Loading it baseline-eagerly on a page where the user might never trigger an animation is a tax on the time-to-interactive of users who came for a number, not for choreography.

`LazyMotion` defers the feature bundle and exposes `m.*` components that read features from context:

```tsx
import { LazyMotion, domMax } from "motion/react";

function App() {
  return (
    <LazyMotion features={domMax}>
      <Router />
    </LazyMotion>
  );
}
```

`domMax` is the kitchen-sink (drag, layout, exit animations, gesture handling). `domAnimation` is the smaller subset. The choice between them is a real one — `domAnimation` is half the size, but the card-to-detail return transition uses layout-driven WAAPI plus exit detection that depends on `AnimatePresence` features included only in `domMax`. The cost of the larger feature set is real; the choice was deliberate, not default.

Two consequences worth naming:

- Every animated component imports from `motion/react` as `m.div` / `m.section` rather than `motion.div`. The lowercase form is the context-aware variant. A grep for `motion\.` in the codebase returns zero hits in component code; it shows up only in the type import.
- The features bundle still has to *land* before the first animation fires. For below-the-fold animation this is invisible. For above-the-fold animation (the entrance of the Profile page itself) it means the first paint is the static layout, and the entrance plays on hydration tick. This trade is intentional — instant text beats animated text by a wide margin on perceived speed.

## Reduced motion as a first-class branch

Reduced motion is not a CSS variable that quietly disables animations. It's a *contract about what kind of UI the user can tolerate*. A user who set it might have vestibular sensitivity, might be on a slow device, might just find motion distracting. The right response is to give them the *same information*, with motion as a separate layer that can be turned off without losing information.

Two parallel hooks:

```ts
// Global CSS — kills ambient loops that don't carry information
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer { animation: none; }
  .heatmap-cell { animation: none; }
  .group:hover .card-splash-breathe { animation: none; }
}

// Component-level — runtime branch in components that animate state changes
const reduced = useReducedMotion();
if (reduced) return <span>{to}</span>;
```

The CSS-level guard handles loops and hover ambience. The component-level guard handles state-change animations — count-ups, entrance fades, the card-to-hero transition. The two layers don't overlap — neither kills the other's animations, and the failure mode if one is missing is "an animation that should have been suppressed runs." Catchable in design review.

The two-layer approach has one subtle implication: a component that uses `useReducedMotion` *must* render a non-animated path that is informationally complete. `CountUp` with `reduced === true` renders the final number immediately:

```tsx
export function CountUp({ to, duration = 0.7, decimals = 0, className }: Props) {
  const reduced = useReducedMotion();
  const skip = !SHOULD_ANIMATE || reduced === true;
  const value = useMotionValue(skip ? to : 0);
  const [display, setDisplay] = useState(skip ? to : 0);

  useEffect(() => {
    if (skip) {
      setDisplay(to);
      value.set(to);
      return;
    }
    const factor = 10 ** decimals;
    const unsubscribe = value.on("change", (v) =>
      setDisplay(Math.round(v * factor) / factor)
    );
    const controls = animate(value, to, { duration, ease: "easeOut" });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [to, duration, decimals, skip, value]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
```

The reduced path is "render `to` as a static string." Same DOM shape, same className, same numerical content — only the temporal path differs. A test reading the component's rendered output sees the final number whether or not reduced-motion is on, which means tests don't need to wait for animations to settle.

## Count-up — numbers settle to truth, not from zero

A KDA of 3.42 / a win rate of 67% / a games-played count of 211. These numbers all arrive in one network response. Rendering them statically is correct and fine. Animating them from 0 to their final value is *almost* correct — it adds an additional perception: "this is a number that just landed, here is its size relative to the others on screen as it sweeps."

The constraint is that the *truth* must be reachable instantly. The count-up duration is 0.7 s with `easeOut`, so 90% of the magnitude lands in the first ~350 ms. The animation is a flourish, not a wait — the user is never blocked on the number arriving.

Three small choices that turn it from a gimmick into signal:

- **Origin is 0, not the previous value.** When the page first renders, the user has no previous frame of reference; counting up from 0 fits a "this is new" story. When the page re-renders with new data (a refetch), the value is set without animation. Two different shapes for two different events.
- **`easeOut`, not linear.** A linear count-up reads as "machine reciting digits." An easeOut count-up reads as "value approaching truth and settling." The exact curve doesn't matter; the asymmetry does.
- **`decimals` is a prop, not auto-detected.** Whether to render 3.42 or 3 is a presentation decision, not a data decision. Pushing it to the call site keeps the component dumb about formatting.

## Card-to-hero transition — a manual FLIP

Clicking a match row navigates to its detail page. The detail page's hero is, visually, the same card — same champion splash, same border, same colors. A cut feels disorienting; a fade feels like a fade. A *shared-element transition* between the row's rectangle and the hero's rectangle reads as "I'm zooming into the thing I clicked."

The View Transitions API would do this in one line. It's not stable across the supported browser matrix yet, so the manual version: capture the rect on click, replay the inverse transform on the destination's first paint.

```ts
useLayoutEffect(() => {
  if (!savedOrigin.current) {
    const o = originRectRef.current;
    if (o?.matchId !== match.matchId || o.direction !== "backward") return;
    savedOrigin.current = o;
  }
  const origin = savedOrigin.current;
  if (!origin || !cardRef.current) return;
  if (reduced) return;
  const el = cardRef.current;
  el.style.visibility = "hidden";
  let cancelled = false;
  const rafId = requestAnimationFrame(() => {
    if (cancelled) return;
    setOriginRect(null);
    el.style.visibility = "";
    const listRect = el.getBoundingClientRect();
    const dx = origin.rect.left - listRect.left;
    const dy = origin.rect.top - listRect.top;
    const sx = origin.rect.width / listRect.width;
    const sy = origin.rect.height / listRect.height;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`, transformOrigin: "0 0" },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
    );
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    el.style.visibility = "";
  };
}, []);
```

Three things load-bear here:

- **WAAPI (`el.animate`), not framer-motion.** This is a one-shot replay of a specific transform; no React state, no re-renders, no integration with the rest of motion. WAAPI is the right tool — fewer abstractions, runs on the compositor, doesn't allocate.
- **Visibility-hidden until the first RAF.** Without it the destination card paints in its final position for one frame, then jumps to the origin and animates back. That single frame reads as a flicker. The visibility/RAF dance buys the transform a chance to land before the user sees anything.
- **StrictMode tolerance via `savedOrigin` ref.** React StrictMode runs effects twice in dev. The first run consumes `originRectRef.current`; the second run would see nothing. Capturing into a per-component ref on first encounter keeps the second run idempotent.

The reverse direction (detail → list) uses the same pattern with `direction: "backward"`. The two animations share the same `originRectRef` channel — one component writes it on click, another component reads it on mount. The channel is just a plain ref, not Context — there's exactly one of them and exactly one consumer at a time.

## The new-match pulse — the only "loud" effect

Freshly-arrived matches (within the last few minutes, surfaced by the SSE stream described in [historical-backfill-and-sse.md](./historical-backfill-and-sse.md)) pulse green or red once for ~1.6 s:

```tsx
{isNew && !reduced && (
  <m.div
    className="pointer-events-none absolute inset-0 rounded-md"
    animate={{
      boxShadow: match.win
        ? [
            "0 0 0 2px rgba(52,211,153,0)",
            "0 0 0 2px rgba(52,211,153,0.45), 0 0 18px 3px rgba(52,211,153,0.14)",
            "0 0 0 2px rgba(52,211,153,0)",
          ]
        : /* red variant */
    }}
    transition={{ duration: 1.6, ease: "easeInOut" }}
  />
)}
```

The pulse is the loudest single animation in the app, which is the point — it signals an event that just happened in the world, not a decoration. Three discipline points keep it from becoming noise:

- **One pulse, not a loop.** The animation runs once and stops. The `isNew` flag also clears on the next data refresh. A pulse that runs forever would say "look at this," forever — the user would learn to ignore it.
- **Gated on `!reduced`.** Reduced-motion users see the new match in its rendered form without the pulse. They still know it's new (the data is timestamped, the list order conveys recency); they just don't get the temporal cue.
- **Color matches outcome.** Green for win, red for loss. The pulse encodes information beyond "something happened."

## What was deliberately not shipped

The discipline is more about what was rejected than what was kept. A non-exhaustive list:

- **Staggered list entrance.** Each match row could fade in 50 ms after the previous one. It looks pretty and it's free in framer-motion. It also makes a 20-row list take a full second to settle, which is "slow" if the user is here to read the rows. Cut.
- **Auto-rotating insights carousel on the Recap page.** A carousel of trends rotating every 4 seconds would showcase more content in the same visual budget. It also robs the user of agency and makes it impossible to read anything that doesn't fit one rotation cycle. Cut.
- **Parallax on the splash backdrop.** Mouse-following parallax on the backdrop layer would be three lines of code in the existing component. It would also make every scroll into a vestibular event. Cut.
- **Entrance animations on cached data.** A re-render of an already-loaded page (e.g. coming back from a detail view via the browser back button) does not re-animate. The animations key off mount events, not data-arrival events, so a remounted-with-cached-data view skips the entrance because the values are already in their final state.
- **Skeleton shimmer on routine refetches.** The shimmer-while-loading effect runs only on the very first load. Background refetches reuse the previous data and don't shimmer. Otherwise every refresh would feel like the page is rebooting.

Each of these would have been a 10-line addition. Adding them collectively would have been a different product — louder, slower, more performative. The decision to *not* ship them is the design.

## What this earns

- **A motion vocabulary the user reads as information.** Counts settle, cards travel, recent events pulse once. Each verb is reserved for one kind of event, so a return visit to the page parses the choreography at a glance.
- **A baseline ceiling on bundle weight.** `LazyMotion` keeps the feature bundle out of the initial chunk. The animations land when they're needed, not when the route first paints.
- **A reduced-motion contract that's actually contractual.** Every animated component renders a non-animated path that carries the same information. A reduced-motion user never sees fewer numbers, they just see them statically.
- **A pattern for shared-element transitions before View Transitions API stabilizes.** The card-to-hero replay works in every modern browser, falls back to a hard cut under reduced-motion, and doesn't depend on browser-native transition APIs landing.

## Looking back

The first instinct on "a dashboard needs to feel alive" is to add motion to everything. The skill is the inverse — keep the bag of verbs small, give each one one job, and reject anything that doesn't pass the three-question gate. The cost of motion isn't bundle size or runtime overhead; it's *attention budget*. Spend it on things the user needs to notice.
