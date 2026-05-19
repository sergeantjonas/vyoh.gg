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
