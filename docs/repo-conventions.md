# Repo conventions

Portable workflow, environment, and architectural rules for vyoh.gg. Committed so they survive across machines. 

Code-site-specific facts live as comments at the relevant source location, not here. This file holds only what is too cross-cutting to attach to one file.

## Architecture

### Per-stream routes; `/` is synthesis-only

Each integration owns its own top-level route tree: `/lol/...`, `/steam/...`, and future streams get their own (`/music` for Spotify, `/code` for GitHub + WakaTime, etc.). Never embed Steam-specific components into LoL-scoped routes (e.g. `/lol/$accountSlug/*`) — and don't do the reverse.

`/` is for cross-stream *synthesis* — content that combines multiple streams into one verdict (chronotype hour-bucketing across LoL + commits, "what am I doing right now" picking the dominant live stream). A "top tracks this week" or "latest commit" tile on `/` is wrong-place; it belongs on its per-stream route. `/` may carry at most a single curated highlight per stream that links into the deep route.

**Why:** Domain separation matches the data model (`/lol/$accountSlug` is one Riot account; Steam has nothing to do with that account) and keeps the portfolio framing clean (each integration becomes its own case study, with `/` as the aggregator). If `/` accumulates one stream-feed per integration, the synthesis story drowns and the page reads as a mixed-bag dashboard rather than a self-portrait.

**How to apply:** When scoping any new integration UI, default to its own route subtree. Only put something on `/` if it is explicitly cross-stream synthesis. If a working note says "Profile-page section placeholder" without naming the page, treat it as ambiguous and confirm the surface — don't assume the LoL profile page just because it has stacked `Profile*` components.

### Skeleton loaders must mirror the layout they replace

A skeleton loader's job is to reserve the shape of incoming content, not to render a generic shimmer. If a page has multiple tabs/sections with different layouts (e.g. match-detail's Recap / Your game / Timeline), the skeleton must branch on the active surface — the example pattern lives in [apps/web/src/lol/matches/match-detail-skeleton.tsx](../apps/web/src/lol/matches/match-detail-skeleton.tsx), gated by tab prop in [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx).

**Why:** A generic skeleton causes a visible reflow the moment real content swaps in, which reads as jank even though every individual transition is smooth. Worse, it lies to the user about what's loading — a participant-list shimmer on the Timeline tab promises team rows that never arrive.

**How to apply:** When adding a new tab, sub-route, or layout variant to a section that has a skeleton loader, extend the skeleton in the same change — don't ship the new layout against the old skeleton. When restructuring an existing layout (adding a header strip, removing a column, changing grid shape), update the corresponding skeleton in the same commit. Treat the skeleton as part of the layout, not a separate concern.

### Extend the command palette when adding filterable surfaces

When adding a new filterable list, deep-link action, or "find by X" affordance, default to extending the ⌘K command palette rather than shipping a leaf-page dropdown, sticky controls bar, or one-off filter chip. The palette is the project's single "find anything" surface, with its grammar parser living in `@vyoh/shared`. Full plan and chunk list: [docs/working-notes/cross-cutting/command-palette.md](./working-notes/cross-cutting/command-palette.md).

**Why:** The palette is the explicit handoff from the reverted sticky-controls bar. Scattering filter UI across leaf pages re-invents the problem that handoff was meant to solve and forks the vocabulary away from the shared parser.

**How to apply:** When scoping any task that touches a filterable surface or adds a "find by X" intent, include an "extend palette grammar/groups" sub-chunk in the plan and update the chunk list in `command-palette.md`. If a feature genuinely doesn't fit the palette (spatial selection, live-preview range slider, drag-to-reorder), document why in the working-note before adding parallel UI.

### Cross-package utilities belong in `packages/shared/src/`

If a helper function (formatter, type guard, domain utility) is used across more than one package, it lives in `packages/shared/src/` — not inlined per-component or duplicated per-service. Each package may still have private helpers for single-package concerns, but once a helper escapes into a second package it must be consolidated.

**Why:** Duplication drifts. A hygiene sweep on 2026-05-18 found 6+ independent copies of duration/playtime/gold formatters scattered across `apps/web` and `apps/api`, with enough variation between them that a future display inconsistency was only a matter of time.

**How to apply:** Before writing a new utility function, check `packages/shared/src/` first. Before copying a helper from one package into another, move it to shared instead. When refactoring a feature, treat cross-package duplication as a defect, not style.

### Centralise domain invariants that must apply to every aggregation in a feature

If a predicate or filter must hold for *every* stat computation, rollup, or display in a feature domain, define it as a named helper in `packages/shared/src/<domain>/` — never inline it at each call site. An inlined filter can be silently omitted when a new aggregation is added under time pressure; a named helper cannot.

**Why:** A 2026-05-18 audit found 12+ inlined `matches.filter((m) => !m.remake)` sites across the LoL feature. The remake filter is an explicit invariant (all stat computation must exclude remakes), yet nothing prevented a future aggregation from omitting it. The pattern applies to any domain that has must-hold preconditions — e.g. filtering invalid/incomplete records before aggregation, excluding test/bot accounts, excluding unsupported game modes.

**How to apply:** When writing a new LoL aggregation, call `excludeRemakes()` from `@vyoh/shared` before computing stats — never re-derive `!m.remake` inline. For other feature domains, check whether must-hold preconditions exist and define a named helper in `packages/shared/src/<domain>/` the same way. If the helper doesn't exist yet, create it in the same change.

### Use `useChampionName()` for all champion name display

When rendering a champion's name in any UI component, call `useChampionName()` from `@/lol/champions/use-champions` and use the returned function at the render site — never render a raw alias string directly as a display label.

**Why:** Champion aliases from the Riot API are internal identifiers that diverge from display names for multi-word champions and renamed champions (e.g. `"JarvanIV"` → `"Jarvan IV"`, `"MonkeyKing"` → `"Wukong"`, `"AurelionSol"` → `"Aurelion Sol"`). Rendering the alias produces incorrect UI silently.

**How to apply:** `const championName = useChampionName()` once at the top of the component; call `championName(alias)` at each render site. The hook falls back to a normalized alias while champion data loads, so the string is always safe to render.

### Clickable elements must carry `cursor-pointer`

Any element that is interactive but not a native `<a>` tag must include `cursor-pointer` in its Tailwind class list. Tailwind's preflight resets `<button>` (and other non-anchor elements) to `cursor: default`, so the pointer is never implicit.

**Why:** Without an explicit class, hovering a button-styled chip or icon button shows the text cursor, which breaks the affordance that the element is clickable.

**How to apply:** When adding a `<button>`, `role="button"` div, or any other click target that is not a native link, include `cursor-pointer` in the className. Applies equally to icon-only buttons, shortcut chips, and toggle controls.

### Use `TooltipPrimitive` for all tooltip surfaces; never use `title=`

When an element needs a tooltip, use `import * as TooltipPrimitive from "@radix-ui/react-tooltip"` — never the native HTML `title=` attribute. A `TooltipPrimitive.Provider` with `delayDuration={150}` is already mounted in [`__root.tsx`](../apps/web/src/routes/__root.tsx); do not add another.

Standard compact structure (label-only tooltip, e.g. icon buttons):

```tsx
<TooltipPrimitive.Root>
  <TooltipPrimitive.Trigger asChild>
    {/* the trigger element */}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      side="bottom"
      sideOffset={6}
      className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
    >
      Tooltip label
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
```

For rich or animated tooltips (hover cards, sparkline popovers) use the fuller Content className with `data-[state=...]` open/close animation classes — see [match-pips.tsx:6-7](../apps/web/src/lol/_shared/ui/match-pips.tsx#L6) for the canonical constant.

**Why:** The native `title=` attribute has no styling control, ignores design tokens, cannot be positioned reliably, and doesn't fire on touch.

**How to apply:** Any new element that needs a label or explanation uses `TooltipPrimitive`. Add `aria-label` on the trigger when there is no visible text label (icon-only buttons). Reference: [nav.tsx](../apps/web/src/components/nav.tsx) for the compact form.

### Committed generated files must be documented here

Generated files (codegen output, router manifests, OpenAPI clients, Prisma artefacts) default to gitignored. Commit a generated file only when there is a deliberate reason (e.g. zero-cold-start dev, diff-as-audit-log), and record that reason in this section so the next reviewer doesn't raise it as a defect.

**Currently committed generated files:**

- `apps/web/src/routeTree.gen.ts` — TanStack Router file-based route manifest. Kept tracked so `pnpm dev` works immediately after `pnpm install` without a generate step; the diff also serves as a readable audit log when routes change.

**How to apply:** When introducing a new codegen plugin, decide commit-vs-ignore intentionally and add a line here if committing. When reviewing a PR, a committed generated file without an entry here is a finding.

## Testing

### New interactive surfaces get a test in the same commit

When adding a component that has any of the following, include a test file in the same commit — not as a follow-up:

- Routing (TanStack Router `Link`, `useRouterState`, `useNavigate`)
- Keyboard interaction (keyboard shortcut handlers, `onKeyDown`)
- Custom ARIA roles or `aria-*` attributes beyond simple `aria-label`
- Context providers that drive visible state (e.g. `SplashProvider`, `CommandPaletteProvider`)

**Why:** The T3–T5 hygiene sweep (2026-05-18) found the highest-risk surfaces (command palette, match-detail tab nav, scroll restoration, splash backdrop) had zero tests despite driving most user-perceived behavior. Test-after-the-fact costs more and is easy to defer indefinitely.

**How to apply:** Write the test file alongside the component, not in a separate "add tests" commit. Use the patterns established in `apps/web/src/components/command-palette-dialog.test.tsx` (keyboard shortcut + filter behavior), `apps/web/src/lol/matches/match-detail-tab-nav.test.tsx` (ARIA tab roles), `apps/web/src/lib/use-scroll-reset-on-nav.test.ts` (hook with `renderHook`), and `apps/web/src/components/accessibility.test.tsx` (axe scan). For routing, mock `@tanstack/react-router` per the pattern in `apps/web/src/lol/matches/match-list.test.tsx`.

### Axe-scan new interactive components

When adding a component with interactive elements (buttons, links, dialogs, tabs, custom roles), include an axe scan in the test. Add it to `apps/web/src/components/accessibility.test.tsx` or colocate it in the component's own test file.

**Why:** Axe catches structural a11y gaps (missing dialog titles, unlabelled icon buttons, broken role hierarchy) that are invisible in visual review. The T5 sweep found a real gap: `CommandPaletteDialog` lacked a screen-reader `DialogTitle` that would have been missed indefinitely without the scan.

**How to apply:** Use `configureAxe` from `jest-axe` with `color-contrast` disabled (requires real computed styles) and `aria-hidden-focus` disabled (Radix Dialog false positive in happy-dom). Assert `results.violations` has length 0 so failures print the violation list. See `apps/web/src/components/accessibility.test.tsx` for the canonical setup.

## Environment

### Owner timezone: Brussels

Owner lives near Brussels, Belgium. Use `Europe/Brussels` for any owner-local time bucketing (chronotype hour buckets, daily streak boundaries, "today/yesterday" framing) — not Berlin or UTC.

### Restart Firefox after a devcontainer rebuild

Blank pages or empty-status rows on `localhost:<port>` after a devcontainer rebuild are stale HTTP/2 streams that the browser is holding from the previous container. Storage clears, extension toggling, and ETP exemptions won't fix it — only a Firefox restart does. Mention this proactively if symptoms match.

## Workflow

### Simulating network hangs for timeout verification

Use `10.255.255.1` (RFC1918 black-hole address — TCP SYN goes nowhere, packets drop silently) when verifying that a timeout actually fires. Do not use `.invalid` TLDs (DNS resolves instantly to failure — different code path) or DevTools request blocking (also different code path). Only `10.255.255.1` reproduces a true network-level hang.

### Ask for a dev server restart instead of routing around stale state

When a non-reloaded API/web blocks live verification (Nest cold-start, new env var not picked up, Vite plugin change not HMR'd), ask the owner to restart the relevant dev server immediately. Do not invent workarounds that produce false positives — the cost of asking is a few seconds; the cost of debugging stale state is much higher.

### Verify "file is tracked" claims with `git ls-files` before acting

When an audit or automated tool claims a file is committed to the repo (e.g. "secrets in source", "generated file tracked"), verify with `git ls-files <path>` before raising the alarm or taking remediation steps. Working-tree presence does not imply tracked state — `.gitignore` rules are not always obvious, and acting on a false positive (e.g. rotating API keys that were never committed) wastes time and creates unnecessary churn.
