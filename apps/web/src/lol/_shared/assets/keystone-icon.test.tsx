import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeystoneIcon } from "./keystone-icon";

vi.mock("@/lol/_shared/analytics/use-perks", () => ({
  usePerks: vi.fn(),
}));

import { usePerks } from "@/lol/_shared/analytics/use-perks";

function renderIcon(id: number) {
  return render(
    <TooltipPrimitive.Provider>
      <KeystoneIcon id={id} />
    </TooltipPrimitive.Provider>
  );
}

describe("KeystoneIcon", () => {
  it("renders an img with the perk icon URL when perks are loaded", () => {
    vi.mocked(usePerks).mockReturnValue(
      new Map([
        [8005, { iconUrl: "/img/lol/rune/8005/26.9.webp", name: "Press the Attack" }],
      ])
    );
    renderIcon(8005);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/img/lol/rune/8005/26.9.webp");
    expect(img.getAttribute("alt")).toBe("Press the Attack");
  });

  it("renders a muted placeholder when the perk id is unknown", () => {
    vi.mocked(usePerks).mockReturnValue(new Map());
    const { container } = renderIcon(9999);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".bg-muted\\/40")).toBeTruthy();
  });

  it("renders a placeholder when perks data is still loading", () => {
    vi.mocked(usePerks).mockReturnValue(undefined);
    const { container } = renderIcon(8005);
    expect(container.querySelector("img")).toBeNull();
  });
});
