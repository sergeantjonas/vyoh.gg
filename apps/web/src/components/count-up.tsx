import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const SHOULD_ANIMATE =
  typeof import.meta === "undefined" || import.meta.env?.MODE !== "test";

export function CountUp({
  to,
  duration = 0.7,
  decimals = 0,
  className,
  start = true,
  delay = 0,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  className?: string;
  /**
   * Gates whether the count-up animation runs. When `false`, the value
   * holds at 0 (or `to` in the skip cases below) without animating. When
   * it flips to `true`, the animation kicks in. Use this when CountUp is
   * mounted inside a deferred reveal (e.g. a chapter that hasn't pinned
   * yet) — otherwise the animation completes before the user can see it
   * and the visible result is a static number.
   */
  start?: boolean;
  /**
   * Seconds to wait after `start` becomes true before the animation
   * starts. Use to sequence the count-up *after* its surrounding reveal
   * has settled — otherwise it competes with the fade+rise for attention.
   */
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const skip = !SHOULD_ANIMATE || reduced === true;
  const value = useMotionValue(skip ? to : 0);
  const [display, setDisplay] = useState(skip ? to : 0);

  useEffect(() => {
    if (skip) {
      // Test / reduced-motion path — display the final value immediately
      // and bypass the motion pipeline entirely.
      setDisplay(to);
      value.set(to);
      return;
    }
    if (!start) {
      // Gated: hold at 0 and don't animate. Once `start` flips to true,
      // this effect re-runs and falls through to the animate branch below.
      setDisplay(0);
      value.set(0);
      return;
    }
    const factor = 10 ** decimals;
    const unsubscribe = value.on("change", (v) =>
      setDisplay(Math.round(v * factor) / factor)
    );
    const controls = animate(value, to, { duration, ease: "easeOut", delay });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [to, duration, decimals, skip, value, start, delay]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
