import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";

const ORB_SRC = "/vyoh-orb-mark.svg";

interface OrbGlyphProps {
  className?: string;
}

export function OrbGlyph({ className }: OrbGlyphProps) {
  const reducedMotion = useReducedMotion();

  return (
    <span
      className={cn("relative inline-block aspect-square align-middle", className)}
      aria-hidden="true"
    >
      <m.span
        className="absolute inset-[-25%] rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.55)_0%,rgba(56,118,255,0.2)_45%,rgba(56,118,255,0)_70%)] blur-md mix-blend-screen"
        animate={reducedMotion ? undefined : { opacity: [0.55, 0.9, 0.55] }}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: 4.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
      <img src={ORB_SRC} alt="" draggable={false} className="relative size-full" />
    </span>
  );
}
