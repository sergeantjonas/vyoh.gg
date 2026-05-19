import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { CardShell } from "./card-shell";

function renderShell(props: Partial<React.ComponentProps<typeof CardShell>> = {}) {
  return render(
    <MotionConfig reducedMotion="always">
      <CardShell title="Test" verdict="The verdict" {...props} />
    </MotionConfig>
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
});
