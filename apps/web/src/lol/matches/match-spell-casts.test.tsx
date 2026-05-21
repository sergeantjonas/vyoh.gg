import { useSummonerSpells } from "@/lol/_shared/analytics/use-summoner-spells";
import { useChampionSpells } from "@/lol/matches/use-champion-spells";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render } from "@testing-library/react";
import type { ParticipantDetail, ParticipantOwnerExtras } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchSpellCasts } from "./match-spell-casts";

vi.mock("@/lol/matches/use-champion-spells", () => ({
  useChampionSpells: vi.fn(),
}));

vi.mock("@/lol/_shared/analytics/use-summoner-spells", () => ({
  useSummonerSpells: vi.fn(),
}));

function ownerExtras(
  overrides: Partial<ParticipantOwnerExtras["spellCasts"]> = {}
): ParticipantOwnerExtras {
  return {
    spellCasts: {
      q: 12,
      w: 7,
      e: 5,
      r: 2,
      summoner1: 3,
      summoner2: 1,
      ...overrides,
    },
    multikills: {
      double: 0,
      triple: 0,
      quadra: 0,
      penta: 0,
      killingSprees: 0,
      largestKillingSpree: 0,
    },
    survival: {
      totalDamageTaken: 0,
      damageSelfMitigated: 0,
      totalHeal: 0,
      totalTimeCCDealt: 0,
      totalTimeSpentDead: 0,
      longestTimeSpentLiving: 0,
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
    summoner1Id: 4,
    summoner2Id: 14,
    ...overrides,
  } as unknown as ParticipantDetail;
}

function renderStrip(props: {
  myPuuid?: string;
  participants?: ParticipantDetail[];
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchSpellCasts
          detail={{ participants: props.participants ?? [participant("me")] }}
          {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
        />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useChampionSpells).mockReset();
  vi.mocked(useSummonerSpells).mockReset();
});

describe("MatchSpellCasts", () => {
  it("renders nothing when myPuuid is missing", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderStrip({});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the owner participant has no owner extras", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderStrip({
      myPuuid: "me",
      participants: [participant("me")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the participant matching myPuuid is absent", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderStrip({
      myPuuid: "ghost",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the cast counts in Q/W/E/R + summoner order", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderStrip({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    const counts = Array.from(
      container.querySelectorAll("span.font-mono.tabular-nums")
    ).map((el) => el.textContent);
    expect(counts).toEqual(["12", "7", "5", "2", "3", "1"]);
  });

  it("falls back to the slot letter when champion spell icons are unavailable", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderStrip({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    const fallbacks = Array.from(
      container.querySelectorAll("span.font-mono.text-sm")
    ).map((el) => el.textContent);
    expect(fallbacks).toEqual(["Q", "W", "E", "R"]);
  });

  it("renders the ability icon when spell info is available", () => {
    vi.mocked(useChampionSpells).mockReturnValue([
      {
        championId: 103,
        slot: "Q",
        abilityIndex: 1,
        iconUrl: "/img/lol/ability/103/Q/1?v=test",
        name: "Orb of Deception",
      },
      {
        championId: 103,
        slot: "W",
        abilityIndex: 2,
        iconUrl: "/img/lol/ability/103/W/2?v=test",
        name: "Fox-Fire",
      },
      {
        championId: 103,
        slot: "E",
        abilityIndex: 3,
        iconUrl: "/img/lol/ability/103/E/3?v=test",
        name: "Charm",
      },
      {
        championId: 103,
        slot: "R",
        abilityIndex: 4,
        iconUrl: "/img/lol/ability/103/R/4?v=test",
        name: "Spirit Rush",
      },
    ]);
    const { container } = renderStrip({
      myPuuid: "me",
      participants: [participant("me", { owner: ownerExtras() })],
    });
    const images = Array.from(container.querySelectorAll("img"));
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "/img/lol/ability/103/Q/1?v=test",
      "/img/lol/ability/103/W/2?v=test",
      "/img/lol/ability/103/E/3?v=test",
      "/img/lol/ability/103/R/4?v=test",
    ]);
  });

  it("renders the summoner-spell icons when spell data is available", () => {
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    vi.mocked(useSummonerSpells).mockReturnValue(
      new Map([
        [4, { iconUrl: "/img/lol/spell/4/test.webp", name: "Flash", description: "" }],
        [
          12,
          { iconUrl: "/img/lol/spell/12/test.webp", name: "Teleport", description: "" },
        ],
      ])
    );
    const { container } = renderStrip({
      myPuuid: "me",
      participants: [
        participant("me", {
          owner: ownerExtras(),
          summoner1Id: 4,
          summoner2Id: 12,
        }),
      ],
    });
    const imgs = Array.from(container.querySelectorAll("img")).filter((img) =>
      img.getAttribute("src")?.includes("/img/lol/spell/")
    );
    expect(imgs).toHaveLength(2);
    expect(imgs[0]?.getAttribute("alt")).toBe("Flash");
    expect(imgs[1]?.getAttribute("alt")).toBe("Teleport");
  });
});
