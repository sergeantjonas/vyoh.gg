import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { buildPatchDrift } from "./patch-drift";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: overrides.queueType ?? "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: overrides.playedAt ?? "2026-05-19T12:00:00.000Z",
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: overrides.gameVersion ?? "16.9.1.1",
    visionScore: overrides.visionScore ?? 0,
    damageShare: overrides.damageShare ?? 0,
    firstBloodKill: overrides.firstBloodKill ?? false,
    csAt10: overrides.csAt10 ?? 0,
    csAt15: overrides.csAt15 ?? 0,
    goldAt10: overrides.goldAt10 ?? 0,
    goldAt15: overrides.goldAt15 ?? 0,
    teamGoldDiffAt15: overrides.teamGoldDiffAt15 ?? 0,
    deathTimings: overrides.deathTimings ?? [],
    deathXs: overrides.deathXs ?? [],
    deathYs: overrides.deathYs ?? [],
    killTimings: overrides.killTimings ?? [],
    killXs: overrides.killXs ?? [],
    killYs: overrides.killYs ?? [],
    laneOpponent: overrides.laneOpponent ?? null,
    ...overrides,
  };
}

function patch(version: string, champion: string, count: number): MatchSummary[] {
  return Array.from({ length: count }, (_, i) =>
    buildMatch({ matchId: `${version}-${champion}-${i}`, gameVersion: version, champion })
  );
}

describe("buildPatchDrift", () => {
  it("returns null when fewer than 2 distinct patches are present", () => {
    expect(buildPatchDrift(patch("16.8.1.1", "Ahri", 5), "Ahri")).toBeNull();
    expect(buildPatchDrift([], "Ahri")).toBeNull();
  });

  it("returns null when either patch has fewer than 5 total games (MIN_PATCH_GAMES)", () => {
    const matches = [...patch("16.8.1.1", "Ahri", 3), ...patch("16.9.1.1", "Ahri", 5)];
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });

  it("returns null when the champion hasn't been played in the current patch", () => {
    const matches = [...patch("16.8.1.1", "Ahri", 5), ...patch("16.9.1.1", "Yasuo", 5)];
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });

  it("returns null when the previous-patch sample is too thin (< 2 champ games)", () => {
    const matches = [
      // Ahri: only 1 game in previous patch → MIN_PREVIOUS_CHAMP_GAMES gate fires
      ...patch("16.8.1.1", "Ahri", 1),
      ...patch("16.8.1.1", "Yasuo", 4),
      ...patch("16.9.1.1", "Ahri", 5),
    ];
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });

  it("returns null when both relative and pp changes are too small to be noteworthy", () => {
    // Both patches: 5/10 Ahri → 0% relative change, 0pp change.
    const matches = [
      ...patch("16.8.1.1", "Ahri", 5),
      ...patch("16.8.1.1", "Yasuo", 5),
      ...patch("16.9.1.1", "Ahri", 5),
      ...patch("16.9.1.1", "Yasuo", 5),
    ];
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });

  it("returns null when relative change clears 20% but pp change is below 3pp", () => {
    // Previous: 2/10 = 20%. Current: 3/15 = 20%. → 0pp change, 0% relative. Adjust:
    // Previous: 2/10 = 20%. Current: 3/10 = 30% → 50% relative, 10pp — fires up.
    // To hit "relative ok but pp too small": previous 2/100 = 2%, current 3/100 = 3%
    // → 50% relative, 1pp.
    const matches = [
      ...patch("16.8.1.1", "Ahri", 2),
      ...patch("16.8.1.1", "Yasuo", 98),
      ...patch("16.9.1.1", "Ahri", 3),
      ...patch("16.9.1.1", "Yasuo", 97),
    ];
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });

  it("returns 'up' when the current-patch share is meaningfully higher", () => {
    // Previous: 2/10 = 20%, Current: 6/10 = 60%. Relative = 200%, pp = 40 — fires.
    const matches = [
      ...patch("16.8.1.1", "Ahri", 2),
      ...patch("16.8.1.1", "Yasuo", 8),
      ...patch("16.9.1.1", "Ahri", 6),
      ...patch("16.9.1.1", "Yasuo", 4),
    ];
    const drift = buildPatchDrift(matches, "Ahri");
    expect(drift).not.toBeNull();
    if (!drift) return;
    expect(drift.direction).toBe("up");
    expect(drift.currentPatch).toBe("26.9");
    expect(drift.previousPatch).toBe("26.8");
    expect(drift.currentChampGames).toBe(6);
    expect(drift.currentTotalGames).toBe(10);
    expect(drift.relativeChangePct).toBe(200);
  });

  it("returns 'down' when the current-patch share dropped", () => {
    // Previous: 6/10 = 60%, Current: 2/10 = 20%. Relative ~66.7%, pp = 40.
    const matches = [
      ...patch("16.8.1.1", "Ahri", 6),
      ...patch("16.8.1.1", "Yasuo", 4),
      ...patch("16.9.1.1", "Ahri", 2),
      ...patch("16.9.1.1", "Yasuo", 8),
    ];
    const drift = buildPatchDrift(matches, "Ahri");
    expect(drift?.direction).toBe("down");
  });

  it("excludes remakes from patch buckets", () => {
    const matches = [
      ...patch("16.8.1.1", "Yasuo", 5),
      ...patch("16.9.1.1", "Yasuo", 5),
      // A remake on Ahri in current patch shouldn't count toward currentChamp.
      buildMatch({
        matchId: "remake",
        champion: "Ahri",
        gameVersion: "16.9.1.1",
        remake: true,
      }),
    ];
    // Ahri has 0 real games either patch — should return null.
    expect(buildPatchDrift(matches, "Ahri")).toBeNull();
  });
});
