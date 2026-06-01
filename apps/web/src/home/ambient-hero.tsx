import { type RefObject, useMemo } from "react";
import { useAtmosphereClaim } from "./atmosphere/use-atmosphere-claim";

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

// Layer[1] (the warm/cool *accent* opposite layer[0]) had cx ≈ 0.8 in the
// original AmbientHero — fine in that vignetted box, but in the full-viewport
// atmosphere layer it bleeds visibly into the right edge under the tightened
// mask (e.g. an orange ear at right-edge during night). Pulling cx inward to
// ~0.7 and dropping alpha ~25% keeps the accent present as a tint without
// dominating the corner. Layer[1]'s hue is what the orb halo reads as its
// tint colour — see atmosphere-layer.tsx::resolveAtmosphere.
const PALETTES: Record<TimeOfDay, AmbientPalette> = {
  dawn: {
    timeOfDay: "dawn",
    layers: [
      { cx: 0.22, cy: 0.3, radius: 900, lch: [0.82, 0.15, 50], alpha: 0.36, phase: 0 },
      {
        cx: 0.68,
        cy: 0.26,
        radius: 1000,
        lch: [0.66, 0.12, 235],
        alpha: 0.22,
        phase: 1.1,
      },
      { cx: 0.55, cy: 0.88, radius: 800, lch: [0.8, 0.13, 65], alpha: 0.3, phase: 2.3 },
    ],
  },
  day: {
    timeOfDay: "day",
    layers: [
      { cx: 0.22, cy: 0.26, radius: 940, lch: [0.72, 0.15, 225], alpha: 0.34, phase: 0 },
      { cx: 0.7, cy: 0.3, radius: 1000, lch: [0.76, 0.14, 65], alpha: 0.22, phase: 1.1 },
      { cx: 0.5, cy: 0.88, radius: 820, lch: [0.62, 0.13, 195], alpha: 0.24, phase: 2.3 },
    ],
  },
  dusk: {
    timeOfDay: "dusk",
    layers: [
      { cx: 0.2, cy: 0.3, radius: 940, lch: [0.52, 0.18, 350], alpha: 0.34, phase: 0 },
      { cx: 0.7, cy: 0.24, radius: 1000, lch: [0.66, 0.14, 65], alpha: 0.22, phase: 1.1 },
      { cx: 0.55, cy: 0.9, radius: 800, lch: [0.42, 0.15, 320], alpha: 0.26, phase: 2.3 },
    ],
  },
  night: {
    timeOfDay: "night",
    layers: [
      { cx: 0.22, cy: 0.28, radius: 900, lch: [0.34, 0.14, 280], alpha: 0.38, phase: 0 },
      {
        cx: 0.7,
        cy: 0.36,
        radius: 1000,
        lch: [0.42, 0.16, 305],
        alpha: 0.24,
        phase: 1.1,
      },
      { cx: 0.5, cy: 0.9, radius: 800, lch: [0.48, 0.14, 240], alpha: 0.24, phase: 2.3 },
    ],
  },
};

// Tighter than the original AmbientHero mask (was 75% × 95% with a long
// 35→100% fade). The atmosphere layer covers the full viewport without the
// canvas drift that previously softened the bleed; a tighter ellipse keeps
// the corners reliably dim so the bg-foreground contrast carries the band.
export const VIGNETTE_MASK =
  "radial-gradient(ellipse 65% 90% at 50% 50%, black 0%, black 25%, transparent 100%)";

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

export function currentBrusselsHour(): number {
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

/**
 * Registers the initial atmosphere claim for the landing page: time-of-day
 * palette + activity intensity, scoped to the hero band. The shared
 * `<AtmosphereLayer>` (mounted by `<AtmosphereProvider>` in routes/index.tsx)
 * renders the actual visual; this component renders nothing on its own.
 *
 * The hero canvas drift (60s phase animation) and pointer parallax that the
 * pre-arc AmbientHero rendered are intentionally not migrated here — both
 * effects were polish-on-polish at amplitudes (0.05 / 14px) where loss is
 * imperceptible, and re-adding them as a per-claim renderer mode is a
 * polish-pass concern, not an A-2 concern.
 */
export function AmbientHero({
  bandRef,
  hour,
  intensity,
}: {
  bandRef: RefObject<HTMLElement | null>;
  hour?: number | undefined;
  intensity?: number | undefined;
}) {
  const resolved = hour ?? hourFromSearchParams() ?? currentBrusselsHour();
  const palette = paletteForHour(resolved);
  const resolvedIntensity = intensity ?? 0.5;
  const claim = useMemo(
    () => ({ palette, intensity: resolvedIntensity }),
    [palette, resolvedIntensity]
  );
  useAtmosphereClaim(bandRef, claim);
  return null;
}
