import { render } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { UnlocksPerWeekBand } from "./unlocks-per-week-band";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

describe("UnlocksPerWeekBand", () => {
  it("renders nothing for an empty series", () => {
    const { container } = render(<UnlocksPerWeekBand data={[]} />);
    expect(container.querySelector("[data-unlocks-per-week-band]")).toBeNull();
  });

  it("renders nothing for a single-point series (no shape to draw)", () => {
    const { container } = render(<UnlocksPerWeekBand data={[3]} />);
    expect(container.querySelector("[data-unlocks-per-week-band]")).toBeNull();
  });

  it("renders area fill + halo + accent stroke for valid data", () => {
    const { container } = render(<UnlocksPerWeekBand data={[0, 1, 3, 2, 5]} />);
    const band = container.querySelector("[data-unlocks-per-week-band]");
    expect(band).not.toBeNull();
    const paths = container.querySelectorAll("svg path");
    // Three paths: area gradient fill + dark halo stroke (paint-order
    // substitute for hue-collision readability) + accent stroke on top.
    expect(paths.length).toBe(3);
    const areaPath = paths[0]?.getAttribute("d") ?? "";
    expect(areaPath.startsWith("M")).toBe(true);
    expect(areaPath.endsWith("Z")).toBe(true);
  });

  it("publishes a summary aria-label describing total and latest week", () => {
    const { container } = render(<UnlocksPerWeekBand data={[0, 1, 3, 2, 5]} />);
    const svg = container.querySelector("svg[role='img']");
    expect(svg?.getAttribute("aria-label")).toBe(
      "11 unlocks across the last 5 weeks, 5 this week"
    );
  });

  it("singularises 'unlock' when the total is 1", () => {
    const { container } = render(<UnlocksPerWeekBand data={[0, 0, 1]} />);
    const svg = container.querySelector("svg[role='img']");
    expect(svg?.getAttribute("aria-label")).toBe(
      "1 unlock across the last 3 weeks, 1 this week"
    );
  });

  it("renders cleanly when all weeks have zero unlocks (degenerate flat line)", () => {
    // safeMax guard: max=0 must not produce NaN in path coords.
    const { container } = render(<UnlocksPerWeekBand data={[0, 0, 0]} />);
    const path = container.querySelector("svg path");
    const d = path?.getAttribute("d") ?? "";
    expect(d.includes("NaN")).toBe(false);
  });

  it("passes axe accessibility checks", async () => {
    const { container } = render(<UnlocksPerWeekBand data={[2, 1, 4, 3, 5]} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
