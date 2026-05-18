import { render, screen } from "@testing-library/react";
import type { SteamPlatformMix } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformMixChip } from "./platform-mix-chip";
import { useSteamPlatformMix } from "./use-platform-mix";

vi.mock("./use-platform-mix", () => ({
  useSteamPlatformMix: vi.fn(),
}));

type HookReturn = {
  data: SteamPlatformMix | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamPlatformMix).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamPlatformMix>
  );
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <PlatformMixChip />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSteamPlatformMix).mockReset();
});

describe("PlatformMixChip", () => {
  it("renders the loading state while pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading platform mix…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Platform mix is unavailable right now.")).toBeTruthy();
  });

  it("renders the no-per-OS-data verdict when totalMinutes is 0", () => {
    mockHook({
      data: {
        totalMinutes: 0,
        windowsMinutes: 0,
        macMinutes: 0,
        linuxMinutes: 0,
        deckMinutes: 0,
        dominantPlatform: null,
        lastSyncedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("No per-OS playtime has been reported yet.")).toBeTruthy();
  });

  it("renders the dominant share and a secondary breakdown sorted by minutes", () => {
    // Windows 60%, Linux 25%, Deck 15%, Mac 0%. Dominant = Windows; rest sorted Linux → Deck; Mac dropped (0).
    mockHook({
      data: {
        totalMinutes: 1000,
        windowsMinutes: 600,
        macMinutes: 0,
        linuxMinutes: 250,
        deckMinutes: 150,
        dominantPlatform: "windows",
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(
      screen.getByText("Windows accounts for 60% of all tracked playtime.")
    ).toBeTruthy();
    expect(screen.getByText("Also tracked: Linux 25%, Steam Deck 15%.")).toBeTruthy();
  });

  it("renders a single-platform fallback prescription when no other platforms have time", () => {
    mockHook({
      data: {
        totalMinutes: 500,
        windowsMinutes: 500,
        macMinutes: 0,
        linuxMinutes: 0,
        deckMinutes: 0,
        dominantPlatform: "windows",
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(
      screen.getByText("No tracked time on the other three platforms.")
    ).toBeTruthy();
  });
});
