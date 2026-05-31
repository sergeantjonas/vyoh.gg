export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface AmbientPalette {
  timeOfDay: TimeOfDay;
  gradients: string[];
}

const PALETTES: Record<TimeOfDay, AmbientPalette> = {
  dawn: {
    timeOfDay: "dawn",
    gradients: [
      "radial-gradient(circle 820px at 12% 28%, oklch(0.78 0.16 45 / 0.50) 0%, transparent 60%)",
      "radial-gradient(circle 900px at 80% 22%, oklch(0.66 0.11 235 / 0.42) 0%, transparent 65%)",
      "radial-gradient(circle 720px at 55% 88%, oklch(0.82 0.13 60 / 0.36) 0%, transparent 55%)",
    ],
  },
  day: {
    timeOfDay: "day",
    gradients: [
      "radial-gradient(circle 860px at 16% 22%, oklch(0.78 0.14 230 / 0.42) 0%, transparent 60%)",
      "radial-gradient(circle 920px at 84% 32%, oklch(0.92 0.07 90 / 0.36) 0%, transparent 65%)",
      "radial-gradient(circle 760px at 50% 88%, oklch(0.70 0.12 200 / 0.32) 0%, transparent 55%)",
    ],
  },
  dusk: {
    timeOfDay: "dusk",
    gradients: [
      "radial-gradient(circle 860px at 14% 28%, oklch(0.56 0.26 350 / 0.52) 0%, transparent 60%)",
      "radial-gradient(circle 920px at 84% 22%, oklch(0.72 0.21 65 / 0.48) 0%, transparent 65%)",
      "radial-gradient(circle 720px at 55% 90%, oklch(0.46 0.21 320 / 0.42) 0%, transparent 55%)",
    ],
  },
  night: {
    timeOfDay: "night",
    gradients: [
      "radial-gradient(circle 820px at 14% 26%, oklch(0.36 0.19 280 / 0.55) 0%, transparent 60%)",
      "radial-gradient(circle 920px at 84% 38%, oklch(0.44 0.22 305 / 0.48) 0%, transparent 65%)",
      "radial-gradient(circle 720px at 50% 90%, oklch(0.52 0.20 240 / 0.38) 0%, transparent 55%)",
    ],
  },
};

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
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: palette.gradients.join(", "),
          backgroundBlendMode: "screen",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
