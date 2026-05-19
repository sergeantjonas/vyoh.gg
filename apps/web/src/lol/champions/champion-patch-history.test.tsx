import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ChampionPatchHistory } from "./champion-patch-history";

function match(gameVersion: string, win: boolean): MatchSummary {
  return {
    matchId: `${gameVersion}-${Math.random()}`,
    gameVersion,
    win,
    remake: false,
  } as unknown as MatchSummary;
}

function renderWith(ui: ReactNode) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("ChampionPatchHistory", () => {
  it("renders nothing when no matches are present", () => {
    const { container } = renderWith(
      <ChampionPatchHistory matches={[]} championAlias="Ahri" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one tile per patch with W-L counts and a winRate label", () => {
    renderWith(
      <ChampionPatchHistory
        matches={[
          match("14.20.586.5840", true),
          match("14.20.586.5840", false),
          match("14.21.586.5840", true),
        ]}
        championAlias="Ahri"
      />
    );
    // Patch labels come from groupByPatch (major.minor).
    expect(screen.getAllByText(/24\./).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/^\d+%$/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/W \d+L/).length).toBeGreaterThanOrEqual(2);
  });

  it("renders a single-patch verdict when only one patch is present", () => {
    renderWith(
      <ChampionPatchHistory
        matches={[match("14.20.586.5840", true), match("14.20.586.5840", false)]}
        championAlias="Ahri"
      />
    );
    expect(screen.getByText(/This patch \(24\.20\):/)).toBeTruthy();
    expect(screen.getByText(/over 2 games/)).toBeTruthy();
  });

  it("renders a delta-from-previous-patch verdict when ≥2 patches are present", () => {
    renderWith(
      <ChampionPatchHistory
        matches={[
          match("14.20.586.5840", true),
          match("14.20.586.5840", false),
          match("14.21.586.5840", true),
          match("14.21.586.5840", true),
        ]}
        championAlias="Ahri"
      />
    );
    // current = 14.21 (100% WR), prev = 14.20 (50% WR) → +50% from 14.20
    expect(screen.getByText(/\+50% from 24\.20/)).toBeTruthy();
  });

  it("filters out remakes before computing patch stats", () => {
    renderWith(
      <ChampionPatchHistory
        matches={[
          { ...match("14.20.586.5840", true), remake: true } as MatchSummary,
          match("14.20.586.5840", false),
        ]}
        championAlias="Ahri"
      />
    );
    // remake is excluded, so the only counted game is the loss → 0%
    expect(screen.getByText(/This patch \(24\.20\): 0-1/)).toBeTruthy();
  });
});
