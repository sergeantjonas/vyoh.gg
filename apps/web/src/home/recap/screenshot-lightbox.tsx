import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type SteamScreenshotEntry,
  steamScreenshotFullUrl,
  steamScreenshotThumbUrl,
} from "@vyoh/shared";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type CSSProperties, useCallback, useEffect, useState } from "react";

/**
 * Chapter-closer screenshot strip with a Radix Dialog lightbox. Scoped to
 * the recap-chapter use case: a slow auto-drifting filmstrip marquee of
 * 16:9 thumbnails plus a contact-sheet index label per frame, opening
 * into a full-viewport viewer with prev/next + ESC + arrow-key
 * navigation. Mirrors the lightbox UX from
 * `apps/web/src/steam/game/game-screenshot-strip.tsx` but without the
 * weight that surface carries (carousel library, trailer multiplexing,
 * mature-content filter, autoplay video) — those belong to game-detail,
 * not to a per-chapter polish band.
 *
 * Why marquee instead of scrollable-with-chevrons: a user-driven scroll
 * strip in the closer beat reads as "active UI to operate" when the
 * beat's role is "lingering on the game" — ambient B-roll, not a media
 * gallery. The slow drift turns the strip into atmosphere, not chrome.
 * Hover / focus pause so click targets are stable when the user wants to
 * engage; nudge gate keeps the drift off while the beat isn't active.
 *
 * Under `prefers-reduced-motion`: no drift, no duplication — the strip
 * renders as a single static ul with `overflow-x: auto` for manual
 * scroll. Same content, same lightbox, no animation.
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
  const reducedMotion = useReducedMotion();
  // Pointer-tracked pause — flips true on hover / focus-within / pointer-
  // down so click targets are stable when the user wants to engage with a
  // thumbnail. Combined with `nudged` (off while beat isn't active) and
  // `reducedMotion` (always off) to derive the actual animation play
  // state. Pointer events (not mouseenter/leave) cover touch + mouse
  // uniformly.
  const [pointerPaused, setPointerPaused] = useState(false);

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

  // Resolved animation state — drift only when the beat is active AND the
  // user isn't engaging AND reduced motion is off.
  const driftRunning = !reducedMotion && nudged && !pointerPaused;

  // Renders one thumb as a button. Used for both the visible original
  // copy and the aria-hidden marquee duplicate (the duplicate's buttons
  // get `tabIndex={-1}` + `aria-hidden` via the wrapping ul, so they're
  // invisible to assistive tech and to test queries).
  const renderThumb = (s: SteamScreenshotEntry, i: number) => {
    const delay = baseDelay + i * 0.04;
    const indexLabel = `S${String(i + 1).padStart(2, "0")}`;
    const reveal: CSSProperties = {
      opacity: nudged ? 1 : 0,
      transform: nudged ? "translateY(0)" : "translateY(8px)",
      transition: `opacity 600ms ease-out ${delay}s, transform 600ms ease-out ${delay}s`,
    };
    return (
      <li key={s.filename} className="shrink-0 snap-start" style={reveal}>
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
        {/* Contact-sheet index label — "S01", "S02"… reads as a printed
            margin note on a magazine spread. `tabular-nums` so the label
            width stays constant across frames, `text-foreground/60`
            against the splash backdrop, drop-shadow for legibility. */}
        <p
          aria-hidden="true"
          className="mt-1.5 text-center font-mono text-[10px] tabular-nums text-foreground/55 uppercase tracking-[0.18em]"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
        >
          {indexLabel}
        </p>
      </li>
    );
  };

  return (
    <DialogPrimitive.Root
      open={openIndex !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Filmstrip wrapper. `relative + overflow-hidden` clips the
          translated marquee track. `onPointer*` handlers pause the drift
          when the user hovers / touches the strip so click targets are
          stable. `onFocus`/`onBlur` cover keyboard-tab navigation
          (focusing into a thumb pauses the drift; tabbing out resumes). */}
      <div
        className="relative overflow-hidden"
        onPointerEnter={() => setPointerPaused(true)}
        onPointerLeave={() => setPointerPaused(false)}
        onPointerDown={() => setPointerPaused(true)}
        onPointerUp={() => setPointerPaused(false)}
        onFocus={() => setPointerPaused(true)}
        onBlur={() => setPointerPaused(false)}
      >
        {reducedMotion ? (
          // Reduced-motion fallback: single ul, manual horizontal scroll.
          // Scrollbar hidden but standard touch/wheel/trackpad scrolling
          // works. No duplication, no transform animation.
          <ul className="flex snap-x snap-proximity flex-nowrap items-start gap-2 overflow-x-auto scroll-px-3 px-3 py-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {screenshots.map(renderThumb)}
          </ul>
        ) : (
          // Marquee track. Width is `w-max` so the two ul siblings lay
          // side-by-side without flex-shrinking; the animation translates
          // the whole track. `paused` inline style overrides the running
          // baseline when `driftRunning` is false. Animation runs on the
          // compositor thread via `translate3d`.
          <div
            data-screenshot-marquee=""
            className="flex w-max items-start gap-2 px-3 py-1"
            style={{
              animation: "recap-marquee 60s linear infinite",
              animationPlayState: driftRunning ? "running" : "paused",
              willChange: "transform",
            }}
          >
            <ul className="flex flex-nowrap items-start gap-2">
              {screenshots.map(renderThumb)}
            </ul>
            {/* Aria-hidden duplicate — required for the seamless loop
                (track translates by -50% of its width, the duplicate
                lands where the original was). Aria-hidden + tabIndex=-1
                on each clone button so AT and test queries see only the
                original three buttons, not six. */}
            <ul aria-hidden="true" className="flex flex-nowrap items-start gap-2">
              {screenshots.map((s, i) => (
                <li
                  key={`clone-${s.filename}`}
                  className="shrink-0"
                  style={{ opacity: nudged ? 1 : 0 }}
                >
                  <span
                    aria-hidden="true"
                    className="block overflow-hidden rounded-md ring-1 ring-white/10"
                  >
                    <img
                      src={steamScreenshotThumbUrl(appid, s.filename)}
                      alt=""
                      loading="lazy"
                      className={thumbClassName}
                    />
                  </span>
                  <p
                    aria-hidden="true"
                    className="mt-1.5 text-center font-mono text-[10px] tabular-nums text-foreground/55 uppercase tracking-[0.18em]"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
                  >
                    S{String(i + 1).padStart(2, "0")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 max-h-[95vh] max-w-[95vw] shadow-none outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
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
