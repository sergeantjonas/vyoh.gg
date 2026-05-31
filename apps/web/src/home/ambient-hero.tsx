import { usePointerParallax } from "@/lib/use-pointer-parallax";
import { m, useReducedMotion } from "motion/react";
import AmbientHeroCanvas from "./ambient-hero-canvas";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface GradientLayer {
  cx: number;
  cy: number;
  radius: number;
  lch: readonly [number, number, number];
  alpha: number;
  phase: number;
}

export interface AmbientPalette {
  timeOfDay: TimeOfDay;
  layers: readonly GradientLayer[];
}

const PALETTES: Record<TimeOfDay, AmbientPalette> = {
  dawn: {
    timeOfDay: "dawn",
    layers: [
      { cx: 0.22, cy: 0.3, radius: 900, lch: [0.82, 0.15, 50], alpha: 0.36, phase: 0 },
      {
        cx: 0.78,
        cy: 0.26,
        radius: 1000,
        lch: [0.66, 0.12, 235],
        alpha: 0.3,
        phase: 1.1,
      },
      { cx: 0.55, cy: 0.88, radius: 800, lch: [0.8, 0.13, 65], alpha: 0.3, phase: 2.3 },
    ],
  },
  day: {
    timeOfDay: "day",
    layers: [
      { cx: 0.22, cy: 0.26, radius: 940, lch: [0.72, 0.15, 225], alpha: 0.34, phase: 0 },
      { cx: 0.8, cy: 0.3, radius: 1000, lch: [0.76, 0.14, 65], alpha: 0.3, phase: 1.1 },
      { cx: 0.5, cy: 0.88, radius: 820, lch: [0.62, 0.13, 195], alpha: 0.24, phase: 2.3 },
    ],
  },
  dusk: {
    timeOfDay: "dusk",
    layers: [
      { cx: 0.2, cy: 0.3, radius: 940, lch: [0.52, 0.18, 350], alpha: 0.34, phase: 0 },
      { cx: 0.8, cy: 0.24, radius: 1000, lch: [0.66, 0.14, 65], alpha: 0.3, phase: 1.1 },
      { cx: 0.55, cy: 0.9, radius: 800, lch: [0.42, 0.15, 320], alpha: 0.26, phase: 2.3 },
    ],
  },
  night: {
    timeOfDay: "night",
    layers: [
      { cx: 0.22, cy: 0.28, radius: 900, lch: [0.34, 0.14, 280], alpha: 0.38, phase: 0 },
      {
        cx: 0.8,
        cy: 0.36,
        radius: 1000,
        lch: [0.42, 0.16, 305],
        alpha: 0.32,
        phase: 1.1,
      },
      { cx: 0.5, cy: 0.9, radius: 800, lch: [0.48, 0.14, 240], alpha: 0.24, phase: 2.3 },
    ],
  },
};

export const VIGNETTE_MASK =
  "radial-gradient(ellipse 75% 95% at 50% 45%, black 0%, black 35%, transparent 100%)";

export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 22) return "dusk";
  return "night";
}

export function paletteForHour(hour: number): AmbientPalette {
  return PALETTES[timeOfDayForHour(hour)];
}

/**
 * Map intensity [0, 1] → chroma multiplier [0.7, 1.3]. 0.5 is the "average"
 * baseline used by the static fallback and by the canvas when data hasn't
 * resolved yet — keeps the palette identical to the pre-reactivity look.
 */
export function intensityToChromaMultiplier(intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity));
  return 0.7 + 0.6 * clamped;
}

export function layerToCssGradient(layer: GradientLayer, intensity = 0.5): string {
  const [L, C, H] = layer.lch;
  const cAdj = C * intensityToChromaMultiplier(intensity);
  return `radial-gradient(circle ${layer.radius}px at ${layer.cx * 100}% ${layer.cy * 100}%, oklch(${L} ${cAdj} ${H} / ${layer.alpha}) 0%, transparent 70%)`;
}

const brusselsHourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  hour12: false,
  timeZone: "Europe/Brussels",
});

function currentBrusselsHour(): number {
  const parts = brusselsHourFormatter.formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour");
  const parsed = Number(hourPart?.value ?? "0");
  return Number.isFinite(parsed) ? parsed % 24 : 0;
}

function hourFromSearchParams(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("hour");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

function isLowPower(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return true;
  return false;
}

function StaticLayer({
  palette,
  intensity,
}: {
  palette: AmbientPalette;
  intensity: number;
}) {
  return (
    <div
      data-ambient-static
      className="absolute inset-0"
      style={{
        backgroundImage: palette.layers
          .map((layer) => layerToCssGradient(layer, intensity))
          .join(", "),
        backgroundBlendMode: "screen",
        maskImage: VIGNETTE_MASK,
        WebkitMaskImage: VIGNETTE_MASK,
      }}
    />
  );
}

export function AmbientHero({
  hour,
  intensity,
}: {
  hour?: number | undefined;
  intensity?: number | undefined;
}) {
  const reducedMotion = useReducedMotion();
  const resolved = hour ?? hourFromSearchParams() ?? currentBrusselsHour();
  const palette = paletteForHour(resolved);
  const shouldAnimate = reducedMotion === false && !isLowPower();
  // Default to the average baseline so the palette matches the pre-reactivity
  // look while the activity-intensity query is still loading. Reduced-motion
  // always renders the baseline per the arc note's reduced-motion contract.
  const resolvedIntensity = intensity ?? 0.5;
  const staticIntensity = shouldAnimate ? resolvedIntensity : 0.5;
  // Larger maxOffset than the splash backdrop's bg track (6) — the gradients
  // are blurry enough that smaller offsets read as no motion at all. Still
  // subliminal at 14px against an ~95vh canvas.
  const parallax = usePointerParallax({ maxOffset: 14 });
  return (
    <div
      aria-hidden
      data-ambient-hero
      data-time-of-day={palette.timeOfDay}
      // -top-6 / -bottom-6 bleed the gradient into the wrapping div's p-6
      // padding above and below the hero section, so AmbientHero covers the
      // full visible viewport of <main> instead of leaving a transparent
      // sliver at the bottom (where the section box ends but the wrapping
      // div's bottom padding still occupies space inside main).
      className="pointer-events-none absolute -top-6 -bottom-6 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
    >
      {shouldAnimate ? (
        <m.div
          data-ambient-parallax
          className="absolute inset-0"
          style={{ x: parallax.x, y: parallax.y }}
        >
          <AmbientHeroCanvas layers={palette.layers} intensity={resolvedIntensity} />
        </m.div>
      ) : (
        <StaticLayer palette={palette} intensity={staticIntensity} />
      )}
    </div>
  );
}
