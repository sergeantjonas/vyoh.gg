import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountUp } from "@/components/count-up";

import { HeroLabel, HeroNumber, HeroPair } from "./hero-number";

describe("HeroNumber", () => {
  it("renders tabular-nums and the lg clamp by default", () => {
    const { container } = render(<HeroNumber>3.42</HeroNumber>);
    const el = container.querySelector("[data-slot='hero-number']");
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-size")).toBe("lg");
    expect(el?.className).toContain("tabular-nums");
    expect(el?.className).toContain("text-[clamp(2.5rem,5vw,4rem)]");
    expect(el?.className).toContain("font-[720]");
    expect(el?.className).toContain("tracking-[-0.02em]");
    expect(el?.textContent).toBe("3.42");
  });

  it("uses the md clamp when size=md", () => {
    const { container } = render(<HeroNumber size="md">12</HeroNumber>);
    const el = container.querySelector("[data-slot='hero-number']");
    expect(el?.getAttribute("data-size")).toBe("md");
    expect(el?.className).toContain("text-[clamp(1.75rem,3vw,2.5rem)]");
    expect(el?.className).not.toContain("text-[clamp(2.5rem,5vw,4rem)]");
  });

  it("merges className", () => {
    const { container } = render(<HeroNumber className="x-extra">1</HeroNumber>);
    expect(container.querySelector("[data-slot='hero-number']")?.className).toContain(
      "x-extra"
    );
  });

  it("wraps CountUp without altering the formatted value", () => {
    const { container } = render(
      <HeroNumber>
        <CountUp to={3.42} decimals={2} />
      </HeroNumber>
    );
    // CountUp's SHOULD_ANIMATE bypass returns the final value synchronously in test mode.
    expect(container.querySelector("[data-slot='hero-number']")?.textContent).toBe(
      "3.42"
    );
  });
});

describe("HeroLabel", () => {
  it("renders uppercase + muted label classes", () => {
    const { container } = render(<HeroLabel>KDA</HeroLabel>);
    const el = container.querySelector("[data-slot='hero-label']");
    expect(el).toBeTruthy();
    expect(el?.className).toContain("uppercase");
    expect(el?.className).toContain("font-[380]");
    expect(el?.className).toContain("tracking-[0.18em]");
    expect(el?.className).toContain("text-muted-foreground/80");
    expect(el?.textContent).toBe("KDA");
  });

  it("merges className", () => {
    const { container } = render(<HeroLabel className="x-label">A</HeroLabel>);
    expect(container.querySelector("[data-slot='hero-label']")?.className).toContain(
      "x-label"
    );
  });
});

describe("HeroPair", () => {
  it("renders label above number by default", () => {
    const { container } = render(<HeroPair label="KDA">3.42</HeroPair>);
    const pair = container.querySelector("[data-slot='hero-pair']");
    expect(pair?.getAttribute("data-label-position")).toBe("above");
    const children = Array.from(pair?.children ?? []);
    expect(children[0]?.getAttribute("data-slot")).toBe("hero-label");
    expect(children[1]?.getAttribute("data-slot")).toBe("hero-number");
  });

  it("inverts to label-below when labelPosition=below", () => {
    const { container } = render(
      <HeroPair label="KDA" labelPosition="below">
        3.42
      </HeroPair>
    );
    const pair = container.querySelector("[data-slot='hero-pair']");
    expect(pair?.getAttribute("data-label-position")).toBe("below");
    const children = Array.from(pair?.children ?? []);
    expect(children[0]?.getAttribute("data-slot")).toBe("hero-number");
    expect(children[1]?.getAttribute("data-slot")).toBe("hero-label");
  });

  it("forwards size to the underlying HeroNumber", () => {
    const { container } = render(
      <HeroPair label="WR" size="md">
        58.3%
      </HeroPair>
    );
    expect(
      container.querySelector("[data-slot='hero-number']")?.getAttribute("data-size")
    ).toBe("md");
  });
});
