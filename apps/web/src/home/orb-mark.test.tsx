import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { OrbMark } from "./orb-mark";

function renderOrb(props: { className?: string } = {}) {
  return render(
    <MotionConfig reducedMotion="always">
      <OrbMark {...props} />
    </MotionConfig>
  );
}

describe("OrbMark", () => {
  it("renders the orb svg with its aria-hidden mark image", () => {
    const { container } = renderOrb();
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/vyoh-orb-mark.svg");
    expect(img?.getAttribute("alt")).toBe("vyoh orb");
  });

  it("forwards a className onto the outer wrapper", () => {
    const { container } = renderOrb({ className: "test-cls" });
    expect(container.querySelector(".test-cls")).not.toBeNull();
  });

  it("emits multiple aria-hidden decorative layers (halos, sparkles, wisps)", () => {
    const { container } = renderOrb();
    const decorative = container.querySelectorAll("[aria-hidden='true']");
    // The component composes 2 halos + 1 core + 6 sparkles + 3 wisps as
    // aria-hidden layers around the mark — assert there is a non-trivial set.
    expect(decorative.length).toBeGreaterThan(8);
  });
});
