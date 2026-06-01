import { fireEvent, render } from "@testing-library/react";
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

  it("labels the button for screen readers since the chevron itself is decorative", () => {
    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector("[data-slot='hero-scroll-hint']");
    expect(hint?.tagName).toBe("BUTTON");
    expect(hint?.getAttribute("aria-label")).toBe("Scroll to next section");
  });

  it("is positioned absolute over the hero", () => {
    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector("[data-slot='hero-scroll-hint']");
    expect(hint?.className).toContain("absolute");
  });

  it("scrolls <main> down by one viewport on click", () => {
    const main = document.createElement("div");
    Object.defineProperty(main, "clientHeight", { value: 720, configurable: true });
    const scrollBy = vi.fn();
    main.scrollBy = scrollBy as unknown as Element["scrollBy"];
    mainScrollRef.current = main;

    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector<HTMLButtonElement>(
      "[data-slot='hero-scroll-hint']"
    );
    fireEvent.click(hint as HTMLButtonElement);

    expect(scrollBy).toHaveBeenCalledWith({ top: 720, behavior: "smooth" });
  });

  it("uses behavior: auto when reduced motion is requested", () => {
    useReducedMotionMock.mockReturnValue(true);
    const main = document.createElement("div");
    Object.defineProperty(main, "clientHeight", { value: 500, configurable: true });
    const scrollBy = vi.fn();
    main.scrollBy = scrollBy as unknown as Element["scrollBy"];
    mainScrollRef.current = main;

    const { container } = render(<HeroScrollHint />);
    const hint = container.querySelector<HTMLButtonElement>(
      "[data-slot='hero-scroll-hint']"
    );
    fireEvent.click(hint as HTMLButtonElement);

    expect(scrollBy).toHaveBeenCalledWith({ top: 500, behavior: "auto" });
  });

  it("renders a chevron svg with role=presentation so AT does not announce it as an image", () => {
    const { container } = render(<HeroScrollHint />);
    const svg = container.querySelector("[data-slot='hero-scroll-hint'] svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("role")).toBe("presentation");
  });
});
