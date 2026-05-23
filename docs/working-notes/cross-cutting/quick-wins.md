# Quick wins punch list

**Status:** Standing backlog of small, atomic improvements surfaced during the elevation-arcs sweep (2026-05-23). Each item is one-shot — file scope hint, short why, no chunk plan needed. Pick one off when you want a 10–30 minute pickup between bigger arcs.

If an item grows past "one PR" once you start it, move it into its own arc note in this directory and remove the entry here.

---

## Fully atomic (pure CSS/HTML, no design call)

- **`text-wrap: balance` on headings** — `apps/web/src/styles/globals.css` on `h1, h2, h3`. Removes orphan words in hero titles; one declaration, modern-browser only (graceful degrade).
- **`scrollbar-gutter: stable both-edges` on `<main>`** — `apps/web/src/routes/__root.tsx` or globals. Stops the 15px layout shift when content grows past the viewport between routes.
- **`accent-color: var(--accent)` on form controls** — globals. Native checkboxes, radios, range sliders pick up the route accent. Free polish once [accent-color-system.md](accent-color-system.md) Chunk 1 lands.
- **`font-variant-numeric: tabular-nums` sweep on stat numbers** — grep for `font-mono` on numeric displays; replace with `tabular-nums` to keep proportional letterforms but lock digit widths. Stops the jitter when CountUp ticks.
- **`mask-image` fade edges on horizontal scrollers** — match-pip rows, champion icon strips, any horizontal overflow region. `mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)` makes the scrollable region read as scrollable without scrollbars.
- **`::selection` per route** — `::selection { background: color-mix(in oklch, var(--accent) 40%, transparent); }` in globals. Highlight color matches the route accent. Tiny touch, surprisingly noticeable on text-heavy pages.
- **Per-tab favicon dot** — `<link rel="icon">` swap based on presence state (live game → green dot, just-finished → blue, idle → default). Drop-in hook; pairs with [live-presence-chip.md](live-presence-chip.md) but doesn't need it.
- **iOS PWA polish** — `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`, `theme-color` per route accent, `manifest.json` review. Owner uses iOS; the app currently looks like a generic web bookmark on the home screen.

## Small feature (~30–60 min, no notes needed)

- **`interpolate-size: allow-keywords`** — globals. Enables `height: auto` ⇄ `height: 0` transitions (currently impossible). Replaces 5+ Motion AnimatePresence height animations with pure CSS. Safari 26+ / Chrome 129+.
- **`field-sizing: content` on inputs that need it** — command palette input, any single-line filter input. Input grows with content; no JS measurement. Chrome 123+.
- **HTML `popover` attribute where it fits** — light tooltips, simple disclosure menus that aren't already Radix. Native top-layer, ESC-to-dismiss, light-dismiss for free. Don't replace existing Radix overlays — those have richer behavior.
- **`<link rel="modulepreload">` for likely-next route chunks** — `__root.tsx`. Preload `/lol/$accountSlug` and `/steam` route bundles. Pair with [speculation-rules-prefetch.md](speculation-rules-prefetch.md) but cheaper.
- **`<picture>` art-direction for splash backdrop on mobile** — currently the same 1920×1080 splash is served everywhere. Mobile can take the 960×540 variant. Save real KB on first paint.
- **Print stylesheet** — `@media print { ... }` to render a clean match-detail or champion-detail page as a printable summary. Niche but signals craft — and reviewers do print things.

## Tier-2-ish (small but design-touching — drop a paragraph in a new note before picking up)

- **Calendar heatmap** — GitHub-style year-of-games grid on profile. Needs grid sizing/color-scale decision; small note, then implement.
- **SVG `<feTurbulence>` noise overlay** — film-grain texture on splash backdrops at 3% opacity. Needs to be tested per-champion (busy splashes overcrowd); small visual call.
- **WebShare API** — share button on match/profile pages. Decide what the share payload looks like (title, text, url, OG image link).
- **Generative visitor identity glyph** — small SVG that hashes the visitor's IP/UA into a unique 4-shape mark, shown in the corner. Anti-cliché twist on "Hello, you". Needs design direction.

## Engineering-trust (worth doing, no UX surface)

- **Trusted Types + CSP nonces** — `Content-Security-Policy` with `require-trusted-types-for 'script'`. Signals security awareness on a public site. Vite + Nest both support it; mostly a config + script-source audit.
- **Sigstore signing on the deployment artifact** — `cosign sign` in CI. Reviewer who clicks "verify" sees a real signature. Niche but unmissable signal.

## Bolder bets (need their own arc note before pickup)

These were surfaced in the sweep but are big enough that a chunked working-note is required first. Listed here so they don't get forgotten:

- **Houdini PaintWorklet** — custom paint for repeating textures (could replace `<feTurbulence>` noise with a worklet). Research-y.
- **Public status page** — `/status` route showing Riot rate-limit headroom, last successful sync, queue depth. Engineering-trust signal.
- **Service Worker offline cache** — view last-fetched match-detail when offline. Coordinates with PWA polish above.
- **RSS/Atom feed for matches** — `/lol/$accountSlug/matches.atom`. Niche but characterful.
- **iCal feed for Steam wishlist release dates** — `/steam/wishlist.ics`. Adds release dates to the owner's (and visitor's) calendar.
- **Daily snapshot auto-generated image** — once-a-day OG image of "today's session" pushed to a discoverable URL. Pairs with [og-image-pipeline.md](og-image-pipeline.md).

---

## How to use this list

- Pick the smallest item that catches your eye when you have ≤30 min of focus.
- Items in "Fully atomic" should be one commit each. No notes, no audit, just the change + a non-mutating verification.
- Items in "Small feature" can be one commit too; if scope balloons, write a working-note and remove from this list.
- "Tier-2-ish" and "Bolder bets" REQUIRE a note before code — they exist here only to keep the ideas alive.
- When you ship an item, delete it from this list. The file stays small; if it ever empties, the sweep has fully landed.
