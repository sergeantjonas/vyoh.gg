import { type Variants, m, useReducedMotion } from "motion/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type EditorialHeadingElement = "h1" | "h2" | "h3" | "h4";
type EditorialHeadingMagnitude = "small" | "medium" | "large";

const MAGNITUDE: Record<
  EditorialHeadingMagnitude,
  { y: number; stagger: number; duration: number }
> = {
  small: { y: 8, stagger: 0.03, duration: 0.4 },
  medium: { y: 14, stagger: 0.05, duration: 0.5 },
  large: { y: 20, stagger: 0.06, duration: 0.55 },
};

const REDUCED_FADE_DURATION = 0.15;
const EASE = [0.16, 1, 0.3, 1] as const;

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

function splitTokens(line: string): string[] {
  return line.split(/(\s+)/).filter((s) => s.length > 0);
}

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
    visible: { transition: { staggerChildren: spec.stagger } },
  };
  const wordVariants: Variants = {
    hidden: { opacity: 0, y: spec.y },
    visible: {
      opacity: 1,
      y: 0,
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
        // biome-ignore lint/suspicious/noArrayIndexKey: static positional lines
        <span key={lineIdx} className={lineClassFor(lineIdx)}>
          {splitTokens(line).map((token, tokenIdx) =>
            /^\s+$/.test(token) ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional whitespace token
              <span key={`ws-${tokenIdx}`}>{token}</span>
            ) : (
              <m.span
                // biome-ignore lint/suspicious/noArrayIndexKey: positional word token
                key={`w-${tokenIdx}`}
                variants={wordVariants}
                className="inline-block"
                data-slot="editorial-word"
              >
                {token}
              </m.span>
            )
          )}
        </span>
      ))}
    </MotionTag>
  );
}

export { EditorialHeading };
export type { EditorialHeadingElement, EditorialHeadingMagnitude, EditorialHeadingProps };
