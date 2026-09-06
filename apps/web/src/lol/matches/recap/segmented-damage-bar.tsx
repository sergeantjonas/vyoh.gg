import { KillsIcon } from "@/components/game-icons";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function SegmentedDamageBar({
  physical,
  magic,
  trueDmg,
  max,
  skipAnimation,
}: {
  physical: number;
  magic: number;
  trueDmg: number;
  max: number;
  skipAnimation?: boolean | undefined;
}) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(() => !!skipAnimation);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = physical + magic + trueDmg;
  const physW = max > 0 ? physical / max : 0;
  const magicW = max > 0 ? magic / max : 0;
  const trueW = max > 0 ? trueDmg / max : 0;

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex cursor-default items-center gap-1.5">
          <span className="flex w-10 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-red-400/80">
            <KillsIcon className="size-3" />
            <span>Dmg</span>
          </span>
          <div className="relative flex h-1 w-20 overflow-hidden rounded-full bg-muted/40">
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-red-500/90 to-orange-400/90"
              style={{ transformOrigin: "left", width: `${physW * 100}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
              }
            />
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-blue-500/90 to-violet-400/90"
              style={{ transformOrigin: "left", width: `${magicW * 100}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.22 }
              }
            />
            {trueW > 0 && (
              <m.div
                className="h-full shrink-0 bg-white/55"
                style={{ transformOrigin: "left", width: `${trueW * 100}%` }}
                animate={{ scaleX: playing || reduced ? 1 : 0 }}
                transition={
                  !playing || reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 220, damping: 28, delay: 0.26 }
                }
              />
            )}
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {(total / 1000).toFixed(1)}k
          </span>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(TOOLTIP_CONTENT_COMPACT, "p-2")}
        >
          <div className="flex flex-col gap-0.5 font-mono text-[10px] tabular-nums">
            <div className="flex items-center gap-2">
              <span className="w-10 text-orange-400">Phys</span>
              <span>{(physical / 1000).toFixed(1)}k</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 text-violet-400">Magic</span>
              <span>{(magic / 1000).toFixed(1)}k</span>
            </div>
            {trueDmg > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-10 text-white/70">True</span>
                <span>{(trueDmg / 1000).toFixed(1)}k</span>
              </div>
            )}
          </div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
