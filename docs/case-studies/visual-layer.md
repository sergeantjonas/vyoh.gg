# Visual layer: SplashProvider, scope-keyed transitions, and LazyMotion domMax

A few patterns worth flagging that are easy to break by accident.

## SplashProvider

`SplashProvider` lives at the root. Consumers call `useSplashChampion(name, offsetX?)` to publish the active champion; the provider preloads via `image.decode()` and crossfades through `AnimatePresence` keyed on the champion alias. The backdrop persists across route changes with a 100ms grace window — earlier prototypes that rendered the backdrop inside the route component flashed dark on every navigation because the portal unmounted and remounted. The image is anchored `object-top` (so short viewports crop the bottom, never the champion's face) and treated with a small `blur(5px) saturate(0.92)` filter to soften the ~2× upscale of the 720p source. While the real image decodes, a `react-blurhash` canvas seeded by the precomputed hash is rendered immediately so the page never shows an empty hole. The horizontal offset (default `22%`) shifts the focal subject into the right margin — the central content column otherwise hides it; the value is set once via `useSplashChampion` and applied via a single transform on the wrapper, so navigations between pages don't slide the backdrop horizontally.

## Splash hoisted to the LoL layout

The original implementation called `useSplashChampion` from each leaf route, which meant the backdrop unmounted whenever the user crossed sub-tabs (matches → trends → champions). The active champion now lives at the `$accountSlug.tsx` layout: it picks a random initial champion from the loaded matches and exposes a `HoverChampionProvider` so the matches list and champions table can override it on card hover via a context-shared setter. The context lives in a non-route file (`apps/web/src/lol/hover-champion-context.tsx`) — when it lived inside the route file, the bundler's path resolution between `$accountSlug.tsx` (file) and `$accountSlug/index.tsx` (directory index) instantiated two distinct contexts and the consumer always saw `null`.

## Scope-keyed AnimatePresence

The root layout keys on the *first* path segment (`"/" | "/lol" | "/steam"`), so top-level navigation animates while sub-tab switches inside `/lol/$slug/...` don't re-mount the LoL header + tabs. A second `AnimatePresence` inside `$accountSlug.tsx` handles the inner sub-tab transition.

## LazyMotion features must be domMax

`domAnimation` (the lighter bundle) doesn't include layout animations, so the sliding nav pill, the LoL sub-tab underline, and the trend-count selector all silently stop animating if you downgrade. Cost is ~5 kB gzip — accepted.

## Radix Tooltip with portal and collision detection

Item hover cards on match detail use Radix's `Tooltip` primitive with `side="top"` defaulting and auto-flip to `bottom` when the trigger is near the viewport top. Portaling out of the row also frees them from any `overflow-hidden` ancestor that would otherwise clip them — important when the tooltip is taller than the participant row that triggered it.
