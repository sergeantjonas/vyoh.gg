import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChampionSquareIcon } from "./champion-square-icon";

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "26.9.1",
}));

describe("ChampionSquareIcon", () => {
  it("renders an img pointing at the champion-square proxy URL", () => {
    render(<ChampionSquareIcon championName="Ahri" alt="Ahri" />);
    const img = screen.getByRole("img", { name: "Ahri" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(
      "/img/lol/champion/ahri/square/26.9.1.webp"
    );
  });

  it("shows the pulse placeholder until the image fires onLoad", () => {
    const { container } = render(<ChampionSquareIcon championName="Zed" />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    fireEvent.load(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("applies the className to the wrapping span", () => {
    const { container } = render(
      <ChampionSquareIcon championName="Yasuo" className="size-8" />
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("size-8");
  });
});
