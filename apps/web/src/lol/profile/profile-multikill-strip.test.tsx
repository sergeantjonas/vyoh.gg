import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useNarrativeLifetime } from "@/lol/profile/use-narrative-lifetime";
import { render, screen } from "@testing-library/react";
import type { LolAccount, MatchNarrativeLifetime } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileMultikillStrip } from "./profile-multikill-strip";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-narrative-lifetime", () => ({
  useNarrativeLifetime: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function mockLifetime(value: {
  data: MatchNarrativeLifetime | undefined;
  isPending: boolean;
}): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useNarrativeLifetime).mockReturnValue(
    value as unknown as ReturnType<typeof useNarrativeLifetime>
  );
}

function renderStrip() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileMultikillStrip accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useNarrativeLifetime).mockReset();
});

describe("ProfileMultikillStrip", () => {
  it("renders nothing while the lifetime query is pending", () => {
    mockLifetime({ data: undefined, isPending: true });
    const { container } = renderStrip();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the player has no multikills (the strip would be all zeros)", () => {
    mockLifetime({
      data: {
        matchCount: 50,
        multikills: {
          pentaKills: 0,
          quadraKills: 0,
          tripleKills: 0,
          doubleKills: 0,
          largestKillingSpree: 7,
        },
      },
      isPending: false,
    });
    const { container } = renderStrip();
    expect(container.firstChild).toBeNull();
  });

  it("renders the five-cell strip with the labels and counts", () => {
    mockLifetime({
      data: {
        matchCount: 500,
        multikills: {
          pentaKills: 2,
          quadraKills: 14,
          tripleKills: 58,
          doubleKills: 312,
          largestKillingSpree: 11,
        },
      },
      isPending: false,
    });
    renderStrip();
    expect(screen.getByText("Pentas")).toBeTruthy();
    expect(screen.getByText("Quadras")).toBeTruthy();
    expect(screen.getByText("Triples")).toBeTruthy();
    expect(screen.getByText("Doubles")).toBeTruthy();
    expect(screen.getByText("Best Spree")).toBeTruthy();
    // CountUp animates from 0; with reduced motion it lands on the target.
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("58")).toBeTruthy();
    expect(screen.getByText("312")).toBeTruthy();
    expect(screen.getByText("11")).toBeTruthy();
  });

  it("passes an axe scan when rendering the populated strip", async () => {
    mockLifetime({
      data: {
        matchCount: 100,
        multikills: {
          pentaKills: 1,
          quadraKills: 4,
          tripleKills: 12,
          doubleKills: 88,
          largestKillingSpree: 9,
        },
      },
      isPending: false,
    });
    const { container } = renderStrip();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
