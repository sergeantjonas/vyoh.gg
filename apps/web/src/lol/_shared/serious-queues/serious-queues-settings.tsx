import { Button } from "@/components/ui/button";
import {
  CONFIGURABLE_SERIOUS_QUEUES,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { SlidersHorizontal } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Matches RefreshAccountButton's tooltip so the two strip-action buttons read
// identically (label-only compact variant).
const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

export function SeriousQueuesSettings() {
  const { ids, set } = useSeriousQueues();
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

  const toggle = (id: number) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set([...next]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Same shared primitive as RefreshAccountButton so the two strip-action
          icons are identical by construction (size, radius, fill, hover). The
          outline variant's `aria-expanded:bg-muted` doubles as the open state. */}
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Serious-queues preferences"
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
            Serious-queues preferences
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
            <div className="text-xs font-medium text-foreground">Serious queues</div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
              Performance metrics (Trends, ritual, recap, champion stats) aggregate
              matches in these queues.
            </p>
            <div className="mt-3 flex flex-col">
              {CONFIGURABLE_SERIOUS_QUEUES.map((q) => {
                const checked = ids.has(q.id);
                return (
                  <label
                    key={q.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(q.id)}
                      className="size-4 cursor-pointer"
                    />
                    <span className="text-foreground/90">{q.label}</span>
                  </label>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
