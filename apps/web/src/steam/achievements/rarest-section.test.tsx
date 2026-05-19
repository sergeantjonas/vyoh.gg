import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamRecentUnlock } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RarestSection } from "./rarest-section";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/steam/use-cross-game-rarest", () => ({
  useCrossGameRarest: vi.fn(),
}));

function unlock(overrides: Partial<SteamRecentUnlock> = {}): SteamRecentUnlock {
  return {
    appid: 440,
    gameName: "Team Fortress 2",
    apiName: "ACH_1",
    displayName: "First Blood",
    description: "",
    iconUrl: "",
    iconGrayUrl: "",
    unlockedAt: "2026-05-01T00:00:00Z",
    globalPercent: 12,
    ...overrides,
  } as SteamRecentUnlock;
}

function mockData(value: {
  data?: { unlocks: SteamRecentUnlock[] };
  isPending?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useCrossGameRarest).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useCrossGameRarest>);
}

function renderSection() {
  return render(
    <TooltipPrimitive.Provider>
      <RarestSection />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useCrossGameRarest).mockReset();
});

describe("RarestSection", () => {
  it("renders nothing while the query is pending", () => {
    mockData({ isPending: true });
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it("renders the inline error when the query fails", () => {
    mockData({ isError: true });
    renderSection();
    expect(screen.getByText("Rarest unlocks are unavailable right now.")).toBeTruthy();
  });

  it("renders nothing when there are zero unlocks (pre-poll state)", () => {
    mockData({ data: { unlocks: [] } });
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it("renders each unlock with its display name, game name, and rarity qualifier", () => {
    mockData({
      data: {
        unlocks: [
          unlock({
            apiName: "A1",
            displayName: "Sub-1% Achievement",
            globalPercent: 0.5,
          }),
          unlock({ apiName: "A2", displayName: "Rare Unlock", globalPercent: 3 }),
          unlock({ apiName: "A3", displayName: "Uncommon Unlock", globalPercent: 15 }),
          unlock({ apiName: "A4", displayName: "Common Unlock", globalPercent: 50 }),
        ],
      },
    });
    renderSection();
    expect(screen.getByText("Sub-1% Achievement")).toBeTruthy();
    expect(screen.getByText("Very rare")).toBeTruthy();
    expect(screen.getByText("Rare")).toBeTruthy();
    expect(screen.getByText("Uncommon")).toBeTruthy();
    expect(screen.getByText("Common")).toBeTruthy();
  });

  it("applies amber styling to rows with global percent under 5", () => {
    mockData({
      data: {
        unlocks: [
          unlock({ apiName: "A1", displayName: "Rare", globalPercent: 3 }),
          unlock({ apiName: "A2", displayName: "Common", globalPercent: 30 }),
        ],
      },
    });
    const { container } = renderSection();
    const links = container.querySelectorAll("a");
    expect(links[0]?.className).toContain("amber");
    expect(links[1]?.className).not.toContain("amber");
  });
});
