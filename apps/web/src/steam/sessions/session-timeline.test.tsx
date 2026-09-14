import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionTimelineCard } from "./session-timeline";
import { useSteamSessions } from "./use-sessions";

vi.mock("./use-sessions", () => ({ useSteamSessions: vi.fn(), SESSIONS_WEEKS: 12 }));
// happy-dom lays nothing out, so the column reads a fixed width.
vi.mock("@/lib/use-element-width", () => ({
  useElementWidth: () => ({ ref: () => {}, width: 640 }),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const ONIMUSHA = { appid: 1, name: "Onimusha: Way of the Sword" };
const SHELL = { appid: 2, name: "Mortal Shell II" };

const DATA: SteamSessions = {
  window: {
    from: "2026-06-22T00:00:00.000Z",
    to: "2026-09-14T22:00:00.000Z",
    observedSince: "2026-05-16T00:00:00.000Z",
    sessionCount: 2,
  },
  live: null,
  sessions: [
    {
      id: "s2",
      game: ONIMUSHA,
      startedAt: "2026-09-13T09:48:00.000Z",
      endedAt: "2026-09-13T10:36:00.000Z",
      durationMinutes: 48,
      beats: [
        {
          kind: "shape",
          strength: 0.1,
          slot: { weekday: 6, hour: 11 },
          durationMinutes: 48,
        },
      ],
      unlocks: [],
    },
    {
      id: "s1",
      game: SHELL,
      startedAt: "2026-09-06T11:50:00.000Z",
      endedAt: "2026-09-06T16:10:00.000Z",
      durationMinutes: 260,
      beats: [{ kind: "unlocks", strength: 0.72, count: 1, rarestPercent: 2.5 }],
      unlocks: [
        {
          apiName: "A",
          displayName: "A",
          hidden: false,
          unlockedAt: "2026-09-06T13:00:00.000Z",
          globalPercent: 2.5,
        },
      ],
    },
  ],
  hourMatrix: [],
  timeZone: "Europe/Brussels",
  perGame: [
    { game: SHELL, totalMinutes: 260, sessions: [], unlockTicks: [] },
    { game: ONIMUSHA, totalMinutes: 48, sessions: [], unlockTicks: [] },
  ],
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

function wrap(ui: ReactNode) {
  return (
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("SessionTimelineCard", () => {
  it("lays one row per game, most played first, and tables every session", async () => {
    mock(DATA);
    const { container } = render(wrap(<SessionTimelineCard />));
    const labels = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(labels).toEqual(["Mortal Shell II", "Onimusha: Way of the Sword"]);
    expect(
      screen.getByText("2 sessions across 2 games, laid on one strip of time.")
    ).toBeTruthy();
    expect(screen.getByRole("row", { name: /Mortal Shell II/ })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Onimusha/ })).toBeTruthy();
    expect(container.querySelectorAll("svg rect[rx='2']")).toHaveLength(2);
    expect(container.querySelectorAll("svg circle")).toHaveLength(1);
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("describes the bar under the pointer", () => {
    mock(DATA);
    const { container } = render(wrap(<SessionTimelineCard />));
    const bars = container.querySelectorAll("svg rect[rx='2']");
    const shell = bars[0];
    if (!shell) throw new Error("no bar");
    fireEvent.pointerMove(shell, { clientX: 300, clientY: 10 });
    expect(screen.getByText("Mortal Shell II · 4h 20m")).toBeTruthy();
    expect(screen.getByText(/Sunday 6 September · 13:50 to 18:10/)).toBeTruthy();
    expect(screen.getByText("1 unlock")).toBeTruthy();
  });

  it("folds the ninth game onward into one row and offers a reset once the span moves", () => {
    const games = Array.from({ length: 10 }, (_, i) => ({
      appid: 100 + i,
      name: `Game ${i}`,
    }));
    const template = DATA.sessions[0];
    if (!template) throw new Error("fixture");
    mock({
      ...DATA,
      sessions: games.map((g, i) => ({
        ...template,
        id: `g${i}`,
        game: g,
        unlocks: [],
      })),
      perGame: games.map((g, i) => ({
        game: g,
        totalMinutes: 1000 - i,
        sessions: [],
        unlockTicks: [],
      })),
    });
    render(wrap(<SessionTimelineCard />));
    const labels = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(labels).toHaveLength(8);
    expect(labels.at(-1)).toBe("3 more games");
    expect(screen.queryByRole("button", { name: "Reset span" })).toBeNull();
  });

  it("draws the open session as a dashed bar in its own row when the game has no closed sessions", () => {
    mock({
      ...DATA,
      live: {
        id: "open",
        game: { appid: 3, name: "ELDEN RING NIGHTREIGN" },
        startedAt: "2026-09-14T20:00:00.000Z",
        beats: [],
      },
    });
    const { container } = render(wrap(<SessionTimelineCard />));
    const labels = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(labels[0]).toBe("ELDEN RING NIGHTREIGN");
    expect(container.querySelectorAll("svg rect[stroke-dasharray='3 2']")).toHaveLength(
      1
    );
  });
});
