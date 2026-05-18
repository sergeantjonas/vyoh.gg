import { describe, expect, it } from "vitest";
import { shouldFlipChampion } from "./champion-direction";

describe("shouldFlipChampion", () => {
  it("returns false for champions whose centered splash naturally faces right", () => {
    // Sample a few from the FACING_RIGHT set — must stay false so the match
    // card doesn't double-flip them away from the stats column.
    expect(shouldFlipChampion("Akshan")).toBe(false);
    expect(shouldFlipChampion("Darius")).toBe(false);
    expect(shouldFlipChampion("MissFortune")).toBe(false);
    expect(shouldFlipChampion("XinZhao")).toBe(false);
  });

  it("returns true for champions not in the right-facing set (default flip)", () => {
    expect(shouldFlipChampion("Ahri")).toBe(true);
    expect(shouldFlipChampion("Yasuo")).toBe(true);
    expect(shouldFlipChampion("Garen")).toBe(true);
  });

  it("normalizes the Swarm-mode 'Strawberry_' alias prefix before lookup", () => {
    // Strawberry_Akshan should resolve to Akshan and stay non-flipped.
    expect(shouldFlipChampion("Strawberry_Akshan")).toBe(false);
    expect(shouldFlipChampion("Strawberry_Ahri")).toBe(true);
  });
});
