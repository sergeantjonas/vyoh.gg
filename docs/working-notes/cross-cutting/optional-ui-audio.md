# Optional UI audio

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. **Bold** — opt-in only. A tiny Web Audio system that adds subtle, calm-register UI sounds: tick on palette open, soft chime on match-win render, hush on close, focus blip on shortcut hint. Off by default; toggle in the nav (sound icon); preference persists. Carries portfolio signal because **web apps almost never have sound, gaming UIs always do** — and the project framing puts it on the right side of that contrast.

Read this only after the visual elevation arcs land — audio should complete the picture, not carry it.

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
| `nav.transition` | very faint whoosh | 180ms | route change |
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

## Chunked plan

### Chunk 1 — Asset curation

- **Most important + hardest chunk.** Source 8 sounds matching the tonal direction.
- Edit each: trim, normalize, re-encode `.ogg`.
- Place in `apps/web/public/audio/`. Total bundle: ≤ 50KB.
- Owner approves each sound before code is written.

### Chunk 2 — `AudioBus` + tests

- Implement per pattern above + test (mocking AudioContext).
- Test: respects enabled flag; missing buffer is a no-op; volume change updates gain.

### Chunk 3 — `useAudio` hook + preference persistence

- Hook reads/writes `localStorage.audio-enabled` + `localStorage.audio-volume`.
- React `useSyncExternalStore` for cross-component sync.
- Test: persistence; default off; volume in [0, 1].

### Chunk 4 — Toggle UI in nav

- Sound icon button with popover for volume.
- Reduced-motion has no effect (audio is not motion).
- Axe scan per [repo-conventions.md §Axe-scan](../../repo-conventions.md).

### Chunk 5 — First slot wiring (palette open/close)

- `useAudio()` in [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- Verify on real device — the palette open sound is the "test pilot" for the whole system.
- If the sound feels wrong here, no other slot will save it. Adjust assets if needed.

### Chunk 6 — Roll out remaining slots

- Wire all 8 slots per the table.
- Each at its natural location.
- Visual verification: opt in, navigate the app, every event slot fires its sound.

### Chunk 7 — A11y: `aria-live` polish

- For users who can't hear, the sound carries no information that isn't also visible. Document this guarantee in the audio settings panel.
- Sound enabled state announced via `aria-label` on the toggle.

---

## Files in scope

New:
- `apps/web/src/lib/audio-bus.ts` + test
- `apps/web/src/lib/use-audio.ts` + test
- `apps/web/src/components/audio-toggle.tsx` + test
- `apps/web/public/audio/{palette-open,palette-close,...}.ogg` (×8 assets, ≤50KB total)

Modified:
- `apps/web/src/components/nav.tsx` (mount toggle)
- `apps/web/src/components/command-palette-dialog.tsx` (palette slots)
- `apps/web/src/lol/matches/match-hero.tsx` (win/loss reveal)
- `apps/web/src/components/personal-record.tsx` (record fire)
- Toast/error component (error slot)
- `__root.tsx` (nav transition)

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
