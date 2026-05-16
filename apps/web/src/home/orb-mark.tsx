import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";

const ORB_SRC = "/vyoh-orb-mark.svg";

const HALO_OUTER_DURATION = 4.5;
const HALO_INNER_DURATION = 6;
const CORE_PULSE_DURATION = 5.2;

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
  // Mid counter-rotator — medium pace, ghosts in and out
  {
    startAngle: 195,
    arcLength: 90,
    radius: 43,
    thickness: 5,
    duration: 38,
    reverse: true,
    brightColor: "rgba(125,211,252,0.4)",
    fadeColor: "rgba(125,211,252,0)",
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
}

export function OrbMark({ className }: OrbMarkProps) {
  const reducedMotion = useReducedMotion();

  const outerHalo = reducedMotion
    ? { opacity: 0.5, scale: 1.05 }
    : { opacity: [0.4, 0.7, 0.4], scale: [1, 1.14, 1] };
  const innerHalo = reducedMotion
    ? { opacity: 0.6, scale: 1.02 }
    : { opacity: [0.5, 0.75, 0.5], scale: [1, 1.08, 1] };
  const core = reducedMotion
    ? { opacity: 0.14, scale: 1 }
    : { opacity: [0.09, 0.2, 0.09], scale: [0.95, 1.04, 0.95] };

  return (
    <m.div
      className={cn("relative aspect-square select-none", className)}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.85, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <m.div
        aria-hidden="true"
        className="absolute inset-[-32%] rounded-full bg-[radial-gradient(circle,rgba(56,118,255,0.7)_0%,rgba(56,118,255,0)_65%)] blur-2xl mix-blend-screen"
        animate={outerHalo}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: HALO_OUTER_DURATION,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
      <m.div
        aria-hidden="true"
        className="absolute inset-[-14%] rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.65)_0%,rgba(125,211,252,0)_60%)] blur-xl mix-blend-screen"
        animate={innerHalo}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: HALO_INNER_DURATION,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
      <m.div
        aria-hidden="true"
        className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(67,56,202,0.45)_0%,rgba(56,118,255,0.18)_40%,rgba(56,118,255,0)_62%)] blur-lg mix-blend-screen"
        animate={core}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: CORE_PULSE_DURATION,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
      <img
        src={ORB_SRC}
        alt="vyoh orb"
        draggable={false}
        className="relative size-full"
      />
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
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
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014"
              numOctaves="2"
              seed="5"
            >
              {!reducedMotion && (
                <animate
                  attributeName="baseFrequency"
                  values="0.012;0.02;0.012"
                  dur="22s"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3">
              {!reducedMotion && (
                <animate
                  attributeName="scale"
                  values="2;4;2"
                  dur="17s"
                  repeatCount="indefinite"
                />
              )}
            </feDisplacementMap>
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
        <m.div
          key={`sparkle-${p.angle}-${p.radius}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ rotate: p.angle }}
          animate={
            reducedMotion
              ? { rotate: p.angle }
              : { rotate: p.angle + (p.reverse ? -360 : 360) }
          }
          transition={
            reducedMotion
              ? undefined
              : {
                  duration: p.duration,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }
          }
        >
          <m.div
            className="absolute left-1/2 rounded-full mix-blend-screen"
            style={{
              top: `${50 - p.radius}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              x: "-50%",
              y: "-50%",
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}, 0 0 ${p.size * 6}px ${p.color}`,
            }}
            animate={
              reducedMotion
                ? undefined
                : { opacity: [0.55, 1, 0.55], scale: [0.7, 1.15, 0.7] }
            }
            transition={
              reducedMotion
                ? undefined
                : {
                    duration: p.duration / 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }
            }
          />
        </m.div>
      ))}
    </m.div>
  );
}
