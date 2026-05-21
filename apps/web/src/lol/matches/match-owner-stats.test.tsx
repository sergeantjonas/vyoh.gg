import { render, screen } from "@testing-library/react";
import type { ParticipantDetail, ParticipantOwnerExtras } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { MatchOwnerStats } from "./match-owner-stats";

function ownerExtras(
  multikillOverrides: Partial<ParticipantOwnerExtras["multikills"]> = {},
  survivalOverrides: Partial<ParticipantOwnerExtras["survival"]> = {}
): ParticipantOwnerExtras {
  return {
    spellCasts: { q: 0, w: 0, e: 0, r: 0, summoner1: 0, summoner2: 0 },
    multikills: {
      double: 0,
      triple: 0,
      quadra: 0,
      penta: 0,
      killingSprees: 0,
      largestKillingSpree: 0,
      ...multikillOverrides,
    },
    survival: {
      totalDamageTaken: 0,
      damageSelfMitigated: 0,
      totalHeal: 0,
      totalTimeCCDealt: 45,
      totalTimeSpentDead: 260,
      longestTimeSpentLiving: 900,
      ...survivalOverrides,
    },
    challenges: {},
  };
}

function participant(
  puuid: string,
  overrides: Partial<ParticipantDetail> = {}
): ParticipantDetail {
  return {
    puuid,
    championName: "Ahri",
    damageDealtPhysical: 0,
    damageDealtMagic: 0,
    damageDealtTrue: 0,
    ...overrides,
  } as unknown as ParticipantDetail;
}

function renderStats(props: { myPuuid?: string; participants?: ParticipantDetail[] }) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchOwnerStats
        detail={{ participants: props.participants ?? [participant("me")] }}
        {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
      />
    </MotionConfig>
  );
}

describe("MatchOwnerStats", () => {
  it("renders nothing when myPuuid is missing", () => {
    const { container } = renderStats({});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when participant has no owner extras", () => {
    const { container } = renderStats({
      myPuuid: "me",
      participants: [participant("me")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when participant matching myPuuid is absent", () => {
    const { container } = renderStats({
      myPuuid: "ghost",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the section heading", () => {
    renderStats({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(screen.getByText("Stats")).toBeTruthy();
  });

  it("renders CC dealt, Time dead, and Longest alive row labels", () => {
    renderStats({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(screen.getByText("CC dealt")).toBeTruthy();
    expect(screen.getByText("Time dead")).toBeTruthy();
    expect(screen.getByText("Longest alive")).toBeTruthy();
  });

  it("formats values under 60s as Xs", () => {
    renderStats({
      myPuuid: "me",
      participants: [
        participant("me", {
          owner: ownerExtras(
            {},
            { totalTimeCCDealt: 45, totalTimeSpentDead: 0, longestTimeSpentLiving: 0 }
          ),
        }),
      ],
    });
    expect(screen.getByText("45s")).toBeTruthy();
  });

  it("formats values >= 60s as mm:ss", () => {
    renderStats({
      myPuuid: "me",
      participants: [
        participant("me", {
          owner: ownerExtras(
            {},
            { totalTimeCCDealt: 0, totalTimeSpentDead: 260, longestTimeSpentLiving: 900 }
          ),
        }),
      ],
    });
    // 260s = 4:20, 900s = 15:00
    expect(screen.getByText("4:20")).toBeTruthy();
    expect(screen.getByText("15:00")).toBeTruthy();
  });

  it("renders multikill badges when non-zero", () => {
    renderStats({
      myPuuid: "me",
      participants: [
        participant("me", {
          owner: ownerExtras({ double: 3, triple: 1, quadra: 0, penta: 1 }),
        }),
      ],
    });
    expect(screen.getByText(/3× Double/i)).toBeTruthy();
    expect(screen.getByText(/1× Triple/i)).toBeTruthy();
    expect(screen.queryByText(/Quadra/i)).toBeNull();
    expect(screen.getByText(/1× Penta/i)).toBeTruthy();
  });

  it("omits multikill strip when all zero", () => {
    renderStats({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(screen.queryByText(/Double/i)).toBeNull();
    expect(screen.queryByText(/Triple/i)).toBeNull();
    expect(screen.queryByText(/Quadra/i)).toBeNull();
    expect(screen.queryByText(/Penta/i)).toBeNull();
  });
});
