import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LastSessionChip } from "./last-session-chip";
import { useSteamSessions } from "./sessions/use-sessions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("./sessions/use-sessions", () => ({
  useSteamSessions: vi.fn(),
  SESSIONS_WEEKS: 12,
}));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

const BASE: SteamSessions = {
  window: {
    from: "",
    to: "2026-09-15T20:30:00.000Z",
    observedSince: "2026-05-16T00:00:00.000Z",
    sessionCount: 9,
  },
  live: null,
  sessions: [
    {
      id: "s1",
      game: { appid: 1, name: "Onimusha" },
      startedAt: "2026-09-13T09:12:00.000Z",
      endedAt: "2026-09-13T11:02:00.000Z",
      durationMinutes: 110,
      beats: [
        { kind: "longest-in-game", strength: 0.5, rank: 3, of: 10 },
        { kind: "streak", strength: 0.5, days: 3 },
        {
          kind: "shape",
          strength: 0.1,
          slot: { weekday: 6, hour: 11 },
          durationMinutes: 110,
        },
      ],
      unlocks: [],
    },
  ],
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
  offCamera: [],
};

function mock(data: SteamSessions) {
  vi.mocked(useSteamSessions).mockReturnValue({
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSteamSessions>);
}

// The day strip's per-bar tooltips read the provider the root layout mounts.
function renderChip() {
  return render(
    <TooltipPrimitive.Provider delayDuration={0}>
      <LastSessionChip />
    </TooltipPrimitive.Provider>
  );
}

describe("LastSessionChip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("carries the last session's headline and links into the sessions page", async () => {
    mock(BASE);
    const { container } = renderChip();
    expect(vi.mocked(useSteamSessions)).toHaveBeenCalledWith(4);
    expect(screen.getByText("Your third-longest Onimusha session of 10.")).toBeTruthy();
    expect(screen.getByText("3 days running")).toBeTruthy();
    // A finished session is the first row, so the card does not also say it in prose.
    expect(screen.queryByText(/^Playing for/)).toBeNull();
    expect(screen.getByText(/Every session/).getAttribute("to")).toBe("/steam/sessions");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("switches to the running session while a game is open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T20:30:00.000Z"));
    mock({
      ...BASE,
      live: {
        id: "open",
        game: { appid: 1, name: "Onimusha" },
        startedAt: "2026-09-15T19:00:00.000Z",
        beats: [],
      },
    });
    renderChip();
    expect(screen.getByText("Now playing")).toBeTruthy();
    expect(screen.getByText("Onimusha, open since 21:00.")).toBeTruthy();
    expect(screen.getByText("Playing for 1h 30m")).toBeTruthy();
    // The running session is a played day too, so the strip has its two.
    expect(screen.getByRole("rowheader", { name: "15 Sept" })).toBeTruthy();
  });

  it("draws the day strip over the fetched window", () => {
    mock({
      ...BASE,
      sessions: [
        ...BASE.sessions,
        {
          id: "s2",
          game: { appid: 1, name: "Onimusha" },
          startedAt: "2026-09-06T17:00:00.000Z",
          endedAt: "2026-09-06T19:30:00.000Z",
          durationMinutes: 150,
          beats: [],
          unlocks: [],
        },
      ],
    });
    renderChip();
    expect(
      screen.getByRole("img", { name: "Minutes played per day over the last 28 days" })
    ).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "13 Sept" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "6 Sept" })).toBeTruthy();
  });

  it("omits the strip when the window holds a single played day", () => {
    mock(BASE);
    renderChip();
    expect(screen.queryByRole("img", { name: /Minutes played per day/ })).toBeNull();
  });
});
