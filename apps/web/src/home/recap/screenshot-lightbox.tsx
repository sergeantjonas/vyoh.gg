import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type SteamScreenshotEntry,
  steamScreenshotFullUrl,
  steamScreenshotThumbUrl,
} from "@vyoh/shared";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
}: {
  appid: number;
  screenshots: SteamScreenshotEntry[];
  thumbClassName?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
      <ul className="flex flex-wrap items-center gap-2">
        {screenshots.map((s, i) => (
          <li key={s.filename}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`Open screenshot ${i + 1} of ${screenshots.length}`}
              className="group block cursor-pointer overflow-hidden rounded-md ring-1 ring-white/15 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <img
                src={steamScreenshotThumbUrl(appid, s.filename)}
                alt=""
                loading="lazy"
                className={thumbClassName}
              />
            </button>
          </li>
        ))}
      </ul>

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
              <div className="pointer-events-none absolute top-3 right-0 left-0 text-center text-sm text-white/80 tabular-nums">
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
