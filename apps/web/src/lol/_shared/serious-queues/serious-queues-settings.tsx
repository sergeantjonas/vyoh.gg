import {
  CONFIGURABLE_SERIOUS_QUEUES,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { SlidersHorizontal } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Serious-queues preferences"
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <SlidersHorizontal className="size-4" />
      </button>
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
                      className="size-4 cursor-pointer accent-sky-500"
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
