# Section layout extraction

**Status:** Shipped — archived 2026-05-17. All five chunks landed 2026-05-15: audit + frozen API (docs-only), primitive at `_shared/section-layout/` (3 files: `section-shell.tsx`, `section-shell-context.ts`, `use-tab-slide-direction.ts`), Steam migration (315 → ~210 lines), LoL migration (683 → ~545 lines), cleanup. Both routes now compose `<SectionShell>` with identity / actions / nav slots and read `compact` from context. Tabs stayed inline (per-section variation too wide to extract). When TFT lands it composes the same shell; if its tab markup matches Steam's uniformity, revisit a `<SectionTabs>` extraction then. See [archive/README.md](README.md).

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

## Frozen API (post-audit 2026-05-15)

The original sketch had the shell render tabs internally. The LoL audit ruled that out — its tabs carry too much per-section variation (per-label `iconPop`, conditional Live tab, `search={(prev) => prev}`, `BackButton`↔tabs swap on `isMatchDetail`). Tabs stay section-owned and slot into the shell as `nav`. The shell owns the *chrome* only.

Lives under `apps/web/src/_shared/section-layout/`.

```ts
// section-shell-context.ts
type SectionShellState = { compact: boolean }
export function useSectionShellState(): SectionShellState

// use-tab-slide-direction.ts — pathname → -1 | 0 | 1
// tabPaths are resolved paths (LoL: post `$accountSlug` substitution) in tab order
export function useTabSlideDirection(
  pathname: string,
  tabPaths: readonly string[]
): number

// section-shell.tsx
type SlideTransitionOverride = {
  initial?: false | "enter" | "center"
  transition?: Transition
}

export function SectionShell(props: {
  identity: ReactNode                 // avatar + heading + inline badges; reads compact via context
  actions?: ReactNode                 // right-side action cluster; LoL passes null on match detail
  nav: ReactNode                      // tabs OR back-button OR whatever; section decides
  children: ReactNode                 // tab content; rendered inside the page-slide outlet wrapper
  pathname: string                    // page-slide key
  slideDirection: number              // from useTabSlideDirection
  slideTransitionOverride?: SlideTransitionOverride  // LoL match-detail cut
  headerRef?: Ref<HTMLElement>        // expose <header> for downstream (LoL writes `--account-header-h`)
}): JSX.Element
```

Shell internalises: `compact` + `bandOpaque` scroll-tracking (hysteresis 96/8, 400ms cooldown, 16px band threshold), header `ResizeObserver`, fixed band geometry + opacity, padding spring (24/12 → 8/8), gradient hairline, `AnimatePresence mode="popLayout" initial={false}` outlet wrapper with `pageSlideVariants` (`x: d * ±32`).

Section routes become thin composers — identity slot + actions + nav slot. The `pageSlideVariants` constant lives inside the shell module (not exported); sections override via `slideTransitionOverride` if they need a non-default behaviour like LoL's match-detail cut.

### Open questions — resolved

- **Backdrop adornment in the shell?** No. LoL's splash uses a root `SplashProvider` portal driven by `useSplashChampion`; Steam's profile background is a `createPortal` to `document.body` inside its own route. Different ownership models — shell stays adornment-free, each section keeps its own portal.
- **Shell owns the `<Outlet>` wrapper?** Yes. Both callers use identical `AnimatePresence + pageSlideVariants + pathname key`. LoL's match-detail cut is expressible as `slideTransitionOverride={{ initial: "center", transition: { duration: 0 } }}`.
- **`pageSlideVariants` consistency?** Yes — same constant for both, override prop covers the one LoL exception.
- **Actions slot in the shell or in identity?** Shell, as a separate `actions` prop. Keeps identity pure; LoL passes `null` on match detail to express the hide.
- **Tab markup (Link + icon + indicator)?** **Out of scope for this extraction.** LoL's tabs carry per-label `iconPop`, conditional Live tab, and `BackButton` swap; Steam's are uniform. The variation is wider than the duplication. Tabs stay inline in each section. If TFT lands and adds a *third* uniform-style tab nav, revisit a `<SectionTabs>` extraction then.

### LoL-specific concerns the shell does NOT solve

The migration of `routes/lol/$accountSlug.tsx` will still need to retain:
- The scroll-to-top `useLayoutEffect` with the match-detail return exception
- The CSS variable write (`--account-header-h`) — done via `headerRef` forwarded from the shell
- All four context providers (`ActiveMatch`, `HoverChampion`, `SeriousQueues`, `MatchWindow`) wrapping `<SectionShell>`
- The `<MatchListReturnReset/>` non-rendering helper
- The `BackButton`↔tabs `AnimatePresence mode="wait"` swap, rendered inside the `nav` slot

The shell extraction is *chrome only*. None of the LoL-specific behaviours collapse.

## Timing

Defer until S4.5 fully ships (Chunks C-2 + C-3: `IPlayerService/GetProfileItemsEquipped/v1/` backend + animated avatar / profile background wiring). The identity slot's shape will be informed by that work — animated avatar (`<video>` vs `<img>`), profile background as a layer behind the identity row, possibly action affordances. Extracting before the slot's needs are stable risks an API that has to break a chunk later.

Extract with two well-formed callers (LoL, Steam) rather than waiting for three. Rule-of-three has merit for unknown patterns; here the pattern is *very* known — it's been built twice and the next section (TFT) is queued.

## Out of scope

- Root-layout changes ([__root.tsx](../../apps/web/src/routes/__root.tsx) `key={scope}` opacity fade) stay as they are. That layer handles cross-section entry; this extraction handles within-section structure.
- Home and Status are single-page sections without tabs — they don't compose this shell and shouldn't be forced to.
