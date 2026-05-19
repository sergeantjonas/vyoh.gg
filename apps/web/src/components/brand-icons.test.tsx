import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueOfLegendsIcon, SteamIcon } from "./brand-icons";

describe("brand-icons", () => {
  it("renders SteamIcon as an svg with role=img", () => {
    const { container } = render(<SteamIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders LeagueOfLegendsIcon as an svg with role=img", () => {
    const { container } = render(<LeagueOfLegendsIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("role")).toBe("img");
  });

  it("forwards extra props (className) to the underlying svg", () => {
    const { container } = render(<SteamIcon className="size-5 text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("size-5");
    expect(svg?.getAttribute("class")).toContain("text-primary");
  });
});
