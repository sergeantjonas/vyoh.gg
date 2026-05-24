import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AchievementCardInner, rareTier } from "./achievement-card";

function renderWithProvider(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

describe("rareTier", () => {
  it("flags unlocked sub-1% rows as very rare", () => {
    expect(rareTier(0.4, true)).toEqual({ isVeryRare: true, isRare: false });
  });

  it("flags unlocked sub-5% (but >=1%) rows as rare", () => {
    expect(rareTier(3, true)).toEqual({ isVeryRare: false, isRare: true });
  });

  it("does not flag rows at exactly 5%", () => {
    expect(rareTier(5, true)).toEqual({ isVeryRare: false, isRare: false });
  });

  it("does not flag rows at exactly 1% as very rare", () => {
    expect(rareTier(1, true)).toEqual({ isVeryRare: false, isRare: true });
  });

  it("never flags locked rows even when sub-1%", () => {
    expect(rareTier(0.4, false)).toEqual({ isVeryRare: false, isRare: false });
  });

  it("never flags rows with null globalPercent", () => {
    expect(rareTier(null, true)).toEqual({ isVeryRare: false, isRare: false });
  });
});

describe("AchievementCardInner", () => {
  const base = {
    appid: 440,
    apiName: "ACH_1",
    displayName: "First Blood",
    description: "Get the first kill of the round.",
    globalPercent: 50,
    unlocked: true,
  };

  it("renders the display name and description", () => {
    renderWithProvider(<AchievementCardInner {...base} />);
    expect(screen.getByText("First Blood")).toBeTruthy();
    expect(screen.getByText("Get the first kill of the round.")).toBeTruthy();
  });

  it("renders a bare percentage with no qualifier prefix for 5%+ rows", () => {
    renderWithProvider(<AchievementCardInner {...base} globalPercent={50} />);
    expect(screen.getByText("50.0%")).toBeTruthy();
    expect(screen.queryByText(/Rare ·/)).toBeNull();
    expect(screen.queryByText(/Very rare ·/)).toBeNull();
  });

  it("prefixes sub-5% unlocked rows with 'Rare · '", () => {
    renderWithProvider(<AchievementCardInner {...base} globalPercent={3} />);
    expect(screen.getByText("Rare · 3.0%")).toBeTruthy();
  });

  it("prefixes sub-1% unlocked rows with 'Very rare · ' and a star marker", () => {
    const { container } = renderWithProvider(
      <AchievementCardInner {...base} globalPercent={0.4} />
    );
    expect(screen.getByText("Very rare · 0.4%")).toBeTruthy();
    expect(container.textContent).toContain("★");
  });

  it("omits the rarity badge entirely when globalPercent is null", () => {
    renderWithProvider(<AchievementCardInner {...base} globalPercent={null} />);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders '???' and the reveal hint when masked", () => {
    renderWithProvider(
      <AchievementCardInner
        {...base}
        unlocked={false}
        masked
        description="Spoiler-y description."
      />
    );
    expect(screen.getByText("???")).toBeTruthy();
    expect(screen.getByText("Hidden — click to reveal name")).toBeTruthy();
    // The real description must not leak through when masked.
    expect(screen.queryByText("Spoiler-y description.")).toBeNull();
  });

  it("does not render a description paragraph when description is empty and not masked", () => {
    const { container } = renderWithProvider(
      <AchievementCardInner {...base} description="" />
    );
    // Only the name paragraph should be present (no description, no metaLine).
    expect(container.querySelectorAll("p").length).toBe(1);
  });

  it("renders the optional metaLine below the description", () => {
    renderWithProvider(
      <AchievementCardInner {...base} metaLine="Unlocked May 15, 2026" />
    );
    expect(screen.getByText("Unlocked May 15, 2026")).toBeTruthy();
  });

  it("uses the locked icon variant and muted name colour for locked rows", () => {
    const { container } = renderWithProvider(
      <AchievementCardInner {...base} unlocked={false} />
    );
    const img = container.querySelector("img");
    // Locked icon URL ends with `_gray` per steamAchievementIconUrl.
    expect(img?.getAttribute("src")).toContain("gray");
    expect(img?.className).toContain("opacity-70");
    const name = screen.getByText("First Blood");
    expect(name.className).toContain("text-muted-foreground");
  });

  it("applies amber name styling to unlocked very-rare rows", () => {
    renderWithProvider(<AchievementCardInner {...base} globalPercent={0.4} />);
    const name = screen.getByText((_, el) => el?.textContent === "★First Blood");
    expect(name.className).toContain("text-amber-300");
  });
});
