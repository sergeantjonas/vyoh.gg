import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AmbientHero,
  intensityToChromaMultiplier,
  layerToCssGradient,
  paletteForHour,
  timeOfDayForHour,
} from "./ambient-hero";

vi.mock("./atmosphere/use-atmosphere-claim", () => ({
  useAtmosphereClaim: vi.fn(),
}));
const { useAtmosphereClaim } = await import("./atmosphere/use-atmosphere-claim");
const mockUseAtmosphereClaim = vi.mocked(useAtmosphereClaim);

function MountHero({ hour, intensity }: { hour?: number; intensity?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  return <AmbientHero bandRef={ref} hour={hour} intensity={intensity} />;
}

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
  it("returns three gradient layers per time-of-day", () => {
    for (const hour of [3, 6, 12, 20]) {
      const palette = paletteForHour(hour);
      expect(palette.layers).toHaveLength(3);
      for (const layer of palette.layers) {
        expect(layer.lch).toHaveLength(3);
        expect(layer.alpha).toBeGreaterThan(0);
        expect(layer.alpha).toBeLessThanOrEqual(1);
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
  it("renders nothing on its own — the atmosphere layer is the visible surface", () => {
    mockUseAtmosphereClaim.mockClear();
    const { container } = render(<MountHero hour={12} />);
    expect(container.firstChild).toBeNull();
  });

  it("registers an atmosphere claim with the palette for the resolved hour", () => {
    mockUseAtmosphereClaim.mockClear();
    render(<MountHero hour={20} />);
    const [, claim] = mockUseAtmosphereClaim.mock.calls.at(-1) ?? [];
    expect(claim?.palette.timeOfDay).toBe("dusk");
  });

  it("defaults intensity to 0.5 when the prop is omitted", () => {
    mockUseAtmosphereClaim.mockClear();
    render(<MountHero hour={12} />);
    const [, claim] = mockUseAtmosphereClaim.mock.calls.at(-1) ?? [];
    expect(claim?.intensity).toBe(0.5);
  });

  it("forwards an explicit intensity prop into the claim", () => {
    mockUseAtmosphereClaim.mockClear();
    render(<MountHero hour={12} intensity={0.9} />);
    const [, claim] = mockUseAtmosphereClaim.mock.calls.at(-1) ?? [];
    expect(claim?.intensity).toBe(0.9);
  });

  it("honours ?hour=N URL search param when no hour prop is provided", () => {
    const original = window.location.search;
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "?hour=19" },
      writable: true,
    });
    mockUseAtmosphereClaim.mockClear();
    try {
      render(<MountHero />);
      const [, claim] = mockUseAtmosphereClaim.mock.calls.at(-1) ?? [];
      expect(claim?.palette.timeOfDay).toBe("dusk");
    } finally {
      Object.defineProperty(window, "location", {
        value: { ...window.location, search: original },
        writable: true,
      });
    }
  });

  it("ignores invalid ?hour values and falls back to the live clock", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "?hour=99" },
      writable: true,
    });
    mockUseAtmosphereClaim.mockClear();
    try {
      render(<MountHero />);
      const [, claim] = mockUseAtmosphereClaim.mock.calls.at(-1) ?? [];
      expect(["dawn", "day", "dusk", "night"]).toContain(claim?.palette.timeOfDay);
    } finally {
      Object.defineProperty(window, "location", {
        value: { ...window.location, search: "" },
        writable: true,
      });
    }
  });
});

describe("intensityToChromaMultiplier", () => {
  it("returns the baseline 1.0 at intensity 0.5", () => {
    expect(intensityToChromaMultiplier(0.5)).toBeCloseTo(1.0, 5);
  });

  it("returns 0.7 at intensity 0 (muted)", () => {
    expect(intensityToChromaMultiplier(0)).toBeCloseTo(0.7, 5);
  });

  it("returns 1.3 at intensity 1 (vivid)", () => {
    expect(intensityToChromaMultiplier(1)).toBeCloseTo(1.3, 5);
  });

  it("clamps values outside [0, 1]", () => {
    expect(intensityToChromaMultiplier(-1)).toBeCloseTo(0.7, 5);
    expect(intensityToChromaMultiplier(2)).toBeCloseTo(1.3, 5);
  });
});

describe("layerToCssGradient", () => {
  const layer = {
    cx: 0.5,
    cy: 0.5,
    radius: 800,
    lch: [0.6, 0.15, 230],
    alpha: 0.3,
    phase: 0,
  } as const;

  function chromaInGradient(s: string): number {
    const m = s.match(/oklch\(0\.6 ([0-9.]+) 230/);
    return m ? Number(m[1]) : Number.NaN;
  }

  it("uses the baseline chroma (×1.0) at intensity 0.5", () => {
    expect(chromaInGradient(layerToCssGradient(layer, 0.5))).toBeCloseTo(0.15, 5);
  });

  it("scales chroma up at high intensity", () => {
    expect(chromaInGradient(layerToCssGradient(layer, 1))).toBeCloseTo(0.195, 5);
  });

  it("scales chroma down at low intensity", () => {
    expect(chromaInGradient(layerToCssGradient(layer, 0))).toBeCloseTo(0.105, 5);
  });
});
