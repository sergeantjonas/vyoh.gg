import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ParticipantDetail, ParticipantOwnerExtras } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { MatchRunePage } from "./match-rune-page";

vi.mock("@/lol/_shared/analytics/use-perks", () => ({
  usePerks: vi.fn(),
}));

import { type PerkInfo, usePerks } from "@/lol/_shared/analytics/use-perks";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function perk(name: string, path: string): PerkInfo {
  return { iconUrl: `/img/${name}.webp`, name, description: "", path };
}

const PERKS = new Map<number, PerkInfo>([
  [8112, perk("Electrocute", "Domination")],
  [8143, perk("Sudden Impact", "Domination")],
  [8138, perk("Eyeball Collection", "Domination")],
  [8135, perk("Treasure Hunter", "Domination")],
  [9105, perk("Legend: Haste", "Precision")],
  [8014, perk("Coup de Grace", "Precision")],
  [5008, perk("Adaptive Force", "Stat Shard")],
  [5011, perk("Health", "Stat Shard")],
]);

const RUNES: NonNullable<ParticipantOwnerExtras["runes"]> = {
  primary: { style: 8100, perks: [8112, 8143, 8138, 8135] },
  secondary: { style: 8000, perks: [9105, 8014] },
  shards: { offense: 5008, flex: 5008, defense: 5011 },
};

function participant(
  puuid: string,
  runes?: ParticipantOwnerExtras["runes"]
): ParticipantDetail {
  const owner = runes ? { runes } : undefined;
  return { puuid, championName: "Ahri", owner } as unknown as ParticipantDetail;
}

function renderPage(props: { myPuuid?: string; participants: ParticipantDetail[] }) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchRunePage
          detail={{ participants: props.participants }}
          {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
        />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("MatchRunePage", () => {
  it("renders nothing when the owner row carries no rune page", () => {
    vi.mocked(usePerks).mockReturnValue(PERKS);
    const { container } = renderPage({
      myPuuid: "me",
      participants: [participant("me")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for a viewer whose puuid is not the owner", () => {
    vi.mocked(usePerks).mockReturnValue(PERKS);
    const { container } = renderPage({
      myPuuid: "other",
      participants: [participant("me", RUNES), participant("other")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders both trees named after their perks, plus the three shard slots", () => {
    vi.mocked(usePerks).mockReturnValue(PERKS);
    renderPage({ myPuuid: "me", participants: [participant("me", RUNES)] });

    const primary = screen.getByRole("list", { name: "Domination runes" });
    const primaryImgs = primary.querySelectorAll("img");
    expect(primaryImgs).toHaveLength(4);
    expect(primaryImgs[0]?.getAttribute("alt")).toBe("Electrocute");
    expect(primaryImgs[0]?.classList.contains("size-10")).toBe(true);
    expect(primaryImgs[1]?.classList.contains("size-10")).toBe(false);

    const secondary = screen.getByRole("list", { name: "Precision runes" });
    expect(secondary.querySelectorAll("img")).toHaveLength(2);

    const shards = screen.getByRole("list", { name: "Stat shards" });
    expect(shards.querySelectorAll("img")).toHaveLength(3);
    expect(screen.getByText("Offense")).toBeTruthy();
    expect(screen.getByText("Flex")).toBeTruthy();
    expect(screen.getByText("Defense")).toBeTruthy();
  });

  it("falls back to positional tree labels while perks are loading", () => {
    vi.mocked(usePerks).mockReturnValue(undefined);
    renderPage({ myPuuid: "me", participants: [participant("me", RUNES)] });
    expect(screen.getByRole("list", { name: "Primary runes" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Secondary runes" })).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("has no axe violations", async () => {
    vi.mocked(usePerks).mockReturnValue(PERKS);
    const { container } = renderPage({
      myPuuid: "me",
      participants: [participant("me", RUNES)],
    });
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
