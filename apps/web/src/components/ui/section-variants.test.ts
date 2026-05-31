import { describe, expect, it } from "vitest";

import {
  SECTION_DELAY,
  SECTION_REDUCED_FADE_DURATION,
  SECTION_STAGGER,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "./section-variants";

describe("section-variants", () => {
  it("declares hidden and visible labels on the container so children inherit via cascade", () => {
    expect(sectionContainerVariants.hidden).toBeDefined();
    expect(sectionContainerVariants.visible).toBeDefined();
  });

  it("drives the cascade via staggerChildren + delayChildren on the visible variant", () => {
    const visible = sectionContainerVariants.visible as {
      transition: { staggerChildren: number; delayChildren: number };
    };
    expect(visible.transition.staggerChildren).toBe(SECTION_STAGGER);
    expect(visible.transition.delayChildren).toBe(SECTION_DELAY);
  });

  it("ships an opacity-only reduced-motion replacement container", () => {
    const hidden = sectionReducedContainerVariants.hidden as { opacity: number };
    const visible = sectionReducedContainerVariants.visible as {
      opacity: number;
      transition: { duration: number };
    };
    expect(hidden.opacity).toBe(0);
    expect(visible.opacity).toBe(1);
    expect(visible.transition.duration).toBe(SECTION_REDUCED_FADE_DURATION);
  });

  it("exposes the editorial child roles, each with hidden + visible", () => {
    const roles = ["eyebrow", "headline", "meta", "body", "tile"] as const;
    for (const role of roles) {
      const v = sectionChildVariants[role];
      expect(v.hidden).toBeDefined();
      expect(v.visible).toBeDefined();
    }
  });

  it("starts each child with opacity 0 + a positive Y offset and lands at 0", () => {
    const roles = ["eyebrow", "headline", "meta", "body", "tile"] as const;
    for (const role of roles) {
      const hidden = sectionChildVariants[role].hidden as { opacity: number; y: number };
      const visible = sectionChildVariants[role].visible as {
        opacity: number;
        y: number;
      };
      expect(hidden.opacity).toBe(0);
      expect(hidden.y).toBeGreaterThan(0);
      expect(visible.opacity).toBe(1);
      expect(visible.y).toBe(0);
    }
  });

  it("gives the headline the most pronounced Y offset of the editorial-text roles", () => {
    const yOf = (role: keyof typeof sectionChildVariants) =>
      (sectionChildVariants[role].hidden as { y: number }).y;
    const headlineY = yOf("headline");
    expect(headlineY).toBeGreaterThan(yOf("eyebrow"));
    expect(headlineY).toBeGreaterThan(yOf("meta"));
    expect(headlineY).toBeGreaterThan(yOf("body"));
  });

  it("gives tile (card-sized blocks) a heavier lift than body (text), but lighter than headline", () => {
    const yOf = (role: keyof typeof sectionChildVariants) =>
      (sectionChildVariants[role].hidden as { y: number }).y;
    expect(yOf("tile")).toBeGreaterThan(yOf("body"));
    expect(yOf("tile")).toBeLessThan(yOf("headline"));
  });
});
