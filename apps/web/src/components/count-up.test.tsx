import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("renders the final value immediately in test mode (animation bypassed)", () => {
    render(<CountUp to={42} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("formats the value to the requested decimal precision", () => {
    render(<CountUp to={Math.PI} decimals={2} />);
    expect(screen.getByText("3.14")).toBeTruthy();
  });

  it("applies the className to the wrapping span", () => {
    const { container } = render(<CountUp to={5} className="font-mono" />);
    expect(container.querySelector("span")?.className).toContain("font-mono");
  });

  // Test-mode skip bypasses the start gate by design: tests assert the final
  // value regardless of `start` so chapter/prose tests don't depend on
  // whether their nudge state has flipped. Browser-mode gating is covered
  // by integration with the chapter / verdict-prose entrance flow.
  it("still renders the final value in test mode even when start={false}", () => {
    render(<CountUp to={42} start={false} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("accepts a delay prop without changing its rendered output in test mode", () => {
    render(<CountUp to={7} delay={1.5} />);
    expect(screen.getByText("7")).toBeTruthy();
  });
});
