import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";

import { HeroScrollHint } from "./hero-scroll-hint";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("HeroScrollHint", () => {
  // `useScroll({ container: mainScrollRef })` invariant-throws if the ref is
  // unhydrated. In the real app <main> populates the ref at mount; in tests we
  // hydrate it manually so the hook can attach its scroll listener.
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
    mainScrollRef.current = document.createElement("div");
  });

  afterEach(() => {
    mainScrollRef.current = null;
  });

  it("renders the chevron wrapper with the hero-scroll-hint data-slot", () => {
    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector("[data-slot='hero-scroll-hint']");
    expect(hint).toBeTruthy();
  });

  it("marks the wrapper as decorative via aria-hidden so screen readers skip it", () => {
    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector("[data-slot='hero-scroll-hint']");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is positioned absolute + pointer-events-none so it floats over the hero without blocking interaction", () => {
    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector("[data-slot='hero-scroll-hint']");
    expect(hint?.className).toContain("absolute");
    expect(hint?.className).toContain("pointer-events-none");
  });

  it("renders a chevron svg with role=presentation so AT does not announce it as an image", () => {
    const { container } = render(<HeroScrollHint />);
    const svg = container.querySelector("[data-slot='hero-scroll-hint'] svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("role")).toBe("presentation");
  });
});
