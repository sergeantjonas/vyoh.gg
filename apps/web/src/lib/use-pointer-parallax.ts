import { type MotionValue, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";

export type PointerParallaxOptions = {
  damping?: number;
  maxOffset?: number;
};

export type PointerParallaxValues = {
  x: MotionValue<number>;
  y: MotionValue<number>;
};

/**
 * Cursor-aware damped translation, returned as Motion values bindable to
 * `<m.div style={{ x, y }}>`. Pointer position is normalised to [-1, 1] across
 * the viewport and scaled by `maxOffset` (pixels); each frame moves the
 * current value toward the target by `damping` (0..1). Default tuning is
 * intentionally subliminal — see [docs/working-notes/cross-cutting/pointer-parallax-splash.md].
 *
 * The hook owns the rAF and pointer listener; callers do not pass a target
 * element because the splash backdrop spans the viewport.
 */
export function usePointerParallax({
  damping = 0.08,
  maxOffset = 10,
}: PointerParallaxOptions = {}): PointerParallaxValues {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const targetX = useRef(0);
  const targetY = useRef(0);

  useEffect(() => {
    const handle = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetX.current = nx * maxOffset;
      targetY.current = ny * maxOffset;
    };
    const reset = () => {
      targetX.current = 0;
      targetY.current = 0;
    };
    window.addEventListener("pointermove", handle, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", handle);
      window.removeEventListener("pointerleave", reset);
    };
  }, [maxOffset]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      x.set(x.get() + (targetX.current - x.get()) * damping);
      y.set(y.get() + (targetY.current - y.get()) * damping);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [damping, x, y]);

  return { x, y };
}
