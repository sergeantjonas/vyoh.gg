import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummonerSpellIcon } from "./summoner-spell-icon";

vi.mock("@/lol/_shared/analytics/use-summoner-spells", () => ({
  useSummonerSpells: vi.fn(),
}));

import { useSummonerSpells } from "@/lol/_shared/analytics/use-summoner-spells";

function renderIcon(id: number) {
  return render(
    <TooltipPrimitive.Provider>
      <SummonerSpellIcon id={id} />
    </TooltipPrimitive.Provider>
  );
}

describe("SummonerSpellIcon", () => {
  it("renders the spell icon when spells are loaded", () => {
    vi.mocked(useSummonerSpells).mockReturnValue(
      new Map([[4, { iconUrl: "/img/lol/spell/4/26.9.webp", name: "Flash" }]])
    );
    renderIcon(4);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/img/lol/spell/4/26.9.webp");
    expect(img.getAttribute("alt")).toBe("Flash");
  });

  it("renders a placeholder when the spell id is unknown", () => {
    vi.mocked(useSummonerSpells).mockReturnValue(new Map());
    const { container } = renderIcon(99);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a placeholder while spell data is loading", () => {
    vi.mocked(useSummonerSpells).mockReturnValue(undefined);
    const { container } = renderIcon(4);
    expect(container.querySelector("img")).toBeNull();
  });
});
