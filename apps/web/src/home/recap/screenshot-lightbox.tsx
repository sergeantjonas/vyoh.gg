import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type SteamScreenshotEntry,
  steamScreenshotFullUrl,
  steamScreenshotThumbUrl,
} from "@vyoh/shared";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Chapter-closer screenshot strip with a Radix Dialog lightbox. Scoped to
 * the recap-chapter use case: a small horizontal row of 16:9 thumbnails
 * that open into a full-viewport viewer with prev/next + ESC + arrow-key
 * navigation. Mirrors the lightbox UX from
 * `apps/web/src/steam/game/game-screenshot-strip.tsx` but without the
 * weight that surface carries (carousel library, trailer multiplexing,
 * mature-content filter, autoplay video) — those belong to game-detail,
 * not to a per-chapter polish band.
 */
export function ScreenshotLightboxStrip({
  appid,
  screenshots,
  thumbClassName = "h-20 w-auto",
  nudged = true,
  baseDelay = 0,
}: {
  appid: number;
  screenshots: SteamScreenshotEntry[];
  thumbClassName?: string;
  /**
   * Reveal gate — flips true once the chapter is in pin position. Drives the
   * per-thumb stagger so the strip cascades in after the peak chips. Default
   * `true` so tests render visible without threading state.
   */
  nudged?: boolean;
  /** Seconds before the first thumb begins its reveal. Subsequent thumbs follow at +0.04s each. */
  baseDelay?: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Scroll-aware edge fades — only fade the side where content actually
  // extends past the visible area. Symmetric masking faded the left edge
  // at rest position, which read as ornamental (nothing was hidden behind
  // the fade). Now: right-only at rest, both when scrolled into the
  // middle, left-only at the end, neither when the strip fits.
  const stripRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const updateEdges = useCallback(() => {
    const ul = stripRef.current;
    if (!ul) return;
    const overflow = ul.scrollWidth - ul.clientWidth;
    setEdges({
      left: ul.scrollLeft > 4,
      right: overflow > 4 && ul.scrollLeft < overflow - 4,
    });
  }, []);
  useLayoutEffect(() => {
    const ul = stripRef.current;
    if (!ul) return;
    updateEdges();
    ul.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(ul);
    return () => {
      ul.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);
  // Re-measure when the screenshot list changes — the ul's own box size
  // doesn't change with content, so ResizeObserver won't catch this.
  useEffect(() => {
    if (screenshots.length === 0) return;
    updateEdges();
  }, [screenshots.length, updateEdges]);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        const next = (current + delta + screenshots.length) % screenshots.length;
        return next;
      });
    },
    [screenshots.length]
  );

  // Keyboard navigation — ESC closes via Radix's built-in handling, ←/→
  // step. Only mounted while the lightbox is open so the listener isn't a
  // forever-on cost in the chapter.
  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, step]);

  if (screenshots.length === 0) return null;
  const active = openIndex !== null ? screenshots[openIndex] : null;

  return (
    <DialogPrimitive.Root
      open={openIndex !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Horizontally-scrollable strip — fits all screenshots regardless of
          how many the game ships, without forcing a wrap that would push
          the chapter past the 1-viewport pin. Native scrollbar hidden via
          standard `scrollbar-width: none`. Scroll affordance is layered:
          an ambient mask fade on the overflow side (subtle texture) plus
          a chevron chip that fades in only when overflow exists in that
          direction (explicit "more this way" + click target that scrolls
          the strip ~75% of its width). Fade alone proved too subtle on
          dark splash backgrounds — the chip is the load-bearing cue.
          Snap-x lands a thumb cleanly when scrolling via touchpad or
          touch. */}
      <div className="relative">
        <ul
          ref={stripRef}
          // px-3 + py-1 inset keeps the first/last thumbs' hover ring + scale
          // + shadow-lg bloom (~10px blur) inside the scroll container's
          // clip box. `scroll-px-3` mirrors the padding into the snap
          // mechanism — without it, snap-start aligns the first thumb's
          // edge with the *snap-port* start (the outer edge of the padding
          // box), dragging scrollLeft to +12 to make that alignment work
          // and eating the inset that was meant to protect the hover
          // bloom. With scroll-padding matching, scrollLeft=0 IS the rest
          // snap position. Proximity (not mandatory) so transient layout
          // shifts from the entrance reveal don't re-snap mid-hover.
          className="flex snap-x snap-proximity flex-nowrap items-center gap-2 overflow-x-auto scroll-px-3 px-3 py-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          style={(() => {
            const left = edges.left ? "24px" : "0px";
            const right = edges.right ? "24px" : "0px";
            const mask = `linear-gradient(to right, transparent 0, black ${left}, black calc(100% - ${right}), transparent 100%)`;
            return {
              maskImage: mask,
              WebkitMaskImage: mask,
              transition: "mask-image 200ms ease, -webkit-mask-image 200ms ease",
            };
          })()}
        >
          {screenshots.map((s, i) => {
            const delay = baseDelay + i * 0.04;
            return (
              <li
                key={s.filename}
                className="shrink-0 snap-start"
                style={{
                  opacity: nudged ? 1 : 0,
                  transform: nudged ? "translateY(0)" : "translateY(8px)",
                  transition: `opacity 600ms ease-out ${delay}s, transform 600ms ease-out ${delay}s`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`Open screenshot ${i + 1} of ${screenshots.length}`}
                  className="group block cursor-pointer overflow-hidden rounded-md ring-1 ring-white/10 transition-[transform,box-shadow,filter] duration-200 ease-out hover:scale-[1.03] hover:shadow-lg hover:shadow-black/40 hover:brightness-110 hover:ring-2 hover:ring-[color:var(--accent,theme(colors.foreground))]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <img
                    src={steamScreenshotThumbUrl(appid, s.filename)}
                    alt=""
                    loading="lazy"
                    className={thumbClassName}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {/* Edge chevron chips — explicit "more this way" affordance that
            fades in only when overflow exists on that side. Clicking
            scrolls the strip ~75% of its width. Pointer-events-none on
            the wrapper container so the chips don't block hover on the
            thumbs underneath; the chips themselves re-enable pointer
            events. */}
        <button
          type="button"
          aria-label="Scroll screenshots left"
          tabIndex={edges.left ? 0 : -1}
          onClick={() => {
            const ul = stripRef.current;
            if (!ul) return;
            ul.scrollBy({ left: -Math.round(ul.clientWidth * 0.75), behavior: "smooth" });
          }}
          className="-translate-y-1/2 absolute top-1/2 left-1 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-opacity duration-200 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          style={{
            opacity: edges.left ? 1 : 0,
            pointerEvents: edges.left ? "auto" : "none",
          }}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Scroll screenshots right"
          tabIndex={edges.right ? 0 : -1}
          onClick={() => {
            const ul = stripRef.current;
            if (!ul) return;
            ul.scrollBy({ left: Math.round(ul.clientWidth * 0.75), behavior: "smooth" });
          }}
          className="-translate-y-1/2 absolute top-1/2 right-1 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-opacity duration-200 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          style={{
            opacity: edges.right ? 1 : 0,
            pointerEvents: edges.right ? "auto" : "none",
          }}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 max-h-[95vh] max-w-[95vw] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">
            {active
              ? `Screenshot ${(openIndex ?? 0) + 1} of ${screenshots.length}`
              : "Screenshot"}
          </DialogPrimitive.Title>
          {active ? (
            // width/height reserve the layout box before pixels arrive so
            // first-open doesn't render at natural 0×0 (mirror of the
            // game-detail lightbox rationale).
            <img
              src={steamScreenshotFullUrl(appid, active.filename)}
              alt=""
              width={1920}
              height={1080}
              className="block max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            />
          ) : null}
          {screenshots.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => step(-1)}
                className="-translate-y-1/2 absolute top-1/2 left-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => step(1)}
                className="-translate-y-1/2 absolute top-1/2 right-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronRight className="size-6" />
              </button>
              <div className="-translate-x-1/2 pointer-events-none absolute bottom-3 left-1/2 rounded-full bg-black/55 px-2.5 py-1 text-white/90 text-xs tabular-nums backdrop-blur-sm">
                {(openIndex ?? 0) + 1} / {screenshots.length}
              </div>
            </>
          ) : null}
          <DialogPrimitive.Close className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
