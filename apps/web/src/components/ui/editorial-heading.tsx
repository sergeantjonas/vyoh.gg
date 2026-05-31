import { type Variants, m, useReducedMotion } from "motion/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type EditorialHeadingElement = "h1" | "h2" | "h3" | "h4";
type EditorialHeadingMagnitude = "small" | "medium" | "large";

// Block-level reveal: each heading (or each line of a multi-line heading)
// animates as one unit on opacity + y + blur. No per-word stagger — Linear /
// Resend register has just upward motion + blur clear, no left-to-right sweep.
const MAGNITUDE: Record<
  EditorialHeadingMagnitude,
  { y: number; duration: number; blur: number; lineStagger: number }
> = {
  small: { y: 8, duration: 0.55, blur: 5, lineStagger: 0.09 },
  medium: { y: 14, duration: 0.9, blur: 8, lineStagger: 0.14 },
  large: { y: 28, duration: 1.6, blur: 12, lineStagger: 0.18 },
};

const REDUCED_FADE_DURATION = 0.15;
const EASE = [0.16, 1, 0.3, 1] as const;
const HEADING_WILL_CHANGE = "transform, opacity, filter";

type EditorialHeadingProps = {
  as?: EditorialHeadingElement;
  magnitude?: EditorialHeadingMagnitude;
  children: string | string[];
  className?: string;
  lineClassName?: (string | undefined)[];
  delegated?: boolean;
  id?: string;
  "aria-label"?: string;
  ref?: React.Ref<HTMLHeadingElement>;
};

function EditorialHeading({
  as: Tag = "h1",
  magnitude = "medium",
  children,
  className,
  lineClassName,
  delegated = false,
  id,
  "aria-label": ariaLabel,
  ref,
}: EditorialHeadingProps) {
  const reducedMotion = useReducedMotion();
  const lines = Array.isArray(children) ? children : [children];
  const MotionTag = m[Tag] as typeof m.h1;
  const lineClassFor = (i: number) => cn("block", lineClassName?.[i]);

  if (reducedMotion) {
    const fadeProps = delegated
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: REDUCED_FADE_DURATION },
        };
    return (
      <MotionTag
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        data-slot="editorial-heading"
        data-magnitude={magnitude}
        data-reduced-motion="true"
        data-delegated={delegated || undefined}
        className={cn(className)}
        {...fadeProps}
      >
        {lines.map((line, lineIdx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static positional lines
          <span key={lineIdx} className={lineClassFor(lineIdx)}>
            {line}
          </span>
        ))}
      </MotionTag>
    );
  }

  const spec = MAGNITUDE[magnitude];
  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: spec.lineStagger } },
  };
  const lineVariants: Variants = {
    hidden: { opacity: 0, y: spec.y, filter: `blur(${spec.blur}px)` },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: spec.duration, ease: EASE },
    },
  };
  const orchestrationProps = delegated
    ? { variants: containerVariants }
    : { variants: containerVariants, initial: "hidden", animate: "visible" };

  return (
    <MotionTag
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      data-slot="editorial-heading"
      data-magnitude={magnitude}
      data-delegated={delegated || undefined}
      className={cn(className)}
      {...orchestrationProps}
    >
      {lines.map((line, lineIdx) => (
        <m.span
          // biome-ignore lint/suspicious/noArrayIndexKey: static positional lines
          key={lineIdx}
          variants={lineVariants}
          className={lineClassFor(lineIdx)}
          style={{ willChange: HEADING_WILL_CHANGE }}
          data-slot="editorial-line"
        >
          {line}
        </m.span>
      ))}
    </MotionTag>
  );
}

export { EditorialHeading };
export type { EditorialHeadingElement, EditorialHeadingMagnitude, EditorialHeadingProps };
