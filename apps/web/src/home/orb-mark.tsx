import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

const ORB_SRC = "/vyoh-orb-mark.svg";

type Orbit = {
  angle: number;
  radius: number;
  duration: number;
  reverse?: boolean;
};

type Sparkle = Orbit & { size: number; color: string };
type Wisp = {
  startAngle: number;
  arcLength: number;
  radius: number;
  thickness: number;
  duration: number;
  reverse?: boolean;
  brightColor: string;
  fadeColor: string;
  opacityMin: number;
  opacityMax: number;
  opacityDuration: number;
  breathDuration: number;
};

const SPARKLES: Sparkle[] = [
  { angle: 12, radius: 47, size: 3, duration: 16, color: "rgba(186,230,253,0.95)" },
  {
    angle: 78,
    radius: 55,
    size: 4,
    duration: 22,
    reverse: true,
    color: "rgba(224,242,254,0.9)",
  },
  { angle: 145, radius: 49, size: 2.5, duration: 14, color: "rgba(125,211,252,0.85)" },
  {
    angle: 210,
    radius: 58,
    size: 3.5,
    duration: 19,
    reverse: true,
    color: "rgba(186,230,253,0.9)",
  },
  { angle: 270, radius: 45, size: 2, duration: 12, color: "rgba(224,242,254,0.85)" },
  {
    angle: 325,
    radius: 60,
    size: 3,
    duration: 26,
    reverse: true,
    color: "rgba(125,211,252,0.9)",
  },
];

const WISPS: Wisp[] = [
  // Big slow drifter — broad lazy arc, slow heartbeat
  {
    startAngle: 25,
    arcLength: 125,
    radius: 36,
    thickness: 7,
    duration: 58,
    brightColor: "rgba(186,230,253,0.45)",
    fadeColor: "rgba(186,230,253,0)",
    opacityMin: 0.4,
    opacityMax: 1,
    opacityDuration: 11,
    breathDuration: 9,
  },
  // Mid counter-rotator — medium pace, ghosts in and out. Magenta-tinted to
  // split the wisp family between two Ahri-palette colours: the outer + small
  // wisps stay cyan/ice, this middle one chases counter-rotationally in pink,
  // so the orb reads as "two spirits orbiting" rather than monochrome smoke.
  {
    startAngle: 195,
    arcLength: 90,
    radius: 43,
    thickness: 5,
    duration: 38,
    reverse: true,
    brightColor: "rgba(244,114,182,0.4)",
    fadeColor: "rgba(244,114,182,0)",
    opacityMin: 0.25,
    opacityMax: 0.85,
    opacityDuration: 7,
    breathDuration: 6.2,
  },
  // Small fast puff — thin, further out, brief flashes
  {
    startAngle: 295,
    arcLength: 55,
    radius: 49,
    thickness: 3,
    duration: 24,
    brightColor: "rgba(224,242,254,0.45)",
    fadeColor: "rgba(224,242,254,0)",
    opacityMin: 0.15,
    opacityMax: 0.9,
    opacityDuration: 4.8,
    breathDuration: 4.2,
  },
];

function wispArc(startAngle: number, arcLength: number, radius: number) {
  const rad = Math.PI / 180;
  const sx = 50 + radius * Math.cos(startAngle * rad);
  const sy = 50 + radius * Math.sin(startAngle * rad);
  const ex = 50 + radius * Math.cos((startAngle + arcLength) * rad);
  const ey = 50 + radius * Math.sin((startAngle + arcLength) * rad);
  const largeArc = arcLength > 180 ? 1 : 0;
  return {
    d: `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`,
    sx,
    sy,
    ex,
    ey,
  };
}

interface OrbMarkProps {
  className?: string;
  /**
   * Delay (seconds) before the spawn-in (scale + blur-clear) fires. Lets the
   * consumer choreography land headline text first so the orb reads as a
   * payoff rather than a competing focal beat.
   */
  entranceDelay?: number;
}

export function OrbMark({ className, entranceDelay = 0 }: OrbMarkProps) {
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className={cn("relative aspect-square select-none", className)}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.85, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.9, delay: entranceDelay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div aria-hidden="true" className="orb-halo orb-halo-outer" />
      <div aria-hidden="true" className="orb-halo orb-halo-inner" />
      <div aria-hidden="true" className="orb-halo orb-halo-core" />
      <img
        src={ORB_SRC}
        alt="vyoh orb"
        draggable={false}
        className="orb-image relative size-full"
      />
      <svg
        className="orb-wisps pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ mixBlendMode: "screen" }}
      >
        <defs>
          <filter
            id="orb-smoke"
            filterUnits="userSpaceOnUse"
            x="-15"
            y="-15"
            width="130"
            height="130"
          >
            {/* Static turbulence + displacement: the noise texture is computed */}
            {/* once at filter init instead of every frame (the previous           */}
            {/* `<animate>` on `baseFrequency` regenerated Perlin noise on the CPU */}
            {/* for the page's full lifetime). The wisp paths still rotate and    */}
            {/* fade through the filter, so the smoke effect reads as alive even  */}
            {/* with a frozen noise field underneath. `numOctaves` dropped from   */}
            {/* 2 to 1 — halves noise cost with no visible texture difference.    */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014"
              numOctaves="1"
              seed="5"
            />
            <feDisplacementMap in="SourceGraphic" scale="3" />
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          {WISPS.map((w) => {
            const arc = wispArc(w.startAngle, w.arcLength, w.radius);
            const headX = w.reverse ? arc.sx : arc.ex;
            const headY = w.reverse ? arc.sy : arc.ey;
            const tailX = w.reverse ? arc.ex : arc.sx;
            const tailY = w.reverse ? arc.ey : arc.sy;
            const gradId = `wisp-grad-${w.startAngle}-${w.radius}`;
            return (
              <linearGradient
                key={gradId}
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={tailX}
                y1={tailY}
                x2={headX}
                y2={headY}
              >
                <stop offset="0%" stopColor={w.fadeColor} />
                <stop offset="55%" stopColor={w.brightColor} stopOpacity="0.55" />
                <stop offset="100%" stopColor={w.brightColor} />
              </linearGradient>
            );
          })}
        </defs>
        <g filter="url(#orb-smoke)">
          {WISPS.map((w) => {
            const arc = wispArc(w.startAngle, w.arcLength, w.radius);
            const gradId = `wisp-grad-${w.startAngle}-${w.radius}`;
            return (
              <g
                key={`wisp-${w.startAngle}-${w.radius}`}
                opacity={reducedMotion ? (w.opacityMin + w.opacityMax) / 2 : w.opacityMin}
              >
                {!reducedMotion && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 50 50"
                    to={`${w.reverse ? -360 : 360} 50 50`}
                    dur={`${w.duration}s`}
                    repeatCount="indefinite"
                  />
                )}
                {!reducedMotion && (
                  <animate
                    attributeName="opacity"
                    values={`${w.opacityMin};${w.opacityMax};${w.opacityMin}`}
                    dur={`${w.opacityDuration}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;0.5;1"
                    keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                  />
                )}
                <path
                  d={arc.d}
                  fill="none"
                  stroke={`url(#${gradId})`}
                  strokeWidth={w.thickness}
                  strokeLinecap="round"
                >
                  {!reducedMotion && (
                    <animate
                      attributeName="stroke-width"
                      values={`${w.thickness * 0.7};${w.thickness * 1.25};${w.thickness * 0.7}`}
                      dur={`${w.breathDuration}s`}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keyTimes="0;0.5;1"
                      keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                    />
                  )}
                </path>
              </g>
            );
          })}
        </g>
      </svg>
      {SPARKLES.map((p) => (
        <div
          key={`sparkle-${p.angle}-${p.radius}`}
          aria-hidden="true"
          className="orb-sparkle"
          style={
            {
              "--orb-sparkle-angle": `${p.angle}deg`,
              "--orb-sparkle-orbit-duration": `${p.duration}s`,
              "--orb-sparkle-pulse-duration": `${p.duration / 4}s`,
              "--orb-sparkle-direction": p.reverse ? "reverse" : "normal",
              "--orb-sparkle-radius": `${p.radius}%`,
              "--orb-sparkle-size": `${p.size}px`,
              "--orb-sparkle-color": p.color,
            } as CSSProperties
          }
        >
          <div className="orb-sparkle-dot" />
        </div>
      ))}
    </m.div>
  );
}
