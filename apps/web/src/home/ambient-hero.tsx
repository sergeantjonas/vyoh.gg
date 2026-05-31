import { useReducedMotion } from "motion/react";
import { Suspense, lazy } from "react";

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
  "radial-gradient(ellipse 80% 65% at 50% 42%, black 0%, black 45%, transparent 96%)";

export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 22) return "dusk";
  return "night";
}

export function paletteForHour(hour: number): AmbientPalette {
  return PALETTES[timeOfDayForHour(hour)];
}

export function layerToCssGradient(layer: GradientLayer): string {
  const [L, C, H] = layer.lch;
  return `radial-gradient(circle ${layer.radius}px at ${layer.cx * 100}% ${layer.cy * 100}%, oklch(${L} ${C} ${H} / ${layer.alpha}) 0%, transparent 70%)`;
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

const AmbientHeroCanvas = lazy(() => import("./ambient-hero-canvas"));

function StaticLayer({ palette }: { palette: AmbientPalette }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: palette.layers.map(layerToCssGradient).join(", "),
        backgroundBlendMode: "screen",
        maskImage: VIGNETTE_MASK,
        WebkitMaskImage: VIGNETTE_MASK,
      }}
    />
  );
}

export function AmbientHero({ hour }: { hour?: number }) {
  const reducedMotion = useReducedMotion();
  const resolved = hour ?? hourFromSearchParams() ?? currentBrusselsHour();
  const palette = paletteForHour(resolved);
  const shouldAnimate = reducedMotion === false && !isLowPower();
  return (
    <div
      aria-hidden
      data-ambient-hero
      data-time-of-day={palette.timeOfDay}
      className="pointer-events-none absolute left-1/2 -top-6 -z-10 h-[calc(70vh+1.5rem)] w-screen -translate-x-1/2 overflow-hidden"
    >
      <StaticLayer palette={palette} />
      {shouldAnimate && (
        <Suspense fallback={null}>
          <AmbientHeroCanvas layers={palette.layers} />
        </Suspense>
      )}
    </div>
  );
}
