import { render, screen } from "@testing-library/react";
import type { ParticipantDetail, ParticipantOwnerExtras } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { MatchDamageProfile } from "./match-damage-profile";

function ownerExtras(
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
    },
    survival: {
      totalDamageTaken: 14500,
      damageSelfMitigated: 8200,
      totalHeal: 0,
      totalTimeCCDealt: 0,
      totalTimeSpentDead: 0,
      longestTimeSpentLiving: 0,
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
    damageDealtPhysical: 5000,
    damageDealtMagic: 15000,
    damageDealtTrue: 500,
    ...overrides,
  } as unknown as ParticipantDetail;
}

function renderProfile(props: {
  myPuuid?: string;
  participants?: ParticipantDetail[];
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchDamageProfile
        detail={{ participants: props.participants ?? [participant("me")] }}
        {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
      />
    </MotionConfig>
  );
}

describe("MatchDamageProfile", () => {
  it("renders nothing when myPuuid is missing", () => {
    const { container } = renderProfile({});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the owner participant has no owner extras", () => {
    const { container } = renderProfile({
      myPuuid: "me",
      participants: [participant("me")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the participant matching myPuuid is absent", () => {
    const { container } = renderProfile({
      myPuuid: "ghost",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the section heading", () => {
    renderProfile({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(screen.getByText("Damage profile")).toBeTruthy();
  });

  it("renders Dealt, Taken, and Mitigated row labels", () => {
    renderProfile({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(screen.getByText("Dealt")).toBeTruthy();
    expect(screen.getByText("Taken")).toBeTruthy();
    expect(screen.getByText("Mitigated")).toBeTruthy();
  });

  it("formats dealt total and dominant type annotation correctly", () => {
    renderProfile({
      myPuuid: "me",
      participants: [
        participant("me", {
          damageDealtPhysical: 5000,
          damageDealtMagic: 15000,
          damageDealtTrue: 500,
          owner: ownerExtras(),
        }),
      ],
    });
    // total = 20500 → "20.5k"; magic dominant = 15000/20500 ≈ 73%
    expect(screen.getByText("20.5k")).toBeTruthy();
    expect(screen.getByText("(73% magic)")).toBeTruthy();
  });

  it("formats taken and mitigated values as K", () => {
    renderProfile({
      myPuuid: "me",
      participants: [
        participant("me", {
          owner: ownerExtras({
            totalDamageTaken: 14500,
            damageSelfMitigated: 8200,
          }),
        }),
      ],
    });
    expect(screen.getByText("14.5k")).toBeTruthy();
    expect(screen.getByText("8.2k")).toBeTruthy();
  });
});
