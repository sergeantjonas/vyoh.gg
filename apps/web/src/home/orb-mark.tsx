import { isFirefox } from "@/lib/is-firefox";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";

const ORB_SRC = "/vyoh-orb-mark.svg";

type Orbit = {
  angle: number;
  radius: number;
  duration: number;
  reverse?: boolean;
};

type Sparkle = Orbit & { size: number; color: string };
type Ember = {
  angle: number;
  radius: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
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

// Off-orbit embers — sit at the inner-halo radius and pulse on fast (~1s)
// cycles rather than orbiting. Negative `animation-delay` desyncs them so the
// ring never blinks in unison. Two pink + two cyan + one warm accent gives
// the Ahri palette without overwhelming the existing cool-leaning sparkles.
const EMBERS: Ember[] = [
  {
    angle: 35,
    radius: 36,
    size: 2.2,
    color: "rgba(244,114,182,0.95)",
    duration: 1.3,
    delay: 0,
  },
  {
    angle: 215,
    radius: 32,
    size: 1.8,
    color: "rgba(236,72,153,0.9)",
    duration: 1.1,
    delay: 0.5,
  },
  {
    angle: 105,
    radius: 38,
    size: 2,
    color: "rgba(186,230,253,0.95)",
    duration: 0.9,
    delay: 0.2,
  },
  {
    angle: 290,
    radius: 34,
    size: 2.4,
    color: "rgba(125,211,252,0.9)",
    duration: 1.4,
    delay: 0.7,
  },
  {
    angle: 160,
    radius: 40,
    size: 1.6,
    color: "rgba(254,202,202,0.85)",
    duration: 1,
    delay: 0.3,
  },
];

interface OrbMarkProps {
  className?: string;
  /**
   * Delay (seconds) before the throw-and-settle entrance fires. Lets the
   * consumer choreography land headline text first so the orb reads as a
   * payoff rather than a competing focal beat.
   */
  entranceDelay?: number;
}

export function OrbMark({ className, entranceDelay = 0 }: OrbMarkProps) {
  const reducedMotion = useReducedMotion();
  // While the orb is being thrown in, pause every descendant animation so the
  // wrapper has the compositor to itself for the throw (no concurrent halo
  // breathing, hue cycle, sparkle orbits, ember flickers, or wander loops
  // competing for frame budget). The moment `orb-entrance` completes, the
  // pause class drops and all layers spring to life — visually frames the
  // arrival as "orb summoned, atmosphere wakes up." Under reduced motion the
  // entrance isn't played, so `entranceDone` starts true to skip the gate.
  const [entranceDone, setEntranceDone] = useState(reducedMotion === true);
  useEffect(() => {
    if (reducedMotion) setEntranceDone(true);
  }, [reducedMotion]);

  return (
    <div
      className={cn(
        "relative aspect-square select-none",
        !reducedMotion && "orb-entrance",
        // Firefox engine-gate: its compositor stutters on the full off-screen
        // throw at large windows (bounding-box tile coverage scales with viewport).
        // Swap to a shorter, scale-led entrance that reads as "distant" without
        // the long translate distance. Same pattern as the Safari VT bypass.
        !reducedMotion && isFirefox() && "orb-entrance-firefox",
        !reducedMotion && !entranceDone && "orb-children-paused",
        className
      )}
      style={
        reducedMotion
          ? undefined
          : ({ "--orb-entrance-delay": `${entranceDelay}s` } as CSSProperties)
      }
      onAnimationEnd={(e) => {
        if (e.animationName === "orb-entrance") setEntranceDone(true);
      }}
    >
      {!reducedMotion && <div aria-hidden="true" className="orb-entrance-bloom" />}
      <div aria-hidden="true" className="orb-halo orb-halo-outer" />
      <div aria-hidden="true" className="orb-halo orb-halo-inner" />
      <div aria-hidden="true" className="orb-halo orb-halo-core" />
      <div aria-hidden="true" className="orb-halo-echo" />
      <img
        src={ORB_SRC}
        alt="vyoh orb"
        draggable={false}
        className="orb-image relative size-full"
      />
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
      {EMBERS.map((e) => (
        <div
          key={`ember-${e.angle}-${e.radius}`}
          aria-hidden="true"
          className="orb-ember"
          style={
            {
              "--orb-ember-angle": `${e.angle}deg`,
              "--orb-ember-radius": `${e.radius}%`,
              "--orb-ember-size": `${e.size}px`,
              "--orb-ember-color": e.color,
              "--orb-ember-duration": `${e.duration}s`,
              "--orb-ember-delay": `${-e.delay}s`,
            } as CSSProperties
          }
        >
          <div className="orb-ember-spark" />
        </div>
      ))}
    </div>
  );
}
