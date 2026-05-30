import { Button } from "@/components/ui/button";
import { useMatureScreenshotsPref } from "@/steam/_shared/use-mature-screenshots-pref";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { SlidersHorizontal } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Matches the LoL strip-action buttons' tooltip (label-only compact variant).
const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

// Steam section preferences popover — owner-facing controls that affect the
// whole stream, mounted in the section nav next to the tab row (parallel to
// SeriousQueuesSettings in the LoL section). All preferences here are global
// per-stream: flipping the toggle on the library page sticks for the
// game-detail strip and the hovercard rotation immediately.
//
// Click-outside / Escape close handlers + the fade-in motion mirror the LoL
// settings popover so the two streams feel consistent.
export function SteamPreferences() {
  const { showMature, setShowMature } = useMatureScreenshotsPref();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Shared icon Button (parallel to the LoL SeriousQueuesSettings + Refresh
          buttons) so every strip-action icon is identical by construction. */}
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Steam preferences"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            sideOffset={4}
            className={TOOLTIP_CONTENT_CLASS}
          >
            Steam preferences
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
      <AnimatePresence>
        {open && (
          <m.div
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            {...(!reduced ? { exit: { opacity: 0, y: -4 } } : {})}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover/95 p-3 shadow-xl backdrop-blur-md"
          >
            <div className="text-xs font-medium text-foreground">Steam preferences</div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
              Owner-side controls applied across every Steam surface.
            </p>
            <div className="mt-3 flex flex-col">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-2 text-sm transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={showMature}
                  onChange={(e) => setShowMature(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer"
                />
                <span className="flex flex-col">
                  <span className="text-foreground/90">Show mature content</span>
                  <span className="text-[11px] leading-snug text-muted-foreground/80">
                    Includes Steam's `mature_content_screenshots` bucket in the
                    game-detail strip and library-tile hovercard rotation. Publishers use
                    this bucket inconsistently — some dump all screenshots in it for
                    violence labeling.
                  </span>
                </span>
              </label>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
