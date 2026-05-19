import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { ThisPatchBadge } from "./this-patch-badge";

function match(idx: number, playedAt: string, gameVersion: string): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt,
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion,
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function renderBadge(matches: MatchSummary[], label?: string) {
  return render(
    <TooltipPrimitive.Provider>
      <ThisPatchBadge matches={matches} {...(label && { label })} />
    </TooltipPrimitive.Provider>
  );
}

describe("ThisPatchBadge", () => {
  it("renders nothing when no match carries a gameVersion", () => {
    const { container } = renderBadge([
      match(0, "2026-05-10T00:00:00Z", ""),
      match(1, "2026-05-11T00:00:00Z", ""),
    ]);
    expect(container.firstChild).toBeNull();
  });

  it("renders the truncated patch from the most recently played match", () => {
    renderBadge([
      match(0, "2026-05-01T00:00:00Z", "16.7.1.1"),
      match(1, "2026-05-15T00:00:00Z", "16.9.1.1"),
      match(2, "2026-05-05T00:00:00Z", "16.8.1.1"),
    ]);
    expect(screen.getByText(/Patch 26\.9/)).toBeTruthy();
  });

  it("honours a custom label", () => {
    renderBadge([match(0, "2026-05-15T00:00:00Z", "16.9.1.1")], "Last played");
    expect(screen.getByText(/Last played 26\.9/)).toBeTruthy();
  });

  it("skips empty gameVersion entries when picking the latest", () => {
    renderBadge([
      match(0, "2026-05-01T00:00:00Z", "16.8.1.1"),
      match(1, "2026-05-20T00:00:00Z", ""),
    ]);
    expect(screen.getByText(/Patch 26\.8/)).toBeTruthy();
  });
});
