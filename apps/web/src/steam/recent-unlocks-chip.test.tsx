import { render, screen } from "@testing-library/react";
import type { SteamRecentUnlock, SteamRecentUnlocks } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RecentUnlocksChip } from "./recent-unlocks-chip";
import { useRecentUnlocks } from "./use-recent-unlocks";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-recent-unlocks", () => ({
  useRecentUnlocks: vi.fn(),
}));

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
    hidden: false,
    unlockedAt: "2026-05-19T11:00:00Z",
    globalPercent: 25,
    ...overrides,
  };
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <RecentUnlocksChip />
    </MotionConfig>
  );
}

// Anchor "now" so relativeTimeSince renders deterministic copy.
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

describe("RecentUnlocksChip", () => {
  it("renders a loading verdict while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading recent unlocks…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Recent unlocks are unavailable right now.")).toBeTruthy();
  });

  it("renders an empty verdict when the unlocks array is empty", () => {
    mockHook({
      data: { unlocks: [] },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("No achievements unlocked yet.")).toBeTruthy();
  });

  it("renders the latest game in the verdict and lists every unlock", () => {
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
          makeUnlock({
            apiName: "ACH_2",
            displayName: "Second Wind",
            gameName: "Hades",
            appid: 1145360,
            unlockedAt: "2026-05-18T12:00:00Z",
          }),
        ],
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Last progressed in Celeste.")).toBeTruthy();
    expect(screen.getByText("First Ascent")).toBeTruthy();
    expect(screen.getByText("Second Wind")).toBeTruthy();
  });
});
