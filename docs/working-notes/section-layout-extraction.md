# Section layout extraction

Trigger: Steam S4.5 Chunk C-1 surfaced that the LoL and Steam section layouts are converging on the same pattern, with significant duplicated logic between [routes/lol/$accountSlug.tsx](../../apps/web/src/routes/lol/$accountSlug.tsx) and [routes/steam.tsx](../../apps/web/src/routes/steam.tsx). A third section (TFT — warm queue, see [tft-integration.md](tft-integration.md)) would compound the duplication. The pattern is well-formed enough to extract.

## What's shared

- **Sticky compact `<header>`**: full-bleed (`w-screen ml-[calc(50%-50vw)] -mt-6`), backdrop blur, spring-animated `paddingTop`/`paddingBottom` between expanded (24/12) and compact (8/8) states.
- **Compact state**: driven by `mainScrollRef` scroll position with hysteresis (>96 enter, <8 exit) and 400ms cooldown to defeat scroll-anchor oscillation. Triggers the visible "slide down" on every tab navigation (scroll resets → compact:false → header spring expands). This is the section-entry animation, not `pageSlideVariants`.
- **Gradient bottom line**: `pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/15 to-transparent`.
- **Tab nav with animated indicator**: `layoutId` cross-tab slide, gradient bar at `-bottom-px`, infinite glow pulse via `boxShadow` keyframes, icon spring pop on activation (scale 0.75→1, y -4→0, stiffness 450, damping 18).
- **Active-icon styling**: accent color + `drop-shadow` glow.
- **Tab matcher (`isTabActive`)** with `extraPrefixes` support for routes that belong under a tab but live outside its subtree (`/steam/game/*` → Library).
- **Outlet wrapper**: `AnimatePresence mode="popLayout" initial={false}` + `m.div key={pathname}` with `pageSlideVariants` (x-axis ±32) and a `slideDirectionRef` updated synchronously during render so the entering element gets the correct `initial` on the same frame.
- **Skeleton patterns** for the identity row: pulsing circle for avatars (size-aware), pulsing bar for text.

## What stays section-specific

- Tab definitions (`to`, `label`, `Icon`, `exact`, `extraPrefixes?`).
- **Identity slot content**. LoL: profile icon + level badge + `gameName#tagLine` + region + actions row (`AccountSwitcher`, `RefreshAccountButton`, `SeriousQueuesSettings`, optional `BackButton`). Steam: avatar + persona name. TFT will differ again.
- **Accent colors**. LoL: `from-sky-400 via-violet-400 to-emerald-400` indicator with `text-sky-400` active icon glow. Steam: `from-blue-400 via-cyan-400 to-sky-300` with `text-blue-400`.
- **Tab-indicator `layoutId`** string — must be unique per section to keep cross-section animations from colliding.
- **Per-section adornments** — LoL's champion splash backdrop, Steam's profile background (planned in S4.5 C-3), TFT's unknowns.
- Data source for the identity row (`useMe` slug lookup vs `useSteamSummary` vs whatever TFT needs).

## Sketch

Lives under `apps/web/src/_shared/section-layout/` (mirroring the `_shared` convention already used in `lol/_shared/` and `steam/_shared/`).

```ts
// use-compact-header.ts
export function useCompactHeader(): boolean

// use-tab-slide-direction.ts
export function useTabSlideDirection<T extends TabDef>(
  pathname: string,
  tabs: readonly T[]
): number

// section-shell.tsx
export function SectionShell(props: {
  identity: ReactNode
  actions?: ReactNode
  tabs: readonly TabDef[]
  pathname: string
  indicatorLayoutId: string
  indicatorClassName: string         // gradient utilities
  iconActiveClassName: string        // accent + glow utilities
  children: ReactNode                // the Outlet wrapper
}): JSX.Element

// shared TabDef contract
type TabDef = {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  exact: boolean
  extraPrefixes?: readonly string[]
}
```

Section routes become thin composers. Each section file is mostly the tab list + identity slot + accent colors.

## Timing

Defer until S4.5 fully ships (Chunks C-2 + C-3: `IPlayerService/GetProfileItemsEquipped/v1/` backend + animated avatar / profile background wiring). The identity slot's shape will be informed by that work — animated avatar (`<video>` vs `<img>`), profile background as a layer behind the identity row, possibly action affordances. Extracting before the slot's needs are stable risks an API that has to break a chunk later.

Extract with two well-formed callers (LoL, Steam) rather than waiting for three. Rule-of-three has merit for unknown patterns; here the pattern is *very* known — it's been built twice and the next section (TFT) is queued.

## Open questions

- Does the splash/background adornment belong inside the shell (as a slot) or stay external? LoL uses `SplashProvider` from the root layout with the LoL feature claiming the backdrop slot from inside `AccountLayout`. Steam's profile background is conceptually similar but tied to the section's own identity, not a dynamically-selected element.
- Should the shell own the `<Outlet>` wrapper (AnimatePresence + page slide), or expose a `usePageSlide()` hook that section files call themselves? Owning it is less flexible but enforces consistency.
- Does `pageSlideVariants` keep `initial={false}` (LoL convention — no entry slide on section change, header expansion provides the motion), or do some sections need different behaviour?
- Does the action-buttons slot (LoL's switcher/refresh row) belong in the shell or stay as section-specific JSX inside the identity slot? Probably the latter — Steam currently has no action buttons.

## Out of scope

- Root-layout changes ([__root.tsx](../../apps/web/src/routes/__root.tsx) `key={scope}` opacity fade) stay as they are. That layer handles cross-section entry; this extraction handles within-section structure.
- Home and Status are single-page sections without tabs — they don't compose this shell and shouldn't be forced to.
