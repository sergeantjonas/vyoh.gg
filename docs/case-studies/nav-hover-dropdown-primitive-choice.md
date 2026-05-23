# Picking the right Radix primitive for a hover-and-click nav dropdown

## TL;DR

The top nav has a "LoL" pill that should reveal an accounts + Patches dropdown on hover and on click. The first implementation built it on `DropdownMenu` with a controlled `open` state and a hover timer; it flickered open-then-shut and then stole focus to the chevron. Bumping the close delay, suppressing focus-auto-shift, and dispatching synthetic `pointerdown` events all failed because the bug wasn't in our hover state machine — it was Radix's *Menu*-specific pointer-tracking heuristic interpreting "controlled open without a real pointerdown on the trigger" as "opened by keyboard," then dismissing on subsequent pointer moves. Swapping to `Popover` removed the heuristic and the dropdown worked — but at the cost of menu semantics and accessibility wiring (`role="menu"` / `role="menuitem"` had to be added by hand). The durable fix was the next primitive in the family: `NavigationMenu`, which is purpose-built for nav-bar dropdowns with native hover + click behaviour, ARIA wiring, and a `delayDuration` knob — three things the previous two primitives had each been only partially right about. The decision tree is a useful artifact in its own right because each wrong primitive failed in a way that *looked* like a state-management bug, when the real signal was "wrong primitive for this interaction pattern."

## Setup

The nav at the top of the app has four pills: Home, LoL, Steam, Status. The LoL pill is special — it's the only one that should expand into a menu of LoL-scoped destinations:

```
LoL ▼
  Accounts
    jonas-euw   europe
    alt-na      americas
  ─────────
  Patches
```

The interaction requirements:

1. **Hover** the pill → menu opens after a short delay.
2. **Click** the pill (mouse or touch) → menu opens immediately.
3. **Hover out** of pill and menu → menu closes after a grace period long enough to cross the gap between the trigger and the menu content.
4. **Touch tap** on the LoL link → navigates directly to `/lol` rather than revealing a menu first (touch users have no hover).
5. **Escape** → closes the menu and returns focus to the trigger for keyboard users.
6. **Tab** through the nav → focus moves logically without trapping in the closed menu.
7. **The pill must stay visually "hovered" while the menu is open**, because the cursor moving into the portaled menu content drops the trigger's `:hover` pseudo-class.

Radix UI is already the project's primitive library; the question was *which* Radix primitive. The repo has shadcn/ui wrappers around `DropdownMenu`, `Popover`, and (eventually) `NavigationMenu`. All three are styled the same way, so visual parity wasn't the deciding factor — interaction behaviour was.

## Attempt 1 — `DropdownMenu` with controlled `open` and a hover timer

The first instinct was: this is a menu of menu items, so use the menu primitive. The implementation paired `DropdownMenu` with a controlled `open` state driven by `onPointerEnter`/`onPointerLeave` on the surrounding pill div, plus a 120 ms close timer to bridge the gap between trigger and content.

```tsx
const [open, setOpen] = useState(false);
const closeTimer = useRef<number | null>(null);

const cancelClose = () => {
  if (closeTimer.current !== null) {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
};
const scheduleClose = () => {
  cancelClose();
  closeTimer.current = window.setTimeout(() => setOpen(false), 120);
};

return (
  <div
    onPointerEnter={() => { cancelClose(); setOpen(true); }}
    onPointerLeave={scheduleClose}
  >
    <Link to="/lol">LoL</Link>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger><ChevronDown /></DropdownMenuTrigger>
      <DropdownMenuContent
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <DropdownMenuItem asChild>
          <Link to="/lol/patches">Patches</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
```

The bug: hover the pill → menu briefly appears → menu disappears → the *chevron button itself* takes focus and displays a visible ring. The user described it as "really buggy, its like the arrow gets focused when I hover over the LoL text."

The instinct was a state-machine bug — open/close racing, or pointer events arriving in the wrong order. Three fixes were tried:

1. **Bump the close delay to 200 ms.** Same flicker.
2. **Add visual hover sync** (`open && !active && "bg-muted/30 text-foreground"`) so the pill stayed hovered while the cursor was in the portaled menu. Helped the pill not flash to "unhovered" but didn't fix the menu dismissing.
3. **Suppress focus auto-shift** on the content (`onOpenAutoFocus={(e) => e.preventDefault()}`) and on close (`onCloseAutoFocus`). The chevron's focus ring went away in some configurations, but the menu still flickered closed.

The fourth attempt was the one that gave away what was actually happening: dispatch a synthetic `pointerdown` event on the trigger from the wrapper's `onPointerEnter` handler, so Radix would see a real pointer interaction:

```tsx
onPointerEnter={() => {
  triggerRef.current?.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true })
  );
}}
```

The result was *worse*: "It actually seems worse now, its always closing now."

That made the failure mode clear. `DropdownMenu` has an internal pointer-tracking heuristic — Radix uses pointer-move ratios across `pointerLeave` boundaries to decide whether the user is intentionally moving toward the menu (keep open) or away from it (close). The heuristic assumes the menu was *opened by a real pointerdown on its trigger*. When the wrapper's hover handler flips `open=true` *without* a corresponding `pointerdown` on the trigger, the heuristic classifies the open event as keyboard-initiated and starts dismissing on subsequent pointer moves. Dispatching a synthetic `pointerdown` raced with the wrapper's own `pointerEnter`-driven open and made things flap faster.

In other words: the heuristic isn't tunable from the outside, and there's no escape hatch on `DropdownMenu` to opt out of it. **The primitive is wrong for hover-driven opens.**

## Attempt 2 — `Popover` with `role="menu"` glued on

Radix's `Popover` shares the same `DismissableLayer` and `Portal` plumbing as `DropdownMenu` (animations, focus handling, click-outside dismissal). What it *doesn't* share is the Menu-specific pointer heuristic. Substituting `Popover` for `DropdownMenu` with the same wrapper hover state worked immediately:

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger aria-label="Open LoL menu">
    <ChevronDown className="size-3.5" aria-hidden />
  </PopoverTrigger>
  <PopoverContent
    role="menu"
    align="end"
    sideOffset={6}
    onOpenAutoFocus={(e) => e.preventDefault()}
    onCloseAutoFocus={(e) => e.preventDefault()}
    onPointerEnter={cancelClose}
    onPointerLeave={scheduleClose}
  >
    <Link to="/lol/patches" role="menuitem">
      Patches
    </Link>
  </PopoverContent>
</Popover>
```

This shipped to the user for verification. Response: "*This seems fine, bit odd we have to rely on popover though.*"

That hesitation was the right instinct. The Popover approach worked, but it had three architectural smells:

1. **Menu semantics added by hand.** A11y tooling and the existing test suite both expected `role="menu"` / `role="menuitem"`, so those had to be glued onto a Popover that wasn't structurally a menu. Roles set this way don't carry the rest of the menu's a11y wiring (typeahead, arrow-key navigation, `aria-haspopup` on the trigger). A screen reader sees a menu shape but doesn't get the menu *behaviour*.
2. **The wrapper's `onPointerEnter` / `onPointerLeave` hover state machine still lived in our code.** Every consumer of this pattern would have to re-implement the same 200 ms close timer, the same touch-pointer skip, the same visual-sync class.
3. **`role="menu"` on a Popover passed axe but failed a manual reader pass** because the trigger's `aria-haspopup` and `aria-expanded` came from Popover semantics (`dialog`), not menu semantics — so the trigger announced "Open LoL menu, dialog button" rather than "LoL, menu button."

Popover *worked*, but the right framing was: we were paying menu-semantics costs to use a non-menu primitive because the menu primitive's hover behaviour was broken.

## Attempt 3 — `NavigationMenu`, the primitive that already knew

The third Radix primitive in this family — `NavigationMenu` — is the one that's purpose-built for nav-bar dropdowns. It has:

- **Native hover-with-delay**: `delayDuration` and `skipDelayDuration` props on the root. No manual `pointerEnter`/`pointerLeave` wiring.
- **Click open**: `NavigationMenuTrigger` is a `<button>` that toggles open on activation, just like `DropdownMenuTrigger`.
- **Touch handling baked in**: tapping the trigger opens the menu rather than navigating; the Item-with-Link pattern handles touch + keyboard activation correctly.
- **Correct ARIA wiring**: trigger announces as a menu-bar trigger; items announce as navigation links; viewport (when used) gets a `region`. None of it has to be glued on by hand.
- **No pointer-tracking heuristic that fights controlled hover-opens** — opens are managed internally by the primitive, not by external state.

The migration replaced the entire hand-rolled `LolPill` + `Popover` block with idiomatic `NavigationMenu` markup:

```tsx
<NavigationMenu viewport={false} delayDuration={100}>
  <NavigationMenuList>
    <SimpleNavItem to="/" label="Home" Icon={Home} />
    <NavigationMenuItem>
      <NavigationMenuTrigger>
        <LeagueOfLegendsIcon /> LoL
        {lolActive && <NavPillHighlight />}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <LolMenuPanel accounts={accounts} defaultLolSlug={defaultLolSlug} />
      </NavigationMenuContent>
    </NavigationMenuItem>
    <SimpleNavItem to="/steam" label="Steam" Icon={SteamIcon} />
    <SimpleNavItem to="/status" label="Status" Icon={Activity} />
  </NavigationMenuList>
</NavigationMenu>
```

The 30 lines of hover state — `useState`, `useRef`, `useEffect` cleanup, `cancelClose`/`scheduleClose`/`HOVER_CLOSE_DELAY_MS`, the touch-pointer skip, the visual-sync className branch — all deleted. The component shrank, and the behaviour got *better* (the heuristic is gone but the keyboard behaviour also improved — arrow keys move between top-level items, Enter opens content, Escape closes and restores focus).

`viewport={false}` is intentional: it makes each `NavigationMenuContent` render in its own absolutely-positioned container next to its `NavigationMenuItem`, instead of in a shared viewport portal. For a nav with only one menu (LoL) today and Steam/Status growing menus tomorrow, per-item content positioning is simpler than reasoning about a shared portal's measurement and transition. The trade-off is that cross-item content morphing (the "shape-shifting megamenu" that the shared viewport enables) is off the table — for a four-pill nav, that's not a feature worth keeping.

## Why three primitives, not one

This arc would be easy to read as "I should have picked NavigationMenu first." That's true, but it understates how much each wrong primitive *almost* worked. The first two failures looked exactly like ordinary state-management bugs:

| Symptom | What it looked like | What it actually was |
|---|---|---|
| Menu flickers open then closes on hover | Race between `setOpen(true)` from wrapper and Radix internals | DropdownMenu's pointer heuristic dismisses controlled opens it didn't see a real `pointerdown` for |
| Chevron gets focus ring after menu closes | Focus auto-shift on close not being suppressed | Same heuristic firing dismissal, which restores focus to the trigger as part of menu-close semantics |
| `dispatchEvent(new PointerEvent("pointerdown"))` makes it worse | Synthetic event ordering bug | The heuristic now sees two compete opens (synthetic + real `pointerEnter`) and the resolution dismisses |
| Popover with `role="menu"` works but axe passes a fraction too cleanly | a11y tooling is permissive | Roles set without primitive semantics don't carry trigger ARIA, typeahead, or arrow-key nav |

Each symptom invited *one more state-machine tweak* rather than a primitive change. The way out wasn't deeper debugging — it was noticing that two primitives in the same family had failed in two different ways for the same interaction (hover + click + menu semantics on a nav bar), and reading that as a primitive-fit problem.

The Radix family-of-primitives design rewards this re-reading. `DropdownMenu`, `Popover`, `NavigationMenu`, `HoverCard`, `ContextMenu` share the same `DismissableLayer`, `Portal`, and `FocusScope` plumbing — they differ in *which interaction pattern they're optimized for*. Picking the right one is mostly about matching the pattern, not negotiating with the wrong one.

## What the test suite told us

The test suite was a leading indicator that something was off. The DropdownMenu version's tests had to use a non-trivial event sequence to open the menu:

```ts
fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
fireEvent.pointerUp(trigger);
fireEvent.click(trigger);
```

That sequence is what `userEvent.click()` would have produced on a real pointer device — three events, in order, with `button: 0` and `ctrlKey: false` set explicitly because Radix's trigger handler checks both. The fact that we needed the full sequence was the test version of the hover bug: Radix wanted a *real* pointer-down-and-up, not a synthesized click.

For `NavigationMenu`, the same sequence works (NavigationMenu also opens on a real pointer click), and the tests carried over with only minor query changes — the LoL trigger went from `getByRole("button", { name: /Open LoL menu/i })` (Popover trigger with `aria-label`) to `getByRole("button", { name: /^LoL$/i })` (NavigationMenu trigger with the visible text "LoL" as its accessible name).

The test diff also caught a behaviour change worth flagging: items inside `NavigationMenuContent` have `role="link"` (because they wrap anchors), not `role="menuitem"`. The earlier Popover-with-glued-on-roles version *did* report `role="menuitem"`, but only because we set it manually. The NavigationMenu version reports the correct role for what the items actually are — anchors that navigate — and the tests query them as links accordingly.

## Lessons

- **A Radix primitive's pointer behaviour is not a config knob; it's part of the primitive choice.** Don't try to talk `DropdownMenu` into being a `NavigationMenu` by tuning timers or dispatching synthetic events. The heuristics are deliberate.
- **"Works but feels hacky" is a signal worth chasing.** The Popover version passed manual testing and passed axe. The hacky-feeling part — gluing on `role="menu"` and `role="menuitem"` — was the signal that the primitive didn't carry the semantics.
- **Read tests as a fit check.** When tests need a non-trivial event sequence to make a primitive cooperate, ask whether the primitive is doing something the production interaction also has to fight.
- **Three primitives in three commits is fine.** The cost of trying the wrong primitive twice and then switching is much lower than the cost of shipping the second-best one and maintaining its accessibility shim forever.

## Follow-up: denormalising for one-query nav bootstrap

Once `NavigationMenu` was in place, the next constraint surfaced. The accounts dropdown wants to show per-account context — current rank, last-played champion — beside each Riot ID. Pulling that on demand when the menu opens is the obvious shape, but it's also the wrong shape:

- The menu opens on hover, so a per-account fetch fan-out happens on cursor pass-by.
- The accounts list is short (≤10) but each row needs a join across `RankSnapshot`, `Match`, and `Participant`. A nav-render fan-out of N queries is a regression vs. the existing static `/me` endpoint.
- The data is already being fetched by the background sync (`@Cron(EVERY_5_MINUTES)` in [apps/api/src/lol/match-sync.service.ts](../../apps/api/src/lol/match-sync.service.ts)) — the dropdown would be re-fetching what the sync just wrote.

The decision was to denormalise: add nullable `currentRankTier`/`currentRankDivision`/`currentRankLp`/`currentRankQueue`/`lastPlayedChampionAlias`/`summaryUpdatedAt` columns to `Summoner`, write them from the existing sync's snapshot capture and match-write paths, and have `/me` include them in the response. Nav bootstrap stays at one query (`/me`), the dropdown reads precomputed strings, and stale rows fall back to the simple row layout. Acceptable because the background sync ticks every five minutes and rank/champion data isn't time-critical for a nav pill.

That arc is its own chunked plan (N1 NavigationMenu primitive switch, D1 schema + sync writeback, D2 `/me` extension + shared types, N2 rich row rendering) and lives in [docs/working-notes/cross-cutting/nav-account-rich-rows.md](../working-notes/cross-cutting/nav-account-rich-rows.md). The primitive-choice arc above ends at N1; the denorm arc is the architectural follow-up that the wrong-primitive detour deferred.

## Cross-references

- [apps/web/src/components/nav.tsx](../../apps/web/src/components/nav.tsx) — the final NavigationMenu-based nav.
- [apps/web/src/components/nav.test.tsx](../../apps/web/src/components/nav.test.tsx) — tests after the primitive switch.
- [apps/web/src/components/ui/navigation-menu.tsx](../../apps/web/src/components/ui/navigation-menu.tsx) — shadcn wrapper around Radix `NavigationMenu`.
- [Radix UI: NavigationMenu](https://www.radix-ui.com/primitives/docs/components/navigation-menu) — primitive reference.
- [docs/repo-conventions.md § Use `TooltipPrimitive` for all tooltip surfaces](../repo-conventions.md) — sibling convention: pick the right Radix primitive for the interaction, don't paper over with native HTML or hand-rolled state.
