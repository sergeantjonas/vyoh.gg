# Personal record moments

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. Subtle one-time visual celebration when an aggregated stat hits a new personal best — highest KDA on a champion, longest win streak, fastest game won, most CS/min, etc. Replaces the "loud" vocabulary (confetti, fireworks, slot-machine) with **a calm radial flare via CSS conic gradient + `@starting-style`** that fires once on detection, then fades into the new stat's normal styling.

Read this before adding any new aggregation or "personal" stat that has the concept of "best ever." Coordinates with the [personal-baselines.md](../lol/personal-baselines.md) and [post-game-close-the-loop.md](../lol/post-game-close-the-loop.md) arcs.

KB anchors: [03-motion.md §choreography](~/.claude/knowledge/frontend-2026/03-motion.md), [01-css-and-styling.md §motion CSS](~/.claude/knowledge/frontend-2026/01-css-and-styling.md). Reduced-motion guidance from [03-motion.md §6](~/.claude/knowledge/frontend-2026/03-motion.md).

---

## Why

The closing-the-loop arc and the personal baselines arc both produce "your best ever" stats. Currently those numbers display flat — same typography, same color, no acknowledgment that the user just achieved something. A gaming dashboard *specifically* should mark personal records: that's the emotional payoff that op.gg/u.gg structurally cannot replicate ([vnext-ideas.md](vnext-ideas.md) framing).

But the project has hard guardrails: **no confetti, no slot-machine vibes, no tacky gradients** ([motion-backlog.md](motion-backlog.md)). The visual must be:
- Brief (≤ 1.2s peak, fully decayed by 2.5s).
- Once-only (no replay on every page visit).
- Calm — chromatic but low-saturation, low-amplitude.
- Information-bearing — the user should *know* it's a celebration, not a UI bug.

A **radial flare** behind the stat number — a soft conic gradient that fades in, rotates a quarter-turn, fades out — fits all four. It's the visual equivalent of a slow exhale, not a slot win.

---

## What this is NOT

- **Not confetti, fireworks, particle bursts, "WOW" toasts.** Explicitly forbidden.
- **Not a sound effect.** Audio is its own arc ([optional-ui-audio.md](optional-ui-audio.md)) and is opt-in.
- **Not a notification.** No toast, no banner, no dismissible artifact. The moment lives entirely *inside* the stat cell, then disappears.
- **Not always on.** Reduced-motion replaces the flare with a static glow (one-time, fades after 4s) so the information lands without animation.

---

## When does it fire

A "personal record" is detected when, on first render of an updated aggregation, the new value strictly improves the prior persisted value on a metric where higher (or lower, for inverted metrics like time-to-win) is better. Detection happens in a shared helper, not at each call site:

```ts
// packages/shared/src/lol/personal-records.ts
export function isPersonalRecord<T extends StatKey>(
  prior: number | undefined,
  next: number,
  direction: "higher-better" | "lower-better",
): boolean {
  if (prior === undefined) return false; // first record is not a "new record"
  if (direction === "higher-better") return next > prior;
  return next < prior;
}
```

State persistence:
- Per-stat-per-account "best ever" values cached in `localStorage` keyed by `${accountSlug}:${stat}` — survives refresh, doesn't replay endlessly.
- Server-side persisted in a `personal_records` table (per `personal-baselines.md`) once that ships; localStorage is the bootstrap.

The flare fires on the **transition** from the prior value to the new value. If localStorage shows a record was already celebrated for this stat-value pair, no replay.

---

## Visual treatment

```css
@property --flare-progress {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

.pr-flare {
  position: relative;
}

.pr-flare::before {
  content: '';
  position: absolute;
  inset: -20%;
  background: conic-gradient(
    from calc(var(--flare-progress) * 1turn),
    transparent 0deg,
    color-mix(in oklch, var(--accent) 60%, transparent) 20deg,
    transparent 60deg,
    color-mix(in oklch, var(--accent) 40%, transparent) 220deg,
    transparent 280deg
  );
  filter: blur(12px);
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  transition: opacity 220ms ease-out, --flare-progress 1200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.pr-flare[data-record-fire="true"]::before {
  opacity: 1;
  --flare-progress: 0.25; /* quarter-turn rotation */
}

@starting-style {
  .pr-flare[data-record-fire="true"]::before {
    opacity: 0;
    --flare-progress: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pr-flare[data-record-fire="true"]::before {
    transition: opacity 400ms ease-out;
    --flare-progress: 0.25;
  }
}
```

Then a JS effect sets `data-record-fire="true"` on mount of a record-bearing stat, schedules `setTimeout(() => setAttribute("data-record-fire", "false"), 1800)` to start the decay, and `localStorage.setItem(key, newValue)` to prevent replay.

The result: a soft golden-ish arc (tinted by route accent from [accent-color-system.md](accent-color-system.md)) sweeps behind the stat number once, decays out, and the stat sits at its new value with normal styling.

### Companion micro-affordance

A tiny "↑ PB" superscript appears next to the number for 5 seconds, then fades, leaving just the number. Pattern reuses `<HeroLabel>` from [editorial-typography.md](editorial-typography.md) at a smaller size.

---

## Where it applies

| Surface | Stat | Direction |
|---|---|---|
| Champion detail hero | Highest KDA on this champion | higher-better |
| Champion detail | Best win streak on this champion | higher-better |
| Profile | Longest overall win streak | higher-better |
| Profile | Highest LP this season | higher-better |
| Profile | Most games in a week | higher-better (if framed positively) |
| Match detail hero | Fastest win | lower-better |
| Match detail | Most CS/min in a ranked game | higher-better |
| Trends | Best KDA period | higher-better |

Each surface registers as a record-bearing stat via a shared wrapper:

```tsx
<PersonalRecord
  storageKey="kda-on-jinx"
  value={currentKda}
  direction="higher-better"
>
  <HeroNumber>{currentKda.toFixed(2)}</HeroNumber>
</PersonalRecord>
```

---

## Chunked plan

### Chunk 1 — `isPersonalRecord` helper + tests

- `packages/shared/src/lol/personal-records.ts`.
- Pure function; both directions covered; edge cases (undefined prior, equal values, NaN).

### Chunk 2 — `<PersonalRecord>` wrapper component

- `apps/web/src/components/personal-record.tsx` + test.
- Reads from localStorage; compares to prop; sets `data-record-fire` if new record; persists.
- Tests: first-time render does NOT fire (no prior); subsequent improvement fires; equal value does not fire; localStorage prevents replay across mounts.

### Chunk 3 — CSS flare in `motion.css`

- Add the `@property` + `.pr-flare` rule per pattern above.
- Add reduced-motion variant.
- Cross-browser test: conic gradient + `@property` + blur composition renders consistently in Chrome/Safari/Firefox.

### Chunk 4 — Apply to first surface (champion detail KDA)

- Wrap the KDA hero number in `<PersonalRecord storageKey="kda-on-${alias}" direction="higher-better">`.
- Visual verification: manually clear localStorage for a champion, navigate to that champion, simulate "new record" by editing the data. Observe the flare.
- Tune the timing constants (220ms entry, 1.2s sweep, 800ms decay) if needed.

### Chunk 5 — Apply to Profile, match detail, trends surfaces

- Per the table above.
- Each wraps with the appropriate storageKey + direction.

### Chunk 6 — Server-side persistence (post personal-baselines)

- Once [personal-baselines.md](../lol/personal-baselines.md) lands a `personal_records` table, switch from localStorage to server-persisted state.
- Adds cross-device consistency.
- Migration: read localStorage on first server-fetch; merge highest values.

---

## Files in scope

New:
- `packages/shared/src/lol/personal-records.ts` + test
- `apps/web/src/components/personal-record.tsx` + test

Modified:
- `apps/web/src/styles/motion.css` (flare rule)
- Champion detail, profile, match detail, trends surfaces (Chunks 4–5)

---

## Risks / open questions

- **localStorage quota.** ~5MB per origin; this arc adds tiny string-keyed values — negligible.
- **First-load awkwardness.** A brand-new account has no prior records, so the first session shows zero flares even though every stat technically *is* a personal best. Acceptable — record implies improvement on a known baseline. Document in a help tooltip.
- **Records on stale data.** If the user navigates back to a champion they haven't played in months, the cached "best ever" might still beat the current stat. Make sure the comparison happens against the cached *best* value, not the most recent.
- **Flare in dense layouts.** Conic gradient + blur behind a stat cell uses the parent's space. In dense grids, the flare might bleed into siblings. Test on champion detail's stat row.
- **Replay on browser refresh.** localStorage persists, so refresh doesn't replay. But navigating away and back within the same session could — guard with a session-level "already fired this mount" check.

---

## Reduced motion

- **Rotating sweep**: replaced with static color glow that fades in (400ms) and out (400ms after 1.5s hold). Information (a record happened) is preserved; the rotation animation is dropped.
- **Superscript "↑ PB" affordance**: stays exactly the same — it's the actual content communication.

See [reduced-motion-replacements.md](reduced-motion-replacements.md) for the broader pattern.
