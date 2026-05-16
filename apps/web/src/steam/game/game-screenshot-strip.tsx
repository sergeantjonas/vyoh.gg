import { cn } from "@/lib/utils";
import { useGameMedia } from "@/steam/library/use-game-media";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

// Slower than the hovercard (2.5s) — page dwell is longer than hover dwell so
// each screenshot needs more time to register. Pair the fade-out and fade-in
// durations from the hovercard (300ms each + 300ms incoming delay) so the
// blink-to-black moment stays consistent across both surfaces.
const SCREENSHOT_ROTATION_MS = 3_500;

// Rotating screenshot strip slotted on /steam/game/$appid between the playtime
// block and the verdict grid. Reuses the appdetails-backed `useGameMedia` hook
// + the 30-day server cache that the library-tile hovercard primes — most game
// pages visited after a hover are zero-cost. Hides entirely when the upstream
// returned no screenshots (delisted / demo / region-blocked) or while the
// fetch is in flight, so the layout doesn't reserve an empty letterbox.
export function GameScreenshotStrip({ appid }: { appid: number }) {
  const { data: media } = useGameMedia(appid, true);
  const screenshots = media?.screenshots ?? [];
  const [index, setIndex] = useState(0);
  // Defer the first screenshot's reveal one frame so it animates *in* from
  // black rather than popping in at full opacity — same first-paint trick the
  // hovercard uses. Without this the first frame mounts at opacity-100 with
  // no prior state to transition from, and the eye reads a hard cut.
  const [hasEntered, setHasEntered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Cursor-on-strip freeze: if the user is reading or about to click, we
  // shouldn't change the frame underneath them. Pairs with the modal-paused
  // rotation so the screenshot they clicked is the one the modal opens with.
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (screenshots.length === 0) return;
    const handle = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(handle);
  }, [screenshots.length]);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    setIndex(0);
    const handle = setInterval(() => {
      // Tab-backgrounded skip rather than interval-clear — picks back up
      // seamlessly when the tab returns. Same pattern for hover + modal:
      // skip the increment without clearing so cadence stays consistent.
      if (document.visibilityState === "hidden") return;
      if (hovered || modalOpen) return;
      setIndex((i) => (i + 1) % screenshots.length);
    }, SCREENSHOT_ROTATION_MS);
    return () => clearInterval(handle);
  }, [screenshots.length, hovered, modalOpen]);

  if (screenshots.length === 0) return null;
  const active = screenshots[index];
  if (!active) return null;

  return (
    <DialogPrimitive.Root open={modalOpen} onOpenChange={setModalOpen}>
      <DialogPrimitive.Trigger
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg border bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {screenshots.map((s, i) => {
          const isActive = hasEntered && i === index;
          return (
            <img
              key={s.thumbUrl}
              src={s.thumbUrl}
              alt=""
              loading="lazy"
              className={cn(
                // Asymmetric easing — ease-in on outgoing clears the near-0
                // region quickly, ease-out on incoming enters fast off black.
                // Combined with the 300ms delay on incoming, the black moment
                // perceived between frames stays a flicker, not a hold.
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                isActive ? "opacity-100 delay-300 ease-out" : "opacity-0 delay-0 ease-in"
              )}
            />
          );
        })}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/85 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[95vh] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          {/* Visually hidden — Radix Dialog requires an accessible name. */}
          <DialogPrimitive.Title className="sr-only">
            Game screenshot
          </DialogPrimitive.Title>
          <img
            src={active.fullUrl}
            alt=""
            className="block max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          <DialogPrimitive.Close className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
