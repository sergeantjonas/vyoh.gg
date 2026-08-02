import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { type CardDensity, CardDensityProvider } from "./card-density";
import { CardShell } from "./card-shell";

function renderShell(
  props: Partial<React.ComponentProps<typeof CardShell>> = {},
  wrap: (node: ReactNode) => ReactNode = (node) => node
) {
  return render(
    <MotionConfig reducedMotion="always">
      {wrap(<CardShell title="Test" verdict="The verdict" {...props} />)}
    </MotionConfig>
  );
}

function inDensity(value: CardDensity) {
  return (node: ReactNode) => (
    <CardDensityProvider value={value}>{node}</CardDensityProvider>
  );
}

describe("CardShell", () => {
  it("renders the title and verdict", () => {
    renderShell();
    expect(screen.getByText("Test")).toBeTruthy();
    expect(screen.getByText("The verdict")).toBeTruthy();
  });

  it("renders the indicator slot when provided", () => {
    renderShell({ indicator: <span>BADGE</span> });
    expect(screen.getByText("BADGE")).toBeTruthy();
  });

  it("renders the evidence block when provided", () => {
    renderShell({ evidence: <div>EVIDENCE</div> });
    expect(screen.getByText("EVIDENCE")).toBeTruthy();
  });

  it("renders the prescription footer when provided", () => {
    renderShell({ prescription: "Do this." });
    expect(screen.getByText("Do this.")).toBeTruthy();
  });

  it("applies the muted style to the verdict when empty is true", () => {
    renderShell({ empty: true });
    const verdict = screen.getByText("The verdict");
    expect(verdict.className).toContain("text-muted-foreground/70");
  });

  it("applies the foreground style when empty is false", () => {
    renderShell({ empty: false });
    const verdict = screen.getByText("The verdict");
    expect(verdict.className).toContain("text-foreground/90");
  });

  it("takes the roomy recipe when no band has asked for anything else", () => {
    const { container } = renderShell();
    expect(screen.getByText("The verdict").className).toContain("text-base");
    expect(container.firstElementChild?.className).toContain("py-4");
  });

  it("follows the density its band declares rather than a prop of its own", () => {
    const { container } = renderShell({ prescription: "Do this." }, inDensity("compact"));
    expect(screen.getByText("The verdict").className).toContain("text-sm");
    expect(container.firstElementChild?.className).toContain("py-3");
    expect(screen.getByText("Do this.").className).toContain("pt-2");
  });
});
