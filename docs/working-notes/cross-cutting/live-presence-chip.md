# Live presence chip

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. A small always-visible chip in the nav showing what the owner is doing **right now** across LoL + Steam (and future streams): "Playing Jinx · Mid · 14:32" / "In Cyberpunk 2077 · 2h 14m today" / "Last seen 2h ago — VEX won 7-2-12". Pushed via SSE; animates as it updates.

Read this before scoping any "live" UI surface; coordinate with the LoL `Live` route (already exists in some form per [vnext-ideas.md](vnext-ideas.md) "Live game minute pulse") and the Riot spectator endpoint.

KB anchors: [15-realtime-state-forms.md §SSE vs WebSocket](~/.claude/knowledge/frontend-2026/15-realtime-state-forms.md), [16-web-platform-apis.md §Page Lifecycle](~/.claude/knowledge/frontend-2026/16-web-platform-apis.md).

---

## Why

The site already carries "what am I doing right now" as the synthesis-page premise ([repo-conventions.md §`/` is synthesis-only](../../repo-conventions.md), [self-portrait-surfaces.md](self-portrait-surfaces.md)). Surfacing it in the **nav** — visible on every page — makes the entire app feel alive in a way no other single change can. It's the "the lights are on, someone is home" signal.

Why now-now-ish (still Tier 3 because of API coordination):
- Riot spectator endpoint gives current-game data with ~1 min lag.
- Steam Web API gives "currently playing" reasonably reliably for the owner's account.
- The visual is small (one chip), so the engineering can be incremental — ship "last seen" first, "live" second.

This is *the* feature that turns the site from "stats dashboard" into "presence beacon." Strong portfolio signal for "real-time-aware engineer."

---

## What this is NOT

- **Not a full live game viewer.** That's a separate route (already in `/lol/$accountSlug/live`-ish).
- **Not multi-user.** Owner-only presence. Multi-account aggregation is a Phase-2 idea.
- **Not always-on polling.** SSE push or visibility-aware polling — the chip pauses updates when the tab is hidden ([16-web-platform-apis.md §Page Lifecycle](~/.claude/knowledge/frontend-2026/16-web-platform-apis.md)).

---

## States

The chip transitions between four states:

1. **Live (in-game)** — green dot, pulsing.
   - LoL: `"Playing Jinx · Mid · 14:32"` (champion + role + game time).
   - Steam: `"In Cyberpunk 2077 · 2h 14m today"`.
2. **In queue / lobby (LoL only)** — amber dot, slow pulse.
   - `"In queue · Solo/Duo"`.
3. **Just finished** — blue dot, no pulse, time-decayed.
   - `"VEX · 7/2/12 · WON 4m ago"` for the first ~15 min after a match end.
   - Crossfades to "Last seen" after the decay window.
4. **Last seen / idle** — muted dot, no animation.
   - `"Last seen 2h ago"`.
   - Hides entirely after ~7 days of inactivity (chip becomes a brand glyph only).

Click on the chip:
- **Live**: navigate to `/lol/$accountSlug/live` (or Steam game detail).
- **Just finished**: navigate to the match detail.
- **Last seen**: navigate to `/lol/$accountSlug` (profile).

Hover/focus opens a tooltip with a short richer detail (KDA so far in live game, lobby queue, etc.).

---

## Data flow

### Server side (NestJS)

- New `apps/api/src/presence/presence.module.ts`.
- `PresenceService.getCurrentPresence(accountSlug)` returns `{ state: 'live' | 'inQueue' | 'justFinished' | 'lastSeen' | 'idle', meta: {...} }`.
- Polls upstreams behind a short cache (10–30s):
  - Riot spectator API (`/lol/spectator/v5/active-games/by-summoner/{puuid}`) — `404` means not in game.
  - Last completed match end-time (already cached locally).
  - Steam: `GetPlayerSummaries` for `gameid` and `gameextrainfo`.
- Exposes `GET /presence/:accountSlug/stream` as SSE — pushes the latest presence state every time it changes; clients reconnect with `Last-Event-ID` for free.

Why SSE over WebSocket per [KB §SSE vs WebSocket decision shortcut](~/.claude/knowledge/frontend-2026/README.md): one-way server→client (presence updates), built-in reconnect, no extra protocol. SSE is exactly right here.

### Client side

- Hook `usePresenceStream(accountSlug)` opens an `EventSource` and surfaces the latest state.
- Pauses on `visibilitychange` (closes `EventSource` when hidden, reopens when visible).
- Falls back to polling (`setInterval` 30s) if SSE is unavailable (corporate proxies, etc.).
- Tied into TanStack Query cache so the "last seen" data composes with profile queries.

---

## Visual treatment

```
┌──────────────────────────────────────────┐
│  ●  Playing Jinx · Mid · 14:32           │
└──────────────────────────────────────────┘
```

- ~28px tall, fits nav rhythm.
- Dot: 8px circle, color per state. Pulsing dots animate `scale(1) → scale(1.5)` over 1.4s, opacity `1 → 0`, infinite.
- Text: editorial typography per [editorial-typography.md](editorial-typography.md) — uppercase tracked label for "Playing"/"Last seen" + emphatic name for the entity.
- Truncates with ellipsis on narrow screens; full text in tooltip.
- Updates animate text crossfade (existing AnimatePresence pattern).
- Game time ticks once per second when live (the only second-resolution updating element in the chip).

Reduced-motion: dot doesn't pulse. Text changes still animate at faster duration (instant snap is jarring). See [reduced-motion-replacements.md](reduced-motion-replacements.md).

---

## Chunked plan

### Chunk 1 — Server-side presence service (last-seen only)

- `PresenceService` reads only from the local match DB; returns "Last seen Xh ago — {champion} {kda} {outcome}".
- HTTP endpoint `GET /presence/:accountSlug` (not SSE yet, just JSON).
- Test: returns correct payload for various account states.

### Chunk 2 — Client chip with last-seen state

- `apps/web/src/components/presence-chip.tsx` + test.
- Mounted in nav.
- Renders only "Last seen / idle" state from Chunk 1's JSON endpoint.
- Polls every 60s; refetch on `visibilitychange → visible`.
- Visual verification: chip looks right at all viewport sizes.

### Chunk 3 — Live state via Riot spectator

- Wire spectator endpoint in `PresenceService` with 30s cache.
- Add "Live" + "Just finished" + "In queue" states (when computable).
- Test: spectator 404 → not-live; spectator 200 → live with champion + role.

### Chunk 4 — SSE stream endpoint

- Convert HTTP polling to SSE.
- `GET /presence/:accountSlug/stream` emits `data: <json>\n\n` per change.
- Heartbeat every 25s to keep proxies happy.
- Test: integration — open EventSource, mock upstream state change, observe push.

### Chunk 5 — Client SSE hook + visibility pause

- Replace polling with `EventSource` in `presence-chip.tsx`.
- Pause on `visibilitychange → hidden`; reopen on visible.
- Fall back to polling if EventSource construction throws or stays in CONNECTING > 5s.
- Test: visibility change closes/reopens connection.

### Chunk 6 — Steam presence

- Add `GetPlayerSummaries` polling to `PresenceService` (30–60s).
- New state shape extension: `state: 'live' | ..., source: 'lol' | 'steam'`.
- Disambiguation rule: if both LoL and Steam say "playing," prefer LoL (more interesting in this app's framing). Document the rule.

### Chunk 7 — Tooltip / hover detail

- Hover the chip → Radix Tooltip with richer detail.
- For live LoL game: current KDA, vision, gold; pulls from match-in-progress data if available.
- For Steam: total playtime, achievement %.

### Chunk 8 — A11y + reduced motion + offline fallback

- Chip has `aria-live="polite"` so screen readers announce state changes.
- Reduced-motion: dot doesn't pulse; text changes use snap, not crossfade.
- Offline: chip stays at last-known state with an offline indicator.
- Axe scan per [repo-conventions.md §Axe-scan](../../repo-conventions.md).

---

## Files in scope

New:
- `apps/api/src/presence/presence.module.ts`
- `apps/api/src/presence/presence.service.ts` + test
- `apps/api/src/presence/presence.controller.ts` + test
- `apps/web/src/components/presence-chip.tsx` + test
- `apps/web/src/lib/use-presence-stream.ts` + test

Modified:
- `apps/web/src/components/nav.tsx` (mount the chip)
- Possibly extend Riot client and Steam client for the new endpoints

---

## Risks / open questions

- **Riot spectator endpoint rate limits.** Spectator is a relatively cheap endpoint but if the cache leaks (multiple users, multiple devices), can burst. The owner-only constraint helps; verify with Bottleneck-instrumented logs.
- **Steam API "currently playing" reliability.** Steam reports `gameextrainfo` only when the profile is public and in-game. Owner's profile must stay public for this to work; document the requirement.
- **SSE behind corporate proxies.** Some proxies buffer SSE; fall back to polling is essential.
- **Cold start spectator delay.** Riot's spectator endpoint can lag 60–120s behind actual game start. Document this — "Playing X" may appear up to 2 min after the queue accept.
- **Privacy.** Public site, public data, owner consents. Future multi-user scenarios need consent UX.
- **Cost.** A 30s cache + multiple page views = many spectator calls. Single Redis-cached upstream call would be the prod-quality answer; for now NodeCache or in-memory Map is fine until Redis lands.

---

## Reduced motion

- **Pulsing dot**: replaced with static solid dot. Information (state color) preserved.
- **Text crossfade on update**: replaced with snap, not removal. Crossfade is decoration; the state change itself is the information.

Connection-state changes (offline indicator) always animate (necessary state communication).
