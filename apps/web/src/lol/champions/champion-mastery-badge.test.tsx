import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ChampionMasteryResponse } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionMasteryBadge } from "./champion-mastery-badge";
import { useChampionMastery } from "./use-champion-mastery";

vi.mock("./use-champion-mastery", () => ({ useChampionMastery: vi.fn() }));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function mockMastery(data: ChampionMasteryResponse | undefined) {
  vi.mocked(useChampionMastery).mockReturnValue({ data } as ReturnType<
    typeof useChampionMastery
  >);
}

function renderBadge() {
  return render(
    <TooltipPrimitive.Provider>
      <ChampionMasteryBadge accountSlug="ahri" championKey="ahri" />
    </TooltipPrimitive.Provider>
  );
}

const AHRI: ChampionMasteryResponse = {
  mastery: { level: 105, points: 1_124_191, lastPlayedAt: "2026-09-10T20:00:00.000Z" },
};

afterEach(() => {
  vi.mocked(useChampionMastery).mockReset();
});

describe("ChampionMasteryBadge", () => {
  it("draws nothing until the query lands, so the server render has no pill", () => {
    mockMastery(undefined);
    const { container } = renderBadge();
    expect(container.firstChild).toBeNull();
  });

  it("draws nothing for a champion the account has never played", () => {
    mockMastery({ mastery: null });
    const { container } = renderBadge();
    expect(container.firstChild).toBeNull();
  });

  it("names the level and a compact point count", () => {
    mockMastery(AHRI);
    renderBadge();
    expect(screen.getByText("Mastery 105 · 1.12M")).toBeTruthy();
  });

  it("gives the exact points and the last game on focus", async () => {
    mockMastery(AHRI);
    renderBadge();
    fireEvent.focus(screen.getByText("Mastery 105 · 1.12M"));
    expect(
      (
        await screen.findAllByText(
          /1,124,191 lifetime points · last played 10 Sept? 2026/
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it("has no axe violations", async () => {
    mockMastery(AHRI);
    const { container } = renderBadge();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
