import { render, screen } from "@testing-library/react";
import type { SteamRecentUnlock, SteamRecentUnlocks } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LandingSteamBand } from "./landing-steam-band";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("@/steam/use-recent-unlocks", () => ({
  useRecentUnlocks: vi.fn(),
}));

import { useRecentUnlocks } from "@/steam/use-recent-unlocks";

type HookReturn = {
  data: SteamRecentUnlocks | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useRecentUnlocks).mockReturnValue(
    value as unknown as ReturnType<typeof useRecentUnlocks>
  );
}

function makeUnlock(overrides: Partial<SteamRecentUnlock> = {}): SteamRecentUnlock {
  return {
    appid: 440,
    gameName: "Team Fortress 2",
    apiName: "ACH_DEFAULT",
    displayName: "Default Achievement",
    description: "",
    hidden: false,
    unlockedAt: "2026-05-19T11:00:00Z",
    globalPercent: 25,
    ...overrides,
  };
}

const NOW_ISO = "2026-05-19T12:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.mocked(useRecentUnlocks).mockReset();
});

describe("LandingSteamBand", () => {
  it("renders a loading placeholder while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    const { container } = render(<LandingSteamBand />);
    expect(screen.getByText("Steam · latest unlock")).toBeTruthy();
    expect(container.querySelector("[aria-hidden]")).toBeTruthy();
  });

  it("renders a fallback placeholder on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    render(<LandingSteamBand />);
    expect(screen.getByText("Steam · latest unlock")).toBeTruthy();
  });

  it("renders an empty-state copy when no unlocks exist", () => {
    mockHook({
      data: { unlocks: [] },
      isPending: false,
      isError: false,
    });
    render(<LandingSteamBand />);
    expect(
      screen.getByText("A recent achievement will land here once one fires.")
    ).toBeTruthy();
  });

  it("renders the unlock headline, gameName, and a link into /steam/game/$appid", () => {
    mockHook({
      data: {
        unlocks: [
          makeUnlock({
            apiName: "ACH_1",
            displayName: "First Ascent",
            gameName: "Celeste",
            appid: 504230,
            unlockedAt: "2026-05-19T11:00:00Z",
          }),
        ],
      },
      isPending: false,
      isError: false,
    });
    const { container } = render(<LandingSteamBand />);
    expect(screen.getByText("First Ascent")).toBeTruthy();
    expect(screen.getByText(/Celeste/)).toBeTruthy();
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("to")).toBe("/steam/game/$appid");
  });
});
