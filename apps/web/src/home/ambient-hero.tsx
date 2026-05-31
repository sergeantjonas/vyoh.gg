export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface AmbientPalette {
  timeOfDay: TimeOfDay;
  gradients: string[];
}

const PALETTES: Record<TimeOfDay, AmbientPalette> = {
  dawn: {
    timeOfDay: "dawn",
    gradients: [
      "radial-gradient(circle 900px at 22% 30%, oklch(0.72 0.11 45 / 0.32) 0%, transparent 70%)",
      "radial-gradient(circle 1000px at 78% 26%, oklch(0.62 0.08 235 / 0.28) 0%, transparent 72%)",
      "radial-gradient(circle 800px at 55% 88%, oklch(0.78 0.09 60 / 0.22) 0%, transparent 65%)",
    ],
  },
  day: {
    timeOfDay: "day",
    gradients: [
      "radial-gradient(circle 940px at 22% 26%, oklch(0.74 0.10 230 / 0.28) 0%, transparent 70%)",
      "radial-gradient(circle 1000px at 80% 32%, oklch(0.88 0.05 90 / 0.22) 0%, transparent 72%)",
      "radial-gradient(circle 820px at 50% 88%, oklch(0.66 0.08 200 / 0.20) 0%, transparent 65%)",
    ],
  },
  dusk: {
    timeOfDay: "dusk",
    gradients: [
      "radial-gradient(circle 940px at 20% 30%, oklch(0.52 0.18 350 / 0.34) 0%, transparent 70%)",
      "radial-gradient(circle 1000px at 80% 24%, oklch(0.66 0.14 65 / 0.30) 0%, transparent 72%)",
      "radial-gradient(circle 800px at 55% 90%, oklch(0.42 0.15 320 / 0.26) 0%, transparent 65%)",
    ],
  },
  night: {
    timeOfDay: "night",
    gradients: [
      "radial-gradient(circle 900px at 22% 28%, oklch(0.34 0.14 280 / 0.38) 0%, transparent 70%)",
      "radial-gradient(circle 1000px at 80% 36%, oklch(0.42 0.16 305 / 0.32) 0%, transparent 72%)",
      "radial-gradient(circle 800px at 50% 90%, oklch(0.48 0.14 240 / 0.24) 0%, transparent 65%)",
    ],
  },
};

const VIGNETTE_MASK =
  "radial-gradient(ellipse 65% 55% at 50% 38%, black 0%, black 35%, transparent 92%)";

export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 22) return "dusk";
  return "night";
}

export function paletteForHour(hour: number): AmbientPalette {
  return PALETTES[timeOfDayForHour(hour)];
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

export function AmbientHero({ hour }: { hour?: number }) {
  const resolved = hour ?? currentBrusselsHour();
  const palette = paletteForHour(resolved);
  return (
    <div
      aria-hidden
      data-ambient-hero
      data-time-of-day={palette.timeOfDay}
      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[70vh] w-screen -translate-x-1/2 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: palette.gradients.join(", "),
          backgroundBlendMode: "screen",
          maskImage: VIGNETTE_MASK,
          WebkitMaskImage: VIGNETTE_MASK,
        }}
      />
    </div>
  );
}
