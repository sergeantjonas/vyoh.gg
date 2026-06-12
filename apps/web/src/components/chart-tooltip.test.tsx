import { render, screen } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { describe, expect, it } from "vitest";
import { ChartTooltipShell } from "./chart-tooltip";

function renderShell(children: React.ReactNode, className?: string) {
  return render(
    <LazyMotion features={domAnimation}>
      <ChartTooltipShell className={className}>{children}</ChartTooltipShell>
    </LazyMotion>
  );
}

describe("ChartTooltipShell", () => {
  it("renders children inside the popover shell when active", () => {
    renderShell(<span>3.1 KDA</span>);
    const content = screen.getByText("3.1 KDA");
    expect(content.parentElement?.className).toContain("bg-popover/85");
  });

  it("renders nothing when children are null (inactive tooltip)", () => {
    const { container } = renderShell(null);
    expect(container.firstChild).toBeNull();
  });

  it("merges call-site className over the base recipe", () => {
    renderShell(<span>row</span>, "text-sm");
    const shell = screen.getByText("row").parentElement;
    expect(shell?.className).toContain("text-sm");
    expect(shell?.className).not.toContain("text-xs");
  });
});
