import { mainScrollRef } from "@/lib/scroll-container";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useHeroScrolledPast } from "./use-hero-scrolled-past";

describe("useHeroScrolledPast", () => {
  let scrollContainer: HTMLDivElement;

  beforeEach(() => {
    scrollContainer = document.createElement("div");
    mainScrollRef.current = scrollContainer;
  });

  afterEach(() => {
    mainScrollRef.current = null;
  });

  function makeHero(midpoint: number) {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        top: midpoint - 50,
        bottom: midpoint + 50,
        height: 100,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: midpoint - 50,
      }) as DOMRect;
    return el;
  }

  it("starts false and stays false while the hero midpoint is below the header", () => {
    const { result, rerender } = renderHook(() => useHeroScrolledPast());
    const [, setHeroEl] = result.current;
    act(() => {
      setHeroEl(makeHero(500));
    });
    rerender();
    expect(result.current[0]).toBe(false);
  });

  it("flips to true once the hero midpoint scrolls above the default 96px header", () => {
    const { result, rerender } = renderHook(() => useHeroScrolledPast());
    act(() => {
      result.current[1](makeHero(40));
    });
    rerender();
    expect(result.current[0]).toBe(true);
  });

  it("hysteresis: re-evaluates on scroll events", () => {
    const { result, rerender } = renderHook(() => useHeroScrolledPast());
    const hero = document.createElement("div");
    let mid = 500;
    hero.getBoundingClientRect = () =>
      ({
        top: mid - 50,
        bottom: mid + 50,
        height: 100,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: mid - 50,
      }) as DOMRect;
    act(() => {
      result.current[1](hero);
    });
    rerender();
    expect(result.current[0]).toBe(false);

    act(() => {
      mid = 40;
      fireEvent.scroll(scrollContainer);
    });
    rerender();
    expect(result.current[0]).toBe(true);

    act(() => {
      mid = 500;
      fireEvent.scroll(scrollContainer);
    });
    rerender();
    expect(result.current[0]).toBe(false);
  });
});
