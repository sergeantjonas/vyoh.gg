import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useDamageProfile } from "@/lol/_shared/use-damage-profile";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { DamageProfile, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DamageProfileRadar } from "./damage-profile-radar";

// Recharts needs a sized container that happy-dom can't provide; the radar shape
// isn't under test here (the verdict + share legend are), so stub the chart.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  RadarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
}));

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/_shared/use-damage-profile", () => ({
  useDamageProfile: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setData(opts: { data?: DamageProfile | undefined; isPending?: boolean }) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useDamageProfile).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useDamageProfile>);
}

function renderShell() {
  return render(
    <TooltipPrimitive.Provider>
      <DamageProfileRadar accountSlug="jonas-euw" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useDamageProfile).mockReset();
});

describe("DamageProfileRadar", () => {
  it("renders null while pending", () => {
    setData({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders an empty state below the MIN_GAMES floor", () => {
    setData({
      data: {
        sampleSize: 3,
        damageShare: 0.3,
        damageTakenShare: 0.2,
        visionShare: 0.2,
        csShare: 0.3,
      },
    });
    renderShell();
    expect(screen.getByText(/Need 5\+ games to map your share/)).toBeTruthy();
  });

  it("headlines the top axis and lists each share percentage", () => {
    setData({
      data: {
        sampleSize: 18,
        damageShare: 0.4, // highest → drives the verdict
        damageTakenShare: 0.15,
        visionShare: 0.1,
        csShare: 0.25,
      },
    });
    renderShell();
    expect(
      screen.getByText(
        /Across 18 games you account for 40% of your team's damage to champions — an even split would be 20%\./
      )
    ).toBeTruthy();
    // Share legend reads each axis's absolute percentage.
    expect(screen.getByText("15%")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("Tanked")).toBeTruthy();
    expect(screen.getByText("Vision")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setData({
      data: {
        sampleSize: 18,
        damageShare: 0.4,
        damageTakenShare: 0.15,
        visionShare: 0.1,
        csShare: 0.25,
      },
    });
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const { container } = renderShell();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
