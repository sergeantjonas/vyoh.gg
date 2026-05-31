import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmbientHero, paletteForHour, timeOfDayForHour } from "./ambient-hero";

describe("timeOfDayForHour", () => {
  it("buckets night for 0–4 and 22–23", () => {
    expect(timeOfDayForHour(0)).toBe("night");
    expect(timeOfDayForHour(4)).toBe("night");
    expect(timeOfDayForHour(22)).toBe("night");
    expect(timeOfDayForHour(23)).toBe("night");
  });

  it("buckets dawn for 5–7", () => {
    expect(timeOfDayForHour(5)).toBe("dawn");
    expect(timeOfDayForHour(7)).toBe("dawn");
  });

  it("buckets day for 8–17", () => {
    expect(timeOfDayForHour(8)).toBe("day");
    expect(timeOfDayForHour(12)).toBe("day");
    expect(timeOfDayForHour(17)).toBe("day");
  });

  it("buckets dusk for 18–21", () => {
    expect(timeOfDayForHour(18)).toBe("dusk");
    expect(timeOfDayForHour(21)).toBe("dusk");
  });
});

describe("paletteForHour", () => {
  it("returns three radial-gradient layers per time-of-day", () => {
    for (const hour of [3, 6, 12, 20]) {
      const palette = paletteForHour(hour);
      expect(palette.gradients).toHaveLength(3);
      for (const g of palette.gradients) {
        expect(g).toMatch(/^radial-gradient\(/);
      }
    }
  });

  it("differs at each time-of-day boundary", () => {
    expect(paletteForHour(4).timeOfDay).not.toBe(paletteForHour(5).timeOfDay);
    expect(paletteForHour(7).timeOfDay).not.toBe(paletteForHour(8).timeOfDay);
    expect(paletteForHour(17).timeOfDay).not.toBe(paletteForHour(18).timeOfDay);
    expect(paletteForHour(21).timeOfDay).not.toBe(paletteForHour(22).timeOfDay);
  });
});

describe("AmbientHero", () => {
  it("renders an aria-hidden decorative layer with the resolved time-of-day", () => {
    const { container } = render(<AmbientHero hour={20} />);
    const root = container.querySelector("[data-ambient-hero]");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.getAttribute("data-time-of-day")).toBe("dusk");
  });

  it("composites the three radial gradients via background-blend-mode: screen", () => {
    const { container } = render(<AmbientHero hour={3} />);
    const layer = container.querySelector(
      "[data-ambient-hero] > div"
    ) as HTMLElement | null;
    expect(layer).not.toBeNull();
    expect(layer?.style.backgroundBlendMode).toBe("screen");
    // Three layered radial-gradients joined by comma.
    expect(layer?.style.backgroundImage.match(/radial-gradient/g)).toHaveLength(3);
  });

  it("falls through to the live Brussels clock when no hour is provided", () => {
    const { container } = render(<AmbientHero />);
    const root = container.querySelector("[data-ambient-hero]");
    const tod = root?.getAttribute("data-time-of-day");
    expect(["dawn", "day", "dusk", "night"]).toContain(tod);
  });
});
