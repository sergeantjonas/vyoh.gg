import {
  type MotionStyle,
  m,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { MouseEvent, ReactNode } from "react";

const SPRING = { stiffness: 250, damping: 22, mass: 0.5 } as const;
const TILT_RANGE = 3.5;

export function CardTilt({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-1, 1], [TILT_RANGE, -TILT_RANGE]), SPRING);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-TILT_RANGE, TILT_RANGE]), SPRING);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    py.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  const style: MotionStyle = {
    rotateX,
    rotateY,
    transformPerspective: 1000,
    transformStyle: "preserve-3d",
  };

  return (
    <m.div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={style}
      className={className}
    >
      {children}
    </m.div>
  );
}
