import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { LandingHeading } from "./landing-heading";

function renderHeading() {
  return render(
    <MotionConfig reducedMotion="always">
      <LandingHeading />
    </MotionConfig>
  );
}

describe("LandingHeading", () => {
  it("renders a single h1 with the display headline", () => {
    const { container } = renderHeading();
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    // Three-line editorial composition — subject + active claim + open
    // growth clause all belong to the same h1 for a11y.
    expect(h1s[0]?.textContent).toContain("A self-portrait,");
    expect(h1s[0]?.textContent).toContain("forged in League of Legends, Steam,");
    expect(h1s[0]?.textContent).toContain("and whatever I plug in next.");
  });

  it("renders the vyoh.gg eyebrow above the headline", () => {
    const { container } = renderHeading();
    expect(container.textContent).toContain("vyoh.gg");
  });

  it("mounts the OrbMark", () => {
    const { container } = renderHeading();
    expect(container.querySelector("img[src='/vyoh-orb-mark.svg']")).not.toBeNull();
  });
});
