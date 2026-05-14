# Visual layer — the small patterns that hold the page together

## TL;DR

Five visual-layer decisions that look like trivia individually but break the product when any one regresses: the splash backdrop lives in a Provider at the *root* layout, not the leaf routes, so it persists across sub-tab navigation; the active-champion context lives in a non-route file because nesting it inside a TanStack Router file caused the bundler to instantiate two separate context instances; the route-transition `AnimatePresence` is keyed on the *first path segment* so inner tab switches don't re-mount the LoL header; the `LazyMotion` feature bundle is `domMax`, not `domAnimation`, because the lighter bundle silently disables layout animations; and Radix Tooltips are portalled to escape `overflow-hidden` ancestors. None of these are interesting on their own. All five together are the difference between "the page feels coherent across navigation" and "everything flickers on every click."

## SplashProvider at the root

The champion backdrop is a single fullscreen layer at the root layout. Consumers anywhere in the tree call `useSplashChampion(name, offsetX?)` to publish the active champion; the provider preloads via `image.decode()`, holds a stack of *claims* keyed by an owner sequence number, and cross-fades through `AnimatePresence` keyed on the champion alias.

```tsx
function RootLayout() {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <SplashProvider>
        <HeadContent />
        <Nav />
        <main>
          <AnimatePresence mode="wait" custom={direction}>
            <m.div key={scope} ...>
              <Outlet />
            </m.div>
          </AnimatePresence>
        </main>
      </SplashProvider>
    </TooltipPrimitive.Provider>
  );
}
```

Two structural decisions inside this layout matter:

- **The backdrop is outside the route transition.** If `SplashProvider` lived inside the `<Outlet />` subtree, every route change would unmount the splash element and re-mount it on the new route, producing a one-frame flash to background color. By hoisting the provider above the transition, the splash element is stable across the entire app lifetime; only its *contents* (which champion is displayed) change.
- **A 100 ms grace window before claiming the splash goes away.** An earlier prototype cleared the active champion synchronously on route unmount, then re-published it from the new route on mount. The two events landed in different frames and the backdrop briefly flashed empty. The grace window collapses unmount-then-remount into "no-op" for navigations that publish the same champion.

The owner-sequence claims-stack handles nested consumers: a Profile page publishes "Yasuo," a match-row hover on that page publishes "Lux." The higher owner id (Lux) wins; when the user stops hovering, Lux's claim clears and Yasuo's claim reasserts. No explicit reference counting, no parent-child coordination — the highest active id is the one that displays.

## Splash hoisted to the LoL layout, not the leaf routes

The first attempt called `useSplashChampion` from each leaf route — Matches, Trends, Champions, Profile. Switching sub-tabs on the LoL section flashed the backdrop because the leaf route unmounted and the new leaf hadn't yet published a champion. The grace window covers same-route remounts; it doesn't cover *which champion is active* changing between routes.

The fix hoists the active-champion decision up to `$accountSlug.tsx`:

- The `$accountSlug` layout picks a random initial champion from the loaded matches on mount.
- A `HoverChampionProvider` context lets the matches list and champions table override the active champion on card hover.
- The leaf routes don't call `useSplashChampion` at all — they consume the hover context and publish into it.

This works in principle. It broke in practice on a bundler quirk worth its own paragraph.

## The dual-context bug

TanStack Router resolves routes from either `$accountSlug.tsx` (a file with the children inlined) or `$accountSlug/index.tsx` (a directory with a sibling index). When the hover-champion context was defined *inside* `$accountSlug.tsx`, the bundler resolved imports from leaf routes via the directory path, which produced a second module instance — different React context object, different provider, consumers always saw `null`.

The fix is to move the context to a non-route file: [apps/web/src/lol/_shared/hover-champion-context.tsx](../../apps/web/src/lol/_shared/hover-champion-context.tsx). Importing it as `@/lol/_shared/hover-champion-context` resolves through a single canonical path regardless of which sibling the route file is in. One module instance, one context, consumers wired correctly.

The diagnostic surface for this bug is awful: the `null` return reads as "the provider isn't above me in the tree," which is wrong — the provider *is* above, but the consumer is reading a different context object than the provider is publishing into. The lesson generalizes: any React Context that crosses file boundaries in a directory-resolved router should live in a path-stable module, not a route file.

## Scope-keyed AnimatePresence

The root transition keys on the *top-level path segment*, not on the full path:

```ts
function topLevelScope(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

function RootLayout() {
  const scope = useRouterState({
    select: (s) => topLevelScope(s.location.pathname),
  });
  return (
    <m.div
      key={scope}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Outlet />
    </m.div>
  );
}
```

Keying on the full pathname would re-mount the entire tree on every sub-tab switch, which means every `/lol/$slug/*` navigation would re-mount the LoL section's header, tab bar, and account selector — visible as a flash. Keying on the first segment means the LoL section's outer chrome is stable across all `/lol/...` paths; only the inner content re-mounts.

A second `AnimatePresence` inside `$accountSlug.tsx` handles the inner sub-tab transition (Matches → Trends → Champions). It keys on the full pathname and uses `mode="popLayout"` for the slide-in direction. The two layers of `AnimatePresence` compose: outer handles "you crossed top-level sections," inner handles "you crossed sub-tabs within LoL."

The seam between them is implicit — the outer presence never *sees* an inner navigation because `scope` doesn't change. The two presences never compete for the same DOM, so there's no transition-clobbering. This is what "compose, don't coordinate" looks like for animation state.

## LazyMotion features must be domMax

The motion bundle posture is documented in [motion-without-gimmicks.md](./motion-without-gimmicks.md). The constraint specific to this visual layer:

```ts
<LazyMotion features={domMax}>
```

`domAnimation` is the lighter bundle (~half the size of `domMax`). Switching to it silently disables *layout animations* — `m.div` with `layout` or `layoutId` props stops animating, falling back to a hard cut. The sliding nav pill, the LoL sub-tab underline that travels between active tabs, and the trend-count selector all rely on `layoutId`. They keep rendering (so the page doesn't crash or look obviously broken) but stop animating — a regression that's easy to miss in PR review because nothing looks wrong, the page just feels less alive.

The cost is ~5 KB gzip on the deferred chunk. Accepted because the alternative is a silent feature regression on the most visible interactive elements.

## Radix Tooltip with portal and collision detection

Item hover cards on the match detail page sit on rows with `overflow: hidden` (they have rounded corners with absolutely-positioned decorations). A tooltip rendered as a child of the row would clip against the row's bounds the moment it grew taller than the row.

```tsx
<TooltipPrimitive.Trigger>...</TooltipPrimitive.Trigger>
<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content side="top" sideOffset={4} collisionPadding={8}>
    ...
  </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
```

Two pieces load-bear:

- **Portal escape from the `overflow-hidden` ancestor.** The portal mounts the content at `document.body`, so the tooltip's bounds are the viewport's bounds, not the row's bounds. Without it the tooltip clips silently at the row edge.
- **Collision-aware side flipping.** `side="top"` is the preferred placement; Radix auto-flips to `bottom` when the trigger is near the viewport top. This matters for the *first* row in a long table — without the flip, the tooltip would either render off-screen above the row, or clip against the table header.

Radix's `collisionPadding` keeps the tooltip a few pixels away from the viewport edge so it never looks like it's about to fall off the screen.

## What this earns

- **A coherent visual story across navigation.** Splash persists, top-level chrome doesn't re-mount, sub-tab transitions animate cleanly, tooltips never clip.
- **No coordination between motion layers.** Outer and inner `AnimatePresence` compose by keying on different scopes; they don't share state or wait on each other.
- **A blueprint for "where to put Context."** Any context that crosses file boundaries through a directory-resolved router goes in a path-stable module, not a route file. The bundler quirk that produced the dual-instance bug is generic to directory-vs-file resolution, not specific to TanStack Router.

## What's easy to break

Each of these decisions has a low-effort regression path:

- Moving `SplashProvider` inside the `<Outlet />` subtree (refactor that "feels cleaner") would re-introduce the cross-route flash.
- Inlining the hover-champion context back into a route file (an "encapsulation" PR) would re-introduce the dual-instance bug, but only on routes that happen to resolve via the directory path — silently passing tests that touch only the file-resolved routes.
- Downgrading `domMax` to `domAnimation` (a bundle-size PR) would disable layout animations silently.
- Removing the Radix `Portal` wrapper (a "we don't need this, the content fits") would clip tooltips when content gets longer.

The cluster of patterns is therefore *worth documenting as patterns*, not just as code. The shipped state is correct; the failure modes from accidentally regressing any one of them are subtle enough that a PR reviewer wouldn't necessarily catch them. The intended use of this case study is exactly that — a thing to point at in review when one of these guardrails comes under pressure.
