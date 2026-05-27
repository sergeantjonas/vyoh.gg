import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalettePreviewChampion } from "./command-palette-preview-champion";

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-testid={`champ-icon-${championName}`} />
  ),
}));

const championsRef = {
  current: new Map<
    string,
    {
      id: number;
      alias: string;
      name: string;
      roles: string[];
      modernClasses: string[];
      modernSubclasses: string[];
    }
  >(),
};

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionInfo: (alias: string) => championsRef.current.get(alias.toLowerCase()),
  useChampionName: () => (alias: string) =>
    championsRef.current.get(alias.toLowerCase())?.name ?? alias,
}));

function setChampions() {
  championsRef.current = new Map([
    [
      "jinx",
      {
        id: 222,
        alias: "Jinx",
        name: "Jinx",
        roles: ["Marksman"],
        modernClasses: ["Marksman"],
        modernSubclasses: [],
      },
    ],
    [
      "jarvaniv",
      {
        id: 59,
        alias: "JarvanIV",
        name: "Jarvan IV",
        roles: ["Tank", "Fighter"],
        modernClasses: ["Vanguard", "Juggernaut"],
        modernSubclasses: [],
      },
    ],
  ]);
}

describe("CommandPalettePreviewChampion", () => {
  it("renders nothing while champion data is loading", () => {
    championsRef.current = new Map();
    const { container } = render(<CommandPalettePreviewChampion alias="jinx" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the champion's display name and roles", () => {
    setChampions();
    render(<CommandPalettePreviewChampion alias="JarvanIV" />);
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.textContent).toContain("Jarvan IV");
    expect(preview.textContent).toContain("Tank · Fighter");
  });

  it("renders modern-class chips", () => {
    setChampions();
    render(<CommandPalettePreviewChampion alias="JarvanIV" />);
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.textContent).toContain("Vanguard");
    expect(preview.textContent).toContain("Juggernaut");
  });

  it("tags preview with type for dispatch identification", () => {
    setChampions();
    render(<CommandPalettePreviewChampion alias="jinx" />);
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.getAttribute("data-preview-type")).toBe("champion");
  });
});
