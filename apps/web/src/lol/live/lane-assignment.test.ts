import type { LiveGameParticipant } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { assignLanes, laneCostsFor, permutations } from "./lane-assignment";

const SMITE = 11;
const TELEPORT = 12;
const HEAL = 7;
const FLASH = 4;
const IGNITE = 14;

function participant(
  championId: number,
  spell1: number,
  spell2: number
): LiveGameParticipant {
  return {
    championId,
    spell1Id: spell1,
    spell2Id: spell2,
    summonerName: `P${championId}`,
    riotIdGameName: `P${championId}`,
    riotIdTagLine: "EUW",
    teamId: 100,
    summonerLevel: 30,
  } as unknown as LiveGameParticipant;
}

describe("permutations", () => {
  it("yields n! distinct orderings for n inputs", () => {
    const perms = Array.from(permutations(3));
    expect(perms).toHaveLength(6);
    const stringified = new Set(perms.map((p) => p.join(",")));
    expect(stringified.size).toBe(6);
  });

  it("yields the single empty permutation for n=0", () => {
    expect(Array.from(permutations(0))).toEqual([[]]);
  });
});

describe("laneCostsFor", () => {
  it("locks JUNGLE to 0 when the player carries Smite", () => {
    const costs = laneCostsFor(participant(64, SMITE, FLASH), ["fighter", "jungle"]);
    expect(costs.JUNGLE).toBe(0);
    // Non-jungle lanes all get a +5 penalty when Smite is present.
    expect(costs.TOP).toBeGreaterThan(0);
    expect(costs.MID).toBeGreaterThan(0);
  });

  it("penalises JUNGLE for a non-Smite player", () => {
    const costs = laneCostsFor(participant(157, FLASH, IGNITE), ["fighter", "assassin"]);
    expect(costs.JUNGLE).toBeGreaterThanOrEqual(5);
  });

  it("nudges BOTTOM down when Heal is present", () => {
    const costs = laneCostsFor(participant(22, HEAL, FLASH), ["marksman"]);
    expect(costs.BOTTOM).toBeLessThan(costs.MID);
  });

  it("nudges TOP down when Teleport is present", () => {
    const costs = laneCostsFor(participant(86, TELEPORT, FLASH), ["fighter"]);
    expect(costs.TOP).toBeLessThan(costs.JUNGLE);
  });
});

describe("assignLanes", () => {
  it("returns lane: null for any team that isn't exactly 5 players", () => {
    const four = [
      participant(1, FLASH, IGNITE),
      participant(2, FLASH, IGNITE),
      participant(3, FLASH, IGNITE),
      participant(4, FLASH, IGNITE),
    ];
    const out = assignLanes(four, {});
    expect(out).toHaveLength(4);
    expect(out.every((a) => a.lane === null)).toBe(true);
  });

  it("assigns each of the canonical lanes exactly once for a meta-comp team", () => {
    // Top tank (1) / jungle (2, Smite) / mid mage (3) / bot marksman (4, Heal) / sup (5).
    const team = [
      participant(1, FLASH, TELEPORT),
      participant(2, SMITE, FLASH),
      participant(3, FLASH, IGNITE),
      participant(4, FLASH, HEAL),
      participant(5, FLASH, IGNITE),
    ];
    const roles: Record<number, string[]> = {
      1: ["tank"],
      2: ["fighter"],
      3: ["mage"],
      4: ["marksman"],
      5: ["support"],
    };
    const out = assignLanes(team, roles);
    expect(out).toHaveLength(5);
    const lanes = out.map((a) => a.lane);
    expect(new Set(lanes).size).toBe(5);
    // Smite winner is always JUNGLE.
    expect(out.find((a) => a.participant.championId === 2)?.lane).toBe("JUNGLE");
    // Marksman + Heal lands on BOTTOM.
    expect(out.find((a) => a.participant.championId === 4)?.lane).toBe("BOTTOM");
  });

  it("sorts the result by canonical lane order (TOP → SUPPORT)", () => {
    const team = [
      participant(5, FLASH, IGNITE),
      participant(4, FLASH, HEAL),
      participant(3, FLASH, IGNITE),
      participant(2, SMITE, FLASH),
      participant(1, FLASH, TELEPORT),
    ];
    const out = assignLanes(team, {
      1: ["tank"],
      2: ["fighter"],
      3: ["mage"],
      4: ["marksman"],
      5: ["support"],
    });
    expect(out.map((a) => a.lane)).toEqual(["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"]);
  });

  it("flags participants as uncertain when a swap barely changes total cost", () => {
    // Two mages can swap MID/SUPPORT without large cost change → uncertain.
    const team = [
      participant(1, FLASH, TELEPORT),
      participant(2, SMITE, FLASH),
      participant(3, FLASH, IGNITE),
      participant(4, FLASH, HEAL),
      participant(5, FLASH, IGNITE),
    ];
    const out = assignLanes(team, {
      1: ["tank"],
      2: ["fighter"],
      // Both 3 and 5 are flagged as mage → assignment between MID and SUPPORT
      // becomes close enough to surface as uncertain.
      3: ["mage"],
      4: ["marksman"],
      5: ["mage"],
    });
    // We don't lock down which pair specifically gets flagged (the algorithm
    // is free to pick either ordering); we just assert at least one uncertain
    // pair surfaces for this near-tied configuration.
    expect(out.some((a) => a.uncertain)).toBe(true);
  });
});
