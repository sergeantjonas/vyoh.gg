import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionLanePhase } from "@/lol/champions/use-champion-lane-phase";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type {
  ChampionLanePhase as ChampionLanePhaseData,
  LolAccount,
} from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionLanePhase } from "./champion-lane-phase";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/champions/use-champion-lane-phase", () => ({
  useChampionLanePhase: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setLanePhase(opts: {
  data?: ChampionLanePhaseData | undefined;
  isPending?: boolean;
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useChampionLanePhase).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useChampionLanePhase>);
}

function renderShell() {
  return render(
    <TooltipPrimitive.Provider>
      <ChampionLanePhase accountSlug="jonas-euw" championKey="ahri" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useChampionLanePhase).mockReset();
});

describe("ChampionLanePhase", () => {
  it("renders null while the query is pending", () => {
    setLanePhase({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null when data is undefined", () => {
    setLanePhase({ data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders the empty state below the MIN_ENTRIES threshold", () => {
    setLanePhase({
      data: {
        sampleSize: 3,
        csAt10: { diff: 5, aheadRate: 0.6 },
        csAt15: { diff: 5, aheadRate: 0.6 },
        goldAt10: { diff: 100, aheadRate: 0.6 },
      },
    });
    renderShell();
    expect(screen.getByText("Lane phase")).toBeTruthy();
    expect(screen.getByText(/Need 5\+ games with a tracked lane opponent/)).toBeTruthy();
  });

  it("renders the out-farm verdict and sign-colored stat tiles", () => {
    setLanePhase({
      data: {
        sampleSize: 8,
        csAt10: { diff: 18.4, aheadRate: 0.625 },
        csAt15: { diff: -5, aheadRate: 0.4 },
        goldAt10: { diff: 540, aheadRate: 0.7 },
      },
    });
    renderShell();
    // Verdict reads the CS@10 differential, rounded.
    expect(
      screen.getByText(/You out-farm your lane opponent by 18 CS at 10 min/)
    ).toBeTruthy();
    expect(screen.getByText(/ahead in 63% of 8 games/)).toBeTruthy();
    // Tiles: signed, sign-colored.
    const cs10 = screen.getByText("+18");
    expect(cs10.className).toContain("text-emerald-400");
    const cs15 = screen.getByText("-5");
    expect(cs15.className).toContain("text-rose-400");
    expect(screen.getByText("+540")).toBeTruthy();
  });

  it("reframes the verdict when the lane opponent out-farms the owner", () => {
    setLanePhase({
      data: {
        sampleSize: 6,
        csAt10: { diff: -12, aheadRate: 0.33 },
        csAt15: { diff: -20, aheadRate: 0.3 },
        goldAt10: { diff: -260, aheadRate: 0.33 },
      },
    });
    renderShell();
    expect(
      screen.getByText(/Your lane opponent out-farms you by 12 CS at 10 min/)
    ).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setLanePhase({
      data: {
        sampleSize: 8,
        csAt10: { diff: 18, aheadRate: 0.6 },
        csAt15: { diff: 4, aheadRate: 0.5 },
        goldAt10: { diff: 300, aheadRate: 0.6 },
      },
    });
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const { container } = renderShell();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
