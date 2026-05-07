import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const SHOULD_ANIMATE =
  typeof import.meta === "undefined" || import.meta.env?.MODE !== "test";

export function CountUp({
  to,
  duration = 0.7,
  decimals = 0,
  className,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const skip = !SHOULD_ANIMATE || reduced === true;
  const value = useMotionValue(skip ? to : 0);
  const [display, setDisplay] = useState(skip ? to : 0);

  useEffect(() => {
    if (skip) {
      setDisplay(to);
      value.set(to);
      return;
    }
    const factor = 10 ** decimals;
    const unsubscribe = value.on("change", (v) =>
      setDisplay(Math.round(v * factor) / factor)
    );
    const controls = animate(value, to, { duration, ease: "easeOut" });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [to, duration, decimals, skip, value]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
