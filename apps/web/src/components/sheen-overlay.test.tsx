import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SheenOverlay } from "./sheen-overlay";

describe("SheenOverlay", () => {
  it("is decorative and carries the reduced-motion hook", () => {
    const { container } = render(<SheenOverlay group="tile" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.hasAttribute("data-sheen")).toBe(true);
    expect(el.className).toContain("pointer-events-none");
  });

  it("reads the named hover group it is told to sit under", () => {
    const tile = render(<SheenOverlay group="tile" />).container
      .firstElementChild as HTMLElement;
    const row = render(<SheenOverlay group="row" />).container
      .firstElementChild as HTMLElement;
    expect(tile.className).toContain("group-hover/tile:opacity-100");
    expect(tile.className).toContain("group-hover/tile:[--sheen-extent:42%]");
    expect(tile.className).not.toContain("group-hover/row:");
    expect(row.className).toContain("group-hover/row:opacity-100");
    expect(row.className).toContain("group-hover/row:[--sheen-extent:42%]");
    expect(row.className).not.toContain("group-hover/tile:");
  });
});
