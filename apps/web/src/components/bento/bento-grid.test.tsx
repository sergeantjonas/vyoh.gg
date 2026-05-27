import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BentoGrid, BentoTile } from "./bento-grid";

describe("BentoGrid", () => {
  it("renders children inside a grid wrapper", () => {
    const { container } = render(
      <BentoGrid>
        <span>child</span>
      </BentoGrid>
    );
    expect(screen.getByText("child")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("grid");
  });

  it("applies a custom className to the wrapper", () => {
    const { container } = render(<BentoGrid className="extra">x</BentoGrid>);
    expect((container.firstElementChild as HTMLElement).className).toContain("extra");
  });

  it("marks the wrapper as a stagger container", () => {
    const { container } = render(<BentoGrid>x</BentoGrid>);
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "stagger-children"
    );
  });

  it("stamps each tile child with an --i ordinal", () => {
    const { container } = render(
      <BentoGrid>
        <BentoTile>a</BentoTile>
        <BentoTile>b</BentoTile>
        <BentoTile>c</BentoTile>
      </BentoGrid>
    );
    const tiles = Array.from(
      (container.firstElementChild as HTMLElement).children
    ) as HTMLElement[];
    expect(tiles.map((el) => el.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
  });

  it("preserves consumer-supplied style alongside --i", () => {
    const { container } = render(
      <BentoGrid>
        <BentoTile style={{ background: "red" }}>x</BentoTile>
      </BentoGrid>
    );
    const tile = (container.firstElementChild as HTMLElement)
      .firstElementChild as HTMLElement;
    expect(tile.style.background).toBe("red");
    expect(tile.style.getPropertyValue("--i")).toBe("0");
  });
});

describe("BentoTile", () => {
  it("applies col-span-1 / row-span-1 by default", () => {
    const { container } = render(<BentoTile>x</BentoTile>);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("sm:col-span-1");
    expect(cls).toContain("sm:row-span-1");
  });

  it("applies col-span-2 / row-span-2 when width and height are 2", () => {
    const { container } = render(
      <BentoTile width={2} height={2}>
        x
      </BentoTile>
    );
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("sm:col-span-2");
    expect(cls).toContain("sm:row-span-2");
  });

  it("appends a custom className", () => {
    const { container } = render(<BentoTile className="tile-x">x</BentoTile>);
    expect((container.firstElementChild as HTMLElement).className).toContain("tile-x");
  });
});
