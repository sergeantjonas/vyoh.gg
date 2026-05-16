import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { useGameMedia } from "@/steam/library/use-game-media";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Page dwell is longer than the hovercard's hover dwell (2.5s), so each
// screenshot needs more time to register before the next fades in.
const SCREENSHOT_ROTATION_MS = 3_500;

// Rotating screenshot carousel slotted on /steam/game/$appid between the
// playtime block and the verdict grid. Reuses the appdetails-backed
// `useGameMedia` hook + the 30-day server cache that the library-tile
// hovercard primes — most game pages visited after a hover are zero-cost.
// Hides entirely when the upstream returned no screenshots (delisted / demo
// / region-blocked) or while the fetch is in flight, so the layout doesn't
// reserve an empty letterbox.
//
// Driven by Embla via shadcn's `Carousel`, with the `embla-carousel-fade`
// plugin so we keep a cross-fade transition (same visual language as the
// library-tile hovercard) and the `embla-carousel-autoplay` plugin for the
// auto-rotation. Manual scrollPrev/scrollNext go through shadcn's wrapper
// which resets the autoplay timer on each click — no double-advance.
export function GameScreenshotStrip({ appid }: { appid: number }) {
  const { data: media } = useGameMedia(appid, true);
  const screenshots = media?.screenshots ?? [];
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

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

  // Freeze autoplay while the lightbox is open so the strip stays on the
  // frame the user clicked into, then resume on close. Guarded on `api`
  // because `useEmblaCarousel` defers `plugin.init` until after a viewport-
  // ref callback re-renders the carousel — without the guard, the first
  // mount fires `plugin.play()` before autoplay's internal emblaApi is set,
  // and Embla throws "internalEngine on undefined" out of `documentIsHidden`.
  useEffect(() => {
    if (!api) return;
    const plugin = autoplay.current;
    if (modalOpen) plugin.stop();
    else plugin.play();
  }, [modalOpen, api]);

  // Preload neighbour full-res screenshots while the lightbox is open so
  // prev/next there feels snappy instead of network-bound on each step.
  useEffect(() => {
    if (!modalOpen || screenshots.length <= 1) return;
    const next = screenshots[(currentIndex + 1) % screenshots.length];
    const prev =
      screenshots[(currentIndex - 1 + screenshots.length) % screenshots.length];
    for (const s of [next, prev]) {
      if (s) {
        const img = new Image();
        img.src = s.fullUrl;
      }
    }
  }, [modalOpen, currentIndex, screenshots]);

  // Arrow keys inside the lightbox — `Carousel`'s own keydown handler is
  // scoped to its <section>, which doesn't reach the Radix portal. Bind at
  // window level while the modal is open; Radix still owns Escape.
  useEffect(() => {
    if (!modalOpen || !api || screenshots.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        api.scrollNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        api.scrollPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, api, screenshots.length]);

  if (screenshots.length === 0) return null;
  const active = screenshots[currentIndex];
  if (!active) return null;
  const hasMultiple = screenshots.length > 1;

  return (
    <DialogPrimitive.Root open={modalOpen} onOpenChange={setModalOpen}>
      <Carousel
        opts={{ loop: true, duration: 60 }}
        plugins={plugins}
        setApi={setApi}
        className="group"
      >
        {/* The aspect-ratio wrapper anchors everything: the embla viewport
            fills it, and the Trigger + chevrons + counter overlay it. */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
          <CarouselContent className="ml-0 h-full">
            {screenshots.map((s, i) => (
              <CarouselItem
                key={s.thumbUrl}
                className="h-full basis-full pl-0"
                aria-label={`Screenshot ${i + 1} of ${screenshots.length}`}
              >
                <img
                  src={s.thumbUrl}
                  alt=""
                  // Prime the first two so the strip's opening frame and its
                  // immediate next are already decoded by the time autoplay
                  // ticks. The rest stay lazy.
                  loading={i <= 1 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Single overlay button to open the lightbox — keeps tab order to
              one focusable surface for the strip itself. Chevrons sit above
              at z-20; clicks on them don't bubble through to here because
              they're siblings, not ancestors. */}
          <DialogPrimitive.Trigger
            type="button"
            aria-label={`View screenshot ${currentIndex + 1} of ${screenshots.length} fullscreen`}
            className="absolute inset-0 z-10 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />

          {hasMultiple && (
            <StripControls totalCount={screenshots.length} currentIndex={currentIndex} />
          )}
        </div>
      </Carousel>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[95vh] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          {/* Visually hidden — Radix Dialog requires an accessible name. */}
          <DialogPrimitive.Title className="sr-only">
            Game screenshot {currentIndex + 1} of {screenshots.length}
          </DialogPrimitive.Title>
          <img
            src={active.fullUrl}
            alt=""
            className="block max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          {hasMultiple && (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={() => api?.scrollPrev()}
                className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={() => api?.scrollNext()}
                className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronRight className="size-6" />
              </button>
              <div className="pointer-events-none absolute right-0 bottom-3 left-0 text-center text-sm text-white/80 tabular-nums">
                {currentIndex + 1} / {screenshots.length}
              </div>
            </>
          )}
          <DialogPrimitive.Close className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
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
