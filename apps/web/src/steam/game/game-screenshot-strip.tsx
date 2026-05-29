import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { steamMicrotrailerPosterUrl } from "@/steam/_shared/steam-image";
import { useMatureScreenshotsPref } from "@/steam/_shared/use-mature-screenshots-pref";
import { useGameScreenshots } from "@/steam/game/use-game-screenshots";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type SteamGameTrailer,
  steamScreenshotFullUrl,
  steamScreenshotThumbUrl,
} from "@vyoh/shared";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

// Lazy-load the trailer modal subtree so Shaka's ~250 KB blob never lands
// in the main route bundle — paid only the first time a user clicks a
// trailer thumb. See trailer-modal.tsx for the player setup.
const TrailerModal = lazy(() =>
  import("./trailer-modal").then((m) => ({ default: m.TrailerModal }))
);

// The carousel renders a discriminated union of trailer + screenshot items
// (trailer thumbs sit at index 0..N before the screenshot tail). Click
// dispatch keys on the `kind`: trailer → open TrailerModal at that
// highlight; screenshot → open the existing fullscreen lightbox with its
// VT morph. The carousel itself stays codec-agnostic — renders the thumb
// + optional play badge, lets the dispatch handler decide what to do.

type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

// Page dwell is longer than the hovercard's hover dwell (2.5s), so each
// screenshot needs more time to register before the next fades in.
const SCREENSHOT_ROTATION_MS = 3_500;

// Rotating screenshot carousel slotted on /steam/game/$appid between the
// playtime block and the verdict grid. Reads from the enrichment-backed
// `useGameScreenshots` hook (Chunk 9b in library-card-enrichment.md) — the
// same buckets the library-tile hovercard rotates over, so navigating from a
// tile to the page is a query-cache hit. Hides entirely when the bucket is
// empty (no enrichment row / upstream empty) or while the fetch is in
// flight, so the layout doesn't reserve an empty letterbox.
//
// Driven by Embla via shadcn's `Carousel`, with the `embla-carousel-fade`
// plugin so we keep a cross-fade transition (same visual language as the
// library-tile hovercard) and the `embla-carousel-autoplay` plugin for the
// auto-rotation. Manual scrollPrev/scrollNext go through shadcn's wrapper
// which resets the autoplay timer on each click — no double-advance.
export function GameScreenshotStrip({
  appid,
  trailers = null,
}: {
  appid: number;
  trailers?: SteamGameTrailer[] | null;
}) {
  const { data } = useGameScreenshots(appid);
  const { showMature } = useMatureScreenshotsPref();
  // Bucket policy (the toggle lives in the global Steam preferences popover
  // mounted in the section nav):
  //   - showMature off (default): all-ages; fall back to mature when
  //     all-ages is empty. Steam's storefront default is all-ages-only, but
  //     publisher labels are unreliable — Dark Souls 2 dumps everything in
  //     `mature_content_screenshots` for violence, so the strict default
  //     would leave the page empty for plenty of M-rated games.
  //   - showMature on: union both buckets, sorted by publisher-assigned
  //     ordinal so the strip preserves Steam's storefront order.
  const screenshots = useMemo(() => {
    const allAges = data?.allAges ?? [];
    const mature = data?.mature ?? [];
    const merged = showMature
      ? [...allAges, ...mature].sort((a, b) => a.ordinal - b.ordinal)
      : allAges.length > 0
        ? allAges
        : mature;
    return merged.map((e) => ({
      thumbUrl: steamScreenshotThumbUrl(appid, e.filename),
      fullUrl: steamScreenshotFullUrl(appid, e.filename),
    }));
  }, [data, showMature, appid]);
  // Trailer thumbs sit at the head of the carousel — same layout treatment
  // as a Steam storefront. Each thumb is the publisher's `screenshot_medium`
  // (293×165, 16:9-ish, matches the screenshot strip's aspect). Drop
  // trailers without a usable poster — the play affordance needs a still to
  // sit under, and the modal would still work but the carousel item would
  // be a black square.
  const trailerItems = useMemo(() => {
    if (!trailers)
      return [] as Array<{
        kind: "trailer";
        trailer: SteamGameTrailer;
        thumbUrl: string;
      }>;
    const out: Array<{
      kind: "trailer";
      trailer: SteamGameTrailer;
      thumbUrl: string;
    }> = [];
    for (const trailer of trailers) {
      const poster = trailer.screenshotMedium
        ? steamMicrotrailerPosterUrl(trailer.screenshotMedium)
        : null;
      if (!poster) continue;
      out.push({ kind: "trailer", trailer, thumbUrl: poster });
    }
    return out;
  }, [trailers]);
  // Discriminated union: trailer thumbs first (Steam's storefront order),
  // then screenshots. Single index space, single autoplay rotation —
  // click-time dispatch on `kind` decides which modal opens.
  const items = useMemo(
    () => [
      ...trailerItems,
      ...screenshots.map(
        (s) =>
          ({
            kind: "screenshot",
            thumbUrl: s.thumbUrl,
            fullUrl: s.fullUrl,
          }) as const
      ),
    ],
    [trailerItems, screenshots]
  );
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  // Open trailer modal carries the highlight itself, not just an index —
  // the trailers prop is stable across renders so the reference identity
  // is meaningful, and the modal's effect depends on the trailer object
  // for its Shaka load cycle.
  const [openedTrailer, setOpenedTrailer] = useState<SteamGameTrailer | null>(null);

  // View Transitions morph between the active strip slide and the fullscreen
  // lightbox img. Same-route VT — no navigation involved — so we drive
  // `document.startViewTransition` manually around the Radix Dialog state
  // mutation. Pattern mirrors the library-tile shipped morph (see
  // docs/working-notes/cross-cutting/view-transitions-rollout.md): apply
  // `view-transition-name` synchronously to the source element so it's
  // present at OLD-snapshot capture, clear it inside the callback before
  // the React commit, then set the matching name on the destination so
  // it's present at NEW-snapshot capture.
  //
  // A Map keyed by index lets us look up the active slide's img at click
  // time without re-attaching refs on every render — embla cross-fades
  // between slides during autoplay, so we only want the slide whose index
  // matches `currentIndex` to carry the name.
  const slideRefs = useRef(new Map<number, HTMLImageElement>());
  const lightboxImgRef = useRef<HTMLImageElement | null>(null);
  const setSlideRef = useCallback(
    (i: number) => (el: HTMLImageElement | null) => {
      if (el) slideRefs.current.set(i, el);
      else slideRefs.current.delete(i);
    },
    []
  );

  // Plugins must keep stable identity across renders — Embla re-initialises
  // the engine when the plugin array contents change, and a fresh `Fade()` on
  // every render breaks the in-flight init ("internalEngine on undefined").
  // Refs hold the instances; useMemo gives the array itself a stable
  // reference. Hover-pause covers the passive "user is reading this row"
  // case; modal-pause (below) covers active inspection. `stopOnInteraction:
  // false` keeps rotation going after a chevron click — the shadcn wrapper
  // resets the timer either way.
  const autoplay = useRef(
    Autoplay({
      delay: SCREENSHOT_ROTATION_MS,
      stopOnMouseEnter: true,
      stopOnInteraction: false,
    })
  );
  const fade = useRef(Fade());
  const plugins = useMemo(() => [autoplay.current, fade.current], []);

  // Feature-detect once. When VT is in play, Radix's own enter animation on
  // the lightbox Content must be suppressed — its `data-[state=open]:zoom-in-95`
  // applies a scale(0.95) to the content's ancestor at NEW-snapshot time,
  // which shrinks the morph's destination rect and reads as a subtle pop at
  // morph-end. The exit animation is unaffected (OLD snapshot is captured
  // before any close animation starts) and stays.
  const vtSupported = useMemo(() => supportsViewTransitions(), []);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Snap back to the first frame when navigating between games. The component
  // doesn't remount across /steam/game/$appid changes, so without this we'd
  // open the new game on whatever index the previous one was paused at.
  // biome-ignore lint/correctness/useExhaustiveDependencies: appid is the trigger; body intentionally doesn't read it.
  useEffect(() => {
    if (!api) return;
    api.scrollTo(0, true);
  }, [api, appid]);

  // Map carousel index → screenshot index. Returns null when the active
  // carousel slot is a trailer (which has no corresponding fullUrl). Used
  // by the lightbox preload, arrow-key handler, and prev/next buttons —
  // everything that's screenshot-specific needs to translate out of the
  // mixed items[] index space.
  const screenshotIdxFromCarousel =
    items[currentIndex]?.kind === "screenshot"
      ? currentIndex - trailerItems.length
      : null;

  // Freeze autoplay while EITHER modal is open so the strip stays on the
  // frame the user clicked into, then resume on close. Guarded on `api`
  // because `useEmblaCarousel` defers `plugin.init` until after a viewport-
  // ref callback re-renders the carousel — without the guard, the first
  // mount fires `plugin.play()` before autoplay's internal emblaApi is set,
  // and Embla throws "internalEngine on undefined" out of `documentIsHidden`.
  //
  // ALSO guarded on items.length > 1: embla-carousel-autoplay@8 early-exits
  // its own init() when there's a single slide, leaving its internal
  // `delay` array uninitialised. A later play() then crashes accessing
  // `delay[selectedScrollSnap()]`. Games with one trailer + zero loaded
  // screenshots hit this exact shape, so the gate is real, not theoretical.
  useEffect(() => {
    if (!api) return;
    if (items.length <= 1) return;
    const plugin = autoplay.current;
    if (modalOpen || openedTrailer !== null) plugin.stop();
    else plugin.play();
  }, [modalOpen, openedTrailer, api, items.length]);

  // Preload neighbour full-res screenshots while the lightbox is open so
  // prev/next there feels snappy instead of network-bound on each step.
  // Skips when the active item isn't a screenshot (the trailer modal has
  // no equivalent preload path; Shaka handles its own segment fetching).
  useEffect(() => {
    if (!modalOpen || screenshots.length <= 1) return;
    if (screenshotIdxFromCarousel === null) return;
    const next = screenshots[(screenshotIdxFromCarousel + 1) % screenshots.length];
    const prev =
      screenshots[
        (screenshotIdxFromCarousel - 1 + screenshots.length) % screenshots.length
      ];
    for (const s of [next, prev]) {
      if (s) {
        const img = new Image();
        img.src = s.fullUrl;
      }
    }
  }, [modalOpen, screenshotIdxFromCarousel, screenshots]);

  // Eagerly cache the active full-res whenever it changes (autoplay rotation,
  // manual scroll, initial mount) so the first lightbox open per game has a
  // decoded bitmap by NEW-snapshot time. Without this the JPEG is fetched
  // cold on click and streams top-down, so the VT pseudo captures a half-
  // loaded image — the bottom half then reads as a white flash during the
  // morph.
  useEffect(() => {
    if (screenshotIdxFromCarousel === null) return;
    const s = screenshots[screenshotIdxFromCarousel];
    if (!s) return;
    const img = new Image();
    img.src = s.fullUrl;
  }, [screenshotIdxFromCarousel, screenshots]);

  // Arrow keys inside the lightbox — `Carousel`'s own keydown handler is
  // scoped to its <section>, which doesn't reach the Radix portal. Bind at
  // window level while the modal is open; Radix still owns Escape. Steps
  // through screenshots only (skipping trailers); we scroll the carousel
  // to the mapped item index so the source rect for the next VT morph
  // tracks the lightbox content.
  useEffect(() => {
    if (!modalOpen || !api || screenshots.length <= 1) return;
    if (screenshotIdxFromCarousel === null) return;
    const baseOffset = trailerItems.length;
    const idx = screenshotIdxFromCarousel;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        api.scrollTo(baseOffset + ((idx + 1) % screenshots.length));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        api.scrollTo(baseOffset + ((idx - 1 + screenshots.length) % screenshots.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    modalOpen,
    api,
    screenshots.length,
    screenshotIdxFromCarousel,
    trailerItems.length,
  ]);

  // Intercept Radix's open/close to wrap the state mutation in a view
  // transition. Both directions flow through here (Trigger click, X button,
  // Escape, Overlay click) so we only need this one handler. flushSync
  // forces the React commit before the callback resolves so the destination
  // element is in the DOM at NEW-snapshot capture; otherwise the browser
  // captures the pre-mutation DOM and the morph snaps.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      const doc = document as DocumentWithVT;
      if (!supportsViewTransitions() || !doc.startViewTransition) {
        setModalOpen(next);
        return;
      }
      const sourceEl = next
        ? slideRefs.current.get(currentIndex)
        : lightboxImgRef.current;
      if (!sourceEl) {
        setModalOpen(next);
        return;
      }
      const name = `screenshot-${appid}`;
      sourceEl.style.viewTransitionName = name;
      const transition = doc.startViewTransition(() => {
        sourceEl.style.viewTransitionName = "";
        flushSync(() => setModalOpen(next));
        const destEl = next
          ? lightboxImgRef.current
          : slideRefs.current.get(currentIndex);
        if (destEl) destEl.style.viewTransitionName = name;
      });
      transition.finished.finally(() => {
        const destEl = next
          ? lightboxImgRef.current
          : slideRefs.current.get(currentIndex);
        if (destEl) destEl.style.viewTransitionName = "";
      });
    },
    [appid, currentIndex]
  );

  // Defer carousel mount until the screenshots query has settled — even
  // if the parent already has trailers ready, mounting with a single
  // trailer item and then re-rendering with N more items once screenshots
  // load triggers embla-carousel-autoplay's known broken-state path: its
  // init() early-exits when scrollSnapList <= 1 (leaving `delay`
  // uninitialised), and a later play() then crashes accessing
  // `delay[selectedScrollSnap()]`. Waiting for `data` to be defined
  // guarantees one stable item count at first paint. The brief flash of
  // no-strip during a ~30-100ms screenshot fetch is acceptable; carousel
  // jank from broken autoplay is not.
  if (data === undefined) return null;
  if (items.length === 0) return null;
  const activeItem = items[currentIndex];
  if (!activeItem) return null;
  const activeScreenshot =
    screenshotIdxFromCarousel !== null
      ? (screenshots[screenshotIdxFromCarousel] ?? null)
      : null;
  const hasMultiple = items.length > 1;
  const triggerAriaLabel =
    activeItem.kind === "trailer"
      ? `Play ${activeItem.trailer.trailerName ?? "trailer"}`
      : `View screenshot ${(screenshotIdxFromCarousel ?? 0) + 1} of ${screenshots.length} fullscreen`;

  return (
    <DialogPrimitive.Root open={modalOpen} onOpenChange={handleOpenChange}>
      <Carousel
        opts={{ loop: true, duration: 60 }}
        plugins={plugins}
        setApi={setApi}
        className="group"
      >
        {/* The aspect-ratio wrapper anchors everything: the embla viewport
            fills it, and the dispatch button + chevrons + counter overlay it. */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
          <CarouselContent className="ml-0 h-full">
            {items.map((item, i) => (
              <CarouselItem
                key={item.thumbUrl}
                className="relative h-full basis-full pl-0"
                aria-label={
                  item.kind === "trailer"
                    ? `Trailer: ${item.trailer.trailerName ?? "Unnamed"}`
                    : `Screenshot ${i - trailerItems.length + 1} of ${screenshots.length}`
                }
              >
                <img
                  ref={setSlideRef(i)}
                  src={item.thumbUrl}
                  alt=""
                  // Prime the first two so the strip's opening frame and its
                  // immediate next are already decoded by the time autoplay
                  // ticks. The rest stay lazy.
                  loading={i <= 1 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
                {item.kind === "trailer" && (
                  // Centered play badge tells the viewer this slot is a
                  // trailer, not a screenshot. `pointer-events-none` keeps
                  // the click target as the overlay button below.
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
                      <Play className="size-7 fill-white text-white" />
                    </div>
                  </div>
                )}
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Single overlay button dispatches on the active item kind:
              trailers open the TrailerModal at that highlight; screenshots
              open the existing fullscreen lightbox with its VT morph.
              Chevrons sit above at z-20; clicks on them don't bubble
              through to here because they're siblings, not ancestors. */}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={triggerAriaLabel}
            onClick={() => {
              if (activeItem.kind === "trailer") {
                setOpenedTrailer(activeItem.trailer);
              } else {
                handleOpenChange(true);
              }
            }}
            className="absolute inset-0 z-10 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />

          {hasMultiple && (
            <StripControls totalCount={items.length} currentIndex={currentIndex} />
          )}
        </div>
      </Carousel>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={`fixed top-1/2 left-1/2 z-50 max-h-[95vh] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95${vtSupported ? "" : " data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"}`}
        >
          {/* Visually hidden — Radix Dialog requires an accessible name. */}
          <DialogPrimitive.Title className="sr-only">
            Game screenshot {(screenshotIdxFromCarousel ?? 0) + 1} of {screenshots.length}
          </DialogPrimitive.Title>
          {/* width/height reserve the 16:9 layout box before pixels arrive
              so the VT NEW snapshot captures a stable rect on first open per
              game. Without them, `fullUrl` is uncached on first lightbox open
              and the img reports natural 0×0, which produces a destination
              rect of 0×0 at the page origin — the morph then plays back as
              "shrink and fly to top-left corner". Actual served pixels may be
              smaller; `object-contain` centers them inside the reserved box. */}
          {activeScreenshot && (
            <img
              ref={lightboxImgRef}
              src={activeScreenshot.fullUrl}
              alt=""
              width={1920}
              height={1080}
              className="block max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            />
          )}
          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={() => {
                  if (screenshotIdxFromCarousel === null) return;
                  const prev =
                    (screenshotIdxFromCarousel - 1 + screenshots.length) %
                    screenshots.length;
                  api?.scrollTo(trailerItems.length + prev);
                }}
                className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={() => {
                  if (screenshotIdxFromCarousel === null) return;
                  const next = (screenshotIdxFromCarousel + 1) % screenshots.length;
                  api?.scrollTo(trailerItems.length + next);
                }}
                className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronRight className="size-6" />
              </button>
              <div className="pointer-events-none absolute right-0 bottom-3 left-0 text-center text-sm text-white/80 tabular-nums">
                {(screenshotIdxFromCarousel ?? 0) + 1} / {screenshots.length}
              </div>
            </>
          )}
          <DialogPrimitive.Close className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      {/* TrailerModal is a sibling to the lightbox Dialog — independent
          open state, independent focus trap, no interference between the
          two. Mounted only while a trailer is open so Shaka unmounts +
          releases its MediaSource on close (see trailer-modal.tsx). */}
      {openedTrailer && (
        <Suspense fallback={null}>
          <TrailerModal
            trailer={openedTrailer}
            open={openedTrailer !== null}
            onOpenChange={(next) => {
              if (!next) setOpenedTrailer(null);
            }}
          />
        </Suspense>
      )}
    </DialogPrimitive.Root>
  );
}

function StripControls({
  totalCount,
  currentIndex,
}: {
  totalCount: number;
  currentIndex: number;
}) {
  const { scrollPrev, scrollNext } = useCarousel();
  return (
    <>
      <button
        type="button"
        aria-label="Previous screenshot"
        onClick={scrollPrev}
        className="absolute top-1/2 left-2 z-20 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Next screenshot"
        onClick={scrollNext}
        className="absolute top-1/2 right-2 z-20 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
      >
        <ChevronRight className="size-5" />
      </button>
      <div className="pointer-events-none absolute right-2 bottom-2 z-20 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/85 opacity-0 transition-opacity group-hover:opacity-100">
        {currentIndex + 1} / {totalCount}
      </div>
    </>
  );
}
