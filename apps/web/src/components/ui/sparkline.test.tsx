import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./sparkline";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function withProvider(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

function parsePoints(points: string | null) {
  if (!points) return [];
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    });
}

describe("Sparkline", () => {
  it("renders nothing with fewer than 2 data points", () => {
    const { container: empty } = render(<Sparkline data={[]} />);
    expect(empty.querySelector("[data-slot='sparkline']")).toBeNull();
    const { container: single } = render(<Sparkline data={[3]} />);
    expect(single.querySelector("[data-slot='sparkline']")).toBeNull();
  });

  it("emits one point per data sample with the default viewBox", () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4]} />);
    const svg = container.querySelector("[data-slot='sparkline']");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 48 12");
    const points = parsePoints(
      svg?.querySelector("polyline")?.getAttribute("points") ?? ""
    );
    expect(points).toHaveLength(4);
  });

  it("scales x linearly across the width", () => {
    const { container } = render(
      <Sparkline data={[1, 1, 1, 1]} width={30} height={10} />
    );
    const points = parsePoints(
      container.querySelector("polyline")?.getAttribute("points") ?? ""
    );
    expect(points.map((p) => p.x)).toEqual([0, 10, 20, 30]);
  });

  it("scales y so the min sits at y=height and the max sits at y=0 (SVG is top-down)", () => {
    const { container } = render(<Sparkline data={[0, 5, 10]} width={20} height={10} />);
    const points = parsePoints(
      container.querySelector("polyline")?.getAttribute("points") ?? ""
    );
    expect(points[0]?.y).toBe(10);
    expect(points[2]?.y).toBe(0);
    expect(points[1]?.y).toBe(5);
  });

  it("renders a flat midline when all values are equal (no NaN from zero span)", () => {
    const { container } = render(<Sparkline data={[7, 7, 7]} width={20} height={10} />);
    const points = parsePoints(
      container.querySelector("polyline")?.getAttribute("points") ?? ""
    );
    expect(points.every((p) => p.y === 10)).toBe(true);
  });

  it("defaults stroke to var(--theme-strong) and accepts override", () => {
    const { container, rerender } = render(<Sparkline data={[1, 2]} />);
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe(
      "var(--theme-strong)"
    );
    rerender(<Sparkline data={[1, 2]} stroke="red" />);
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe("red");
  });

  it("marks the SVG aria-hidden by default and exposes it when an aria-label is provided", () => {
    const { container, rerender } = render(<Sparkline data={[1, 2]} />);
    expect(
      container.querySelector("[data-slot='sparkline']")?.getAttribute("aria-hidden")
    ).toBe("true");
    rerender(<Sparkline data={[1, 2]} aria-label="KDA trend" />);
    const svg = container.querySelector("[data-slot='sparkline']");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("KDA trend");
  });

  it("merges className alongside the base inline-block alignment classes", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} className="text-emerald-400" />
    );
    const svg = container.querySelector("[data-slot='sparkline']");
    expect(svg?.getAttribute("class")).toContain("inline-block");
    expect(svg?.getAttribute("class")).toContain("text-emerald-400");
  });

  it("renders the bare svg when no tooltip prop is passed", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} aria-label="trend" />);
    expect(container.querySelector("[data-slot='sparkline']")).toBeTruthy();
    expect(container.querySelector("button")).toBeNull();
  });

  it("wraps the svg in a focusable trigger when a tooltip is provided", () => {
    const { container } = withProvider(
      <Sparkline data={[1, 2, 3]} aria-label="trend" tooltip={<span>details</span>} />
    );
    const trigger = container.querySelector("button");
    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute("type")).toBe("button");
    expect(trigger?.querySelector("[data-slot='sparkline']")).toBeTruthy();
  });

  it("passes axe a11y checks for both bare and tooltip-enabled variants", async () => {
    const { container: bare } = render(
      <Sparkline data={[1, 2, 3]} aria-label="bare trend" />
    );
    expect((await axe(bare)).violations).toHaveLength(0);

    const { container: tipped } = withProvider(
      <Sparkline
        data={[1, 2, 3]}
        aria-label="tooltip trend"
        tooltip={<span>details</span>}
      />
    );
    expect((await axe(tipped)).violations).toHaveLength(0);
  });
});
