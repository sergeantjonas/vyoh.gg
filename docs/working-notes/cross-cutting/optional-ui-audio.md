# Optional UI audio

**Status:** Shipped 2026-06-11 (synth v1). Web Audio synthesis substitute for the curated-asset path that originally specced this arc — owner had no `.ogg` library to draw from, and the asset-curation gate would have parked the whole thing. Synth recipes (sine + additive + filtered-noise + LFO-wobble) ship the full 8-slot vocabulary at zero asset weight. **Default off, opt-in via nav toggle (popover with volume slider) and `Shift+M`/command palette `Toggle sound`. Preference persists in `localStorage`.** Warm-acoustic v2 (curated sourced samples) is parked in [parked.md](../parked.md) — same slot map, swap the recipe layer.

Read for: the slot vocabulary, system-design notes, and the call-site inventory below. The synth-recipe file is the source of truth for what each slot sounds like — descriptions here are intent.

KB anchors: [16-web-platform-apis.md §Web Audio](~/.claude/knowledge/frontend-2026/16-web-platform-apis.md) (if covered; verify) + Web Audio MDN.

---

## Why and why-not

**Why it's worth shipping:**
- It's the kind of feature reviewers screenshot and *mention*, because it's surprising. The OG image, the splash backdrop, the View Transitions — those are visible without prompting. Audio is the kind of touch you only encounter if you *use* the site, which makes it a "I actually tried this" badge.
- Game UIs always carry sound. The project is a gaming dashboard. There's an aesthetic alignment.
- Implementation cost is small: ~5 sound assets, a hook, a toggle, persistence. ~150 LOC total.

**Why it's risky:**
- Wrong audience hates audio in web apps. Hence opt-in, off by default.
- Sounds that are even slightly off-tone read as cheap/spammy. Asset curation matters more than code.
- Browser autoplay policies — must defer `AudioContext` creation until user gesture.

**The opt-in design is what makes it safe.** Default-off + persistent preference + visible toggle. The right reviewer enables it; the wrong reviewer never knows.

---

## What this is NOT

- **Not background music.** Discrete event sounds only.
- **Not LoL/Steam game audio (champion VO, game effects).** Way too on-the-nose. The sounds are *UI*, not *content*.
- **Not loud.** Default volume 30%, configurable. Sounds peak at < -18dB.
- **Not on every interaction.** Only on specific event slots. Hovering a card is not an event. Clicking a button is not an event. Opening the palette IS.

---

## Sound vocabulary

A small, deliberate set:

| Slot | Sound character | Duration | Where it fires |
|---|---|---|---|
| `palette.open` | low soft tick | 80ms | ⌘K opens |
| `palette.close` | breath-out | 120ms | ⌘K closes |
| `palette.select` | warm pluck | 100ms | result confirmed |
| `nav.transition` | soft downward swoop (440→220Hz exponential) | 160ms | route change |
| `match.win` | distant chime | 600ms | match-detail hero reveals a win |
| `match.loss` | soft thud | 400ms | match-detail hero reveals a loss |
| `record.fire` | gentle bell | 800ms | personal record moment from [personal-record-moments.md](personal-record-moments.md) |
| `error.toast` | low warble | 300ms | toast/error appears |

8 sounds total. **Curated, not generated.** Source from [freesound.org](https://freesound.org/) (CC) or a paid pack like [Splice](https://splice.com/). Each sound is normalized to a target peak, trimmed, re-encoded as `.ogg` (best Web compatibility + small size) at ≤ 5KB per file (~40KB total).

Tonal direction: **warm acoustic, never digital/synth.** Wooden plucks, glass bells, soft breath sounds. Anti-cliché: no 80s computer beeps, no glassy "iPhone unlock" tones.

---

## System design

### `AudioBus` singleton

`apps/web/src/lib/audio-bus.ts`:

```ts
class AudioBus {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private masterGain: GainNode | null = null;
  enabled = false;
  volume = 0.3;

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  async load(name: string, url: string) {
    if (!this.ctx) return;
    if (this.buffers.has(name)) return;
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(name, decoded);
  }

  play(name: string) {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    source.start();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}

export const audioBus = new AudioBus();
```

### `useAudio()` hook

Subscribes to user preference (`localStorage` or future server-side preference); calls `audioBus.play(slot)` at the right place.

```ts
export function useAudio() {
  return useCallback((slot: AudioSlot) => audioBus.play(slot), []);
}
```

Call sites are tiny:
```tsx
const playAudio = useAudio();
useEffect(() => { playAudio("palette.open"); }, []);
```

### Boot sequence

- User toggles audio on for the first time (`localStorage.setItem("audio-enabled", "true")`).
- Toggle handler must be a user gesture (click) → safe to call `audioBus.init()` then `audioBus.load(...)` for all assets in parallel.
- Subsequent page loads: read localStorage; if enabled, **wait for first user gesture** (click anywhere) before initializing the AudioContext (browser autoplay policy). Could also defer initialization until first sound slot fires.

### Toggle UI

Sound icon in nav (Lucide `Volume2` / `VolumeX`):
- Click toggles state.
- Long-press (or shift-click) opens a Radix Popover with a volume slider.
- Both states have `aria-label` describing the state ("Sound off", "Sound on (30%)").

---

## Chunked plan (shipped 2026-06-11)

Synth substitution replaced the original asset-curation chunk; the rest of the plan executed as written.

- **Chunk 1 — ~~Asset curation~~ → Synth recipes (shipped).** [`apps/web/src/lib/audio-recipes.ts`](../../../apps/web/src/lib/audio-recipes.ts) exports 4 helpers (`playSine`, `playAdditive`, `playNoiseBurst`, `playWobble`) and `SOUND_RECIPES` for all 8 slots. Zero bundle weight (~150 LOC of pure synth).
- **Chunk 2 — `AudioBus` + tests (shipped).** [`apps/web/src/lib/audio-bus.ts`](../../../apps/web/src/lib/audio-bus.ts) + [test](../../../apps/web/src/lib/audio-bus.test.ts). Gesture-gated init, enabled flag, volume routing, suspended-context resume.
- **Chunk 3 — `useAudio` hook + persistence (shipped).** [`apps/web/src/lib/use-audio.ts`](../../../apps/web/src/lib/use-audio.ts) + [test](../../../apps/web/src/lib/use-audio.test.ts). `useSyncExternalStore`; `vyoh:audio-enabled` + `vyoh:audio-volume` keys; default 0.3 volume; cross-component sync.
- **Chunk 4 — Toggle UI in nav (shipped).** [`apps/web/src/components/audio-toggle.tsx`](../../../apps/web/src/components/audio-toggle.tsx) + axe-scanned [test](../../../apps/web/src/components/audio-toggle.test.tsx). Popover with switch + volume slider, confirmation sample on first activation.
- **Chunk 4b — Shortcut + palette entry (shipped).** `Shift+M` global keydown via [`use-audio-shortcut.ts`](../../../apps/web/src/lib/use-audio-shortcut.ts) (skipped while typing). "Toggle sound" action in [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) under the Actions group.
- **Chunk 5 — Palette slots (shipped).** `palette.open`/`palette.close` via prev-state ref in [command-palette.tsx](../../../apps/web/src/components/command-palette.tsx); `palette.select` in `go()` inside [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- **Chunk 6 — Remaining slots (shipped).** `nav.transition` in [__root.tsx](../../../apps/web/src/routes/__root.tsx) scope-change effect; `match.win`/`match.loss` in [match-hero.tsx](../../../apps/web/src/lol/matches/match-hero.tsx) mount-only effect (skipped on remakes); `record.fire` in [personal-record.tsx](../../../apps/web/src/components/personal-record.tsx) detection branch; `error.toast` via `onError` on the top-level `ErrorBoundary` in [__root.tsx](../../../apps/web/src/routes/__root.tsx).
- **Chunk 7 — A11y polish (shipped via existing wiring).** Toggle button carries `aria-label` reflecting state + percentage. Switch role `aria-checked`. Slider labelled. Sound carries no information not also visible.

## Call-site inventory

| Slot | Fires at | File |
|---|---|---|
| `palette.open` | `open=false → true` | [command-palette.tsx](../../../apps/web/src/components/command-palette.tsx) |
| `palette.close` | `open=true → false` | [command-palette.tsx](../../../apps/web/src/components/command-palette.tsx) |
| `palette.select` | item selection in `go()` | [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) |
| `nav.transition` | `router.subscribe("onResolved")` | [__root.tsx](../../../apps/web/src/routes/__root.tsx) |
| `match.win` | match-hero mount, win | [match-hero.tsx](../../../apps/web/src/lol/matches/match-hero.tsx) |
| `match.loss` | match-hero mount, loss | [match-hero.tsx](../../../apps/web/src/lol/matches/match-hero.tsx) |
| `record.fire` | PB detection | [personal-record.tsx](../../../apps/web/src/components/personal-record.tsx) |
| `error.toast` | ErrorBoundary onError | [__root.tsx](../../../apps/web/src/routes/__root.tsx) |

---

## Post-ship calibration (2026-06-11)

Tuning notes from same-day playtest feedback. The owner heard the palette confirmation but not nav transitions; after the autoplay-resume + router-event fix, the original `nav.transition` recipe (highpass-filtered noise burst) read as unpleasantly sibilant. Final state:

- **AudioContext autoplay handling.** `AudioBus.init()` now calls `ctx.resume()` defensively (the gesture-coupled resume couldn't be deferred to the first `play()` reliably; Chrome's contract is "resume must be called inside the gesture context that created the ctx"). `play()` defers recipe execution into the resume promise when ctx is suspended — recipes pin envelopes to `ctx.currentTime` which is frozen while suspended, so inline scheduling against a suspended ctx silently no-ops.
- **Default volume bumped 0.3 → 0.5.** Recipe peaks (0.15–0.4) × master 0.3 was below the casual-listening floor on laptop speakers.
- **`nav.transition` routing fix.** Original wiring used a `useRouterState({ select: pathname })` selector. Selectors fall silent for routes that opt into their own entrance (`ownsEntry: true` — currently `/` and `/lol/$accountSlug`) because the React commit shape they advertise doesn't re-emit cleanly mid-VT. Replaced with `router.subscribe("onResolved", ...)` which fires once per resolved navigation regardless of entry ownership or View Transitions.
- **`nav.transition` recipe swap.** Highpass noise burst (`durationMs: 180, highpassHz: 2000, peak: 0.15→0.3`) → exponential sine swoop (`fromFreq: 440, toFreq: 220, durationMs: 160, peak: 0.22`). The new `playSwoop` helper joined the synth toolkit; `playNoiseBurst` was removed (no other recipe used it). Reads as a calm "page settles" instead of the prior tssh.

## Files in scope

New:
- `apps/web/src/lib/audio-bus.ts` + test
- `apps/web/src/lib/audio-recipes.ts` (synth recipes — replaces the originally-specced `.ogg` assets)
- `apps/web/src/lib/use-audio.ts` + test
- `apps/web/src/lib/use-audio-shortcut.ts` + test
- `apps/web/src/components/audio-toggle.tsx` + test

Modified:
- `apps/web/src/components/nav.tsx` (mount toggle)
- `apps/web/src/components/command-palette.tsx` (palette open/close hook)
- `apps/web/src/components/command-palette-dialog.tsx` (palette.select + Actions group)
- `apps/web/src/lol/matches/match-hero.tsx` (win/loss reveal)
- `apps/web/src/components/personal-record.tsx` (record fire)
- `apps/web/src/routes/__root.tsx` (audio hooks, nav.transition via `router.subscribe`, error.toast via `onError`)

---

## Risks / open questions

- **Asset curation is the bottleneck.** Bad sounds tank the whole feature. Allocate real time to source + edit. Owner approval gate before code.
- **Mobile autoplay.** iOS Safari is the strictest. Verify the user-gesture-triggered init works on iOS.
- **Bundle inclusion.** Audio files should not block initial render. Lazy-load on first opt-in (or pre-load only if `audio-enabled` is `true` on boot).
- **AudioContext leakage.** Closing the AudioContext on visibility change saves CPU but adds setup cost on return. Probably ignore unless profiling shows pain.
- **The "wrong on first encounter" risk.** A user who hits the toggle accidentally and is startled by a sound will turn it back off immediately. UX: first activation could play `palette.open` as a confirmation sample so the user knows what they just enabled.

---

## Reduced motion

`prefers-reduced-motion` is about motion, not audio. They are independent preferences.

For users with motion-sensitivity, audio may even be a *desired* alternative — e.g. "I want to know the palette opened but I can't process the slide-in animation." Consider: when reduced-motion is set AND audio is enabled, slightly emphasize the audio cue (full volume on event slots that previously had a visual flourish).

This is a thoughtful touch worth a sentence in a case-study writeup.
