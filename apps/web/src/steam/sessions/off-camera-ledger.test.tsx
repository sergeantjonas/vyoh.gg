import { render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OffCameraLedger } from "./off-camera-ledger";
import { useSteamSessions } from "./use-sessions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-sessions", () => ({ useSteamSessions: vi.fn(), SESSIONS_WEEKS: 12 }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function unlock(apiName: string, displayName: string) {
  return {
    apiName,
    displayName,
    hidden: false,
    unlockedAt: "2026-08-22T20:00:00.000Z",
    globalPercent: 12,
  };
}

function page(offCamera: SteamSessions["offCamera"]): SteamSessions {
  return {
    window: { from: "", to: "", observedSince: null, sessionCount: 0 },
    live: null,
    sessions: [],
    hourMatrix: [],
    timeZone: "Europe/Brussels",
    perGame: [],
    milestones: [],
    records: {
      longest: null,
      latestFinish: null,
      mostUnlocks: null,
      longestDrySpell: null,
      quickestBounce: null,
    },
    offCamera,
  };
}

function mock(data: SteamSessions) {
  vi.mocked(useSteamSessions).mockReturnValue({
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSteamSessions>);
}

describe("OffCameraLedger", () => {
  it("totals the unseen unlocks and names a sample per game-day", async () => {
    mock(
      page([
        {
          game: { appid: 1, name: "Mortal Shell II" },
          day: "2026-08-22",
          count: 13,
          sample: [unlock("A", "Ashen"), unlock("B", "Bound"), unlock("C", "Cleaved")],
        },
        {
          game: { appid: 2, name: "The Witcher 3" },
          day: "2026-07-13",
          count: 1,
          sample: [unlock("D", "Dendrologist")],
        },
      ])
    );
    const { container } = render(<OffCameraLedger />);
    expect(
      screen.getByText(
        "14 unlocks across 2 days and 2 games landed while the api was not watching."
      )
    ).toBeTruthy();
    expect(screen.getByText("Ashen, Bound, Cleaved and 10 more")).toBeTruthy();
    expect(screen.getByText("Sat 22 Aug · 13")).toBeTruthy();
    expect(screen.getByText("Dendrologist")).toBeTruthy();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("says so when every unlock was seen", () => {
    mock(page([]));
    render(<OffCameraLedger />);
    expect(
      screen.getByText("Every unlock in the window landed inside an observed session.")
    ).toBeTruthy();
  });
});
