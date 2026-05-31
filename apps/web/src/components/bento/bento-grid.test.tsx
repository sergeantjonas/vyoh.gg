import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";

import { BentoGrid, BentoTile } from "./bento-grid";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("BentoGrid", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  it("renders children inside a grid wrapper", () => {
    const { container } = render(
      <BentoGrid>
        <span>child</span>
      </BentoGrid>
    );
    expect(screen.getByText("child")).toBeTruthy();
    const grid = container.querySelector("[data-slot='bento-grid']");
    expect(grid?.className).toContain("grid");
  });

  it("applies a custom className to the wrapper", () => {
    const { container } = render(<BentoGrid className="extra">x</BentoGrid>);
    const grid = container.querySelector("[data-slot='bento-grid']");
    expect(grid?.className).toContain("extra");
  });

  it("renders the grid wrapper via the bento-grid data-slot (motion container)", () => {
    const { container } = render(<BentoGrid>x</BentoGrid>);
    expect(container.querySelector("[data-slot='bento-grid']")).toBeTruthy();
  });

  it("renders each tile as a bento-tile data-slot child", () => {
    const { container } = render(
      <BentoGrid>
        <BentoTile>a</BentoTile>
        <BentoTile>b</BentoTile>
        <BentoTile>c</BentoTile>
      </BentoGrid>
    );
    const tiles = container.querySelectorAll("[data-slot='bento-tile']");
    expect(tiles.length).toBe(3);
    expect(tiles[0]?.textContent).toBe("a");
    expect(tiles[1]?.textContent).toBe("b");
    expect(tiles[2]?.textContent).toBe("c");
  });

  it("pins will-change on each tile when motion is enabled (pre-promotes the layer for the lift)", () => {
    const { container } = render(
      <BentoGrid>
        <BentoTile>a</BentoTile>
      </BentoGrid>
    );
    const tile = container.querySelector("[data-slot='bento-tile']");
    expect(tile?.className).toContain("[will-change:transform,opacity,filter]");
  });

  it("drops the will-change pin under reduced motion (no layer needed for the opacity-only fade)", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <BentoGrid>
        <BentoTile>a</BentoTile>
      </BentoGrid>
    );
    const tile = container.querySelector("[data-slot='bento-tile']");
    expect(tile?.className).not.toContain("will-change");
  });
});

describe("BentoTile", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  it("applies col-span-1 / row-span-1 by default", () => {
    const { container } = render(<BentoTile>x</BentoTile>);
    const tile = container.querySelector("[data-slot='bento-tile']");
    expect(tile?.className).toContain("sm:col-span-1");
    expect(tile?.className).toContain("sm:row-span-1");
  });

  it("applies col-span-2 / row-span-2 when width and height are 2", () => {
    const { container } = render(
      <BentoTile width={2} height={2}>
        x
      </BentoTile>
    );
    const tile = container.querySelector("[data-slot='bento-tile']");
    expect(tile?.className).toContain("sm:col-span-2");
    expect(tile?.className).toContain("sm:row-span-2");
  });

  it("appends a custom className", () => {
    const { container } = render(<BentoTile className="tile-x">x</BentoTile>);
    const tile = container.querySelector("[data-slot='bento-tile']");
    expect(tile?.className).toContain("tile-x");
  });
});
