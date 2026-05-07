import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const SHOULD_ANIMATE =
  typeof import.meta === "undefined" || import.meta.env?.MODE !== "test";

export function CountUp({
  to,
  duration = 0.7,
  className,
}: {
  to: number;
  duration?: number;
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
    const unsubscribe = value.on("change", (v) => setDisplay(Math.round(v)));
    const controls = animate(value, to, { duration, ease: "easeOut" });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [to, duration, skip, value]);

  return <span className={className}>{display}</span>;
}
