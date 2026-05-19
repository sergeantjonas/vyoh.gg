import { render, screen } from "@testing-library/react";
import type { ChampionPatchChangeGroup } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { AbilityChangeList, groupBySlot } from "./ability-change-list";

type Change = ChampionPatchChangeGroup["changes"][number];

function line(overrides: Partial<Change> = {}): Change {
  return {
    ability: null,
    slot: null,
    iconPath: null,
    changeType: "buff",
    changeText: "Damage increased",
    ...overrides,
  } as Change;
}

describe("groupBySlot", () => {
  it("returns one __base__ group when every change has no slot/ability or ability='Base'", () => {
    const groups = groupBySlot([
      line({ ability: "Base", changeText: "HP up" }),
      line({ ability: null, slot: null, changeText: "Movement up" }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]?.key).toBe("__base__");
    expect(groups[0]?.changes.length).toBe(2);
  });

  it("buckets changes by slot when slot is set", () => {
    const groups = groupBySlot([
      line({ slot: "Q", ability: "Orb of Deception", changeText: "Damage up" }),
      line({ slot: "Q", ability: "Orb of Deception", changeText: "Cost down" }),
      line({ slot: "W", ability: "Fox-Fire", changeText: "Cooldown down" }),
    ]);
    expect(groups.length).toBe(2);
    const q = groups.find((g) => g.key === "Q");
    expect(q?.changes.length).toBe(2);
    expect(q?.abilityNames).toEqual(["Orb of Deception"]);
  });

  it("falls back to ability name as key when slot is null", () => {
    const groups = groupBySlot([
      line({ slot: null, ability: "Passive", changeText: "Heal up" }),
      line({ slot: null, ability: "Passive", changeText: "Range up" }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]?.key).toBe("Passive");
  });

  it("deduplicates abilityNames within a group", () => {
    const groups = groupBySlot([
      line({ slot: "R", ability: "Ult", changeText: "A" }),
      line({ slot: "R", ability: "Ult", changeText: "B" }),
    ]);
    expect(groups[0]?.abilityNames).toEqual(["Ult"]);
  });
});

describe("AbilityChangeList", () => {
  it("renders each change line with its glyph and text", () => {
    render(
      <AbilityChangeList
        changes={[
          line({ changeType: "buff", changeText: "Damage increased" }),
          line({ changeType: "nerf", changeText: "Cost increased" }),
        ]}
      />
    );
    expect(screen.getByText("Damage increased")).toBeTruthy();
    expect(screen.getByText("Cost increased")).toBeTruthy();
    expect(screen.getByText("↑")).toBeTruthy();
    expect(screen.getByText("↓")).toBeTruthy();
  });

  it("renders an ability label and slot chip for non-base groups", () => {
    render(
      <AbilityChangeList
        changes={[
          line({
            slot: "Q",
            ability: "Orb of Deception",
            iconPath: "/q.png",
            changeText: "Damage up",
          }),
        ]}
      />
    );
    expect(screen.getByText("Q")).toBeTruthy();
    expect(screen.getByText("Orb of Deception")).toBeTruthy();
  });
});
