import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionTimelineCard } from "./session-timeline";
import { useSteamSessions } from "./use-sessions";

vi.mock("./use-sessions", () => ({ useSteamSessions: vi.fn(), SESSIONS_WEEKS: 12 }));
// happy-dom lays nothing out, so the column reads a width the test sets.
const layout = vi.hoisted(() => ({ width: 640 }));
vi.mock("@/lib/use-element-width", () => ({
  useElementWidth: () => ({ ref: () => {}, width: layout.width }),
}));
// Nor does it do SVG matrix maths, which the brush needs to read a pointer.
Object.assign(SVGElement.prototype, {
  getScreenCTM: () => ({ inverse: () => ({}) }),
});
Object.assign(SVGSVGElement.prototype, {
  createSVGPoint: () => {
    const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
    return point;
  },
});

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
  beforeEach(() => {
    layout.width = 640;
  });

  it("lays the last two weeks one day to a row and tables every session", async () => {
    mock(DATA);
    const { container } = render(wrap(<SessionTimelineCard />));
    // window.to is midnight into Tuesday 15, so Monday 14 is the newest row.
    expect(screen.getByText("Tue 1")).toBeTruthy();
    expect(screen.getByText("Mon 14")).toBeTruthy();
    expect(screen.queryByText("Mon 31")).toBeNull();
    expect(
      screen.getByText(
        "Mortal Shell II led the last two weeks with 4h 20m of 5h 8m, across 2 of 14 days."
      )
    ).toBeTruthy();
    expect(screen.getByRole("row", { name: /Mortal Shell II/ })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Onimusha/ })).toBeTruthy();
    expect(container.querySelectorAll("svg rect[rx='2']")).toHaveLength(2);
    expect(container.querySelectorAll("svg circle")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Back to latest" })).toBeNull();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("gives the span's most played game the accent and names the rest beside their bars", () => {
    mock(DATA);
    const { container } = render(wrap(<SessionTimelineCard />));
    const bars = container.querySelectorAll("svg rect[rx='2']");
    expect(bars[0]?.getAttribute("class")).toContain("fill-theme-strong");
    expect(bars[1]?.getAttribute("class")).toContain("fill-muted-foreground");
    expect(screen.getByText("1 other game")).toBeTruthy();
    const inChart = screen
      .getAllByText("Onimusha: Way of the Sword")
      .filter((el) => el.closest("svg"));
    expect(inChart).toHaveLength(1);
  });

  it("keeps a session past midnight on the evening it began", () => {
    const template = DATA.sessions[0];
    if (!template) throw new Error("fixture");
    mock({
      ...DATA,
      sessions: [
        ...DATA.sessions,
        {
          ...template,
          id: "late",
          startedAt: "2026-09-12T21:30:00.000Z",
          endedAt: "2026-09-12T23:30:00.000Z",
          durationMinutes: 120,
        },
      ],
    });
    const { container } = render(wrap(<SessionTimelineCard />));
    expect(container.querySelectorAll("svg rect[rx='2']")).toHaveLength(3);
  });

  it("describes the bar under the pointer", () => {
    mock(DATA);
    const { container } = render(wrap(<SessionTimelineCard />));
    const shell = container.querySelector("svg rect[data-session='s1']");
    if (!shell) throw new Error("no bar");
    fireEvent.pointerMove(shell, { clientX: 300, clientY: 10 });
    expect(screen.getByText("Mortal Shell II · 4h 20m")).toBeTruthy();
    expect(screen.getByText(/Sunday 6 September · 13:50 to 18:10/)).toBeTruthy();
    expect(screen.getByText("1 unlock")).toBeTruthy();
  });

  it("draws the open session dashed up to the now mark", () => {
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
    expect(container.querySelectorAll("svg rect[stroke-dasharray='3 2']")).toHaveLength(
      1
    );
    expect(screen.getByText("now")).toBeTruthy();
    // Muted, so it is named — after the now mark, since the bar ends on it.
    const named = screen
      .getAllByText(/^ELDEN RING/)
      .filter((el) => el.closest("svg[aria-label^='Sessions by time of day']"));
    expect(named).toHaveLength(1);
  });

  it("tells the live session's tooltip it runs to now", () => {
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
    const live = container.querySelector("svg rect[data-session='open']");
    if (!live) throw new Error("no live bar");
    fireEvent.pointerMove(live, { clientX: 300, clientY: 10 });
    expect(screen.getByText("ELDEN RING NIGHTREIGN · 2h")).toBeTruthy();
    expect(screen.getByText(/22:00 to now/)).toBeTruthy();
  });

  it("stops a muted name short of the now mark, cutting it to fit", () => {
    const template = DATA.sessions[0];
    if (!template) throw new Error("fixture");
    mock({
      ...DATA,
      sessions: [
        ...DATA.sessions,
        // 18:00–19:00 Brussels on the newest row, five hours before the mark.
        {
          ...template,
          id: "today",
          startedAt: "2026-09-14T16:00:00.000Z",
          endedAt: "2026-09-14T17:00:00.000Z",
          durationMinutes: 60,
        },
      ],
    });
    const { container } = render(wrap(<SessionTimelineCard />));
    const cut = [...container.querySelectorAll("svg text")].find(
      (t) => t.textContent?.startsWith("Onimusha") && t.textContent.endsWith("…")
    );
    expect(cut).toBeTruthy();
  });

  it("speaks of the last two weeks when one game had them, or none did", () => {
    const only = DATA.sessions[0];
    if (!only) throw new Error("fixture");
    mock({ ...DATA, sessions: [only] });
    const { unmount } = render(wrap(<SessionTimelineCard />));
    expect(
      screen.getByText(
        "Onimusha: Way of the Sword had the last two weeks to itself: 48m across 1 of 14 days."
      )
    ).toBeTruthy();
    unmount();

    mock({ ...DATA, window: { ...DATA.window, to: "2026-10-14T22:00:00.000Z" } });
    render(wrap(<SessionTimelineCard />));
    expect(screen.getByText("Nothing played in the last two weeks.")).toBeTruthy();
  });

  it("moves back through the weeks with the brush and returns to the latest", async () => {
    mock(DATA);
    render(wrap(<SessionTimelineCard />));
    const highlight = document.querySelector(".visx-brush-selection");
    if (!highlight) throw new Error("no brush");
    // visx reads page coordinates, which happy-dom does not derive from
    // client ones, and debounces the window move by a millisecond.
    const at = <E extends Event>(event: E, pageX: number): E =>
      Object.defineProperties(event, { pageX: { value: pageX }, pageY: { value: 5 } });
    act(() => {
      fireEvent(highlight, at(new PointerEvent("pointerdown", { bubbles: true }), 500));
    });
    await act(async () => {
      window.dispatchEvent(at(new MouseEvent("mousemove"), 300));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(screen.queryByText("Tue 1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to latest" }));
    expect(screen.getByText("Tue 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to latest" })).toBeNull();
  });

  it("keeps one row per day and the clock where it was across the October change", () => {
    const template = DATA.sessions[0];
    if (!template) throw new Error("fixture");
    mock({
      ...DATA,
      window: {
        ...DATA.window,
        from: "2026-08-03T00:00:00.000Z",
        to: "2026-10-27T12:00:00.000Z",
      },
      sessions: [
        // 20:00 Brussels either side of the switch: 18:00Z in CEST, 19:00Z in CET.
        {
          ...template,
          id: "before",
          startedAt: "2026-10-24T18:00:00.000Z",
          endedAt: "2026-10-24T20:00:00.000Z",
          durationMinutes: 120,
        },
        {
          ...template,
          id: "after",
          startedAt: "2026-10-26T19:00:00.000Z",
          endedAt: "2026-10-26T21:00:00.000Z",
          durationMinutes: 120,
        },
      ],
    });
    const { container } = render(wrap(<SessionTimelineCard />));
    expect(screen.getAllByText("Sat 24")).toHaveLength(1);
    expect(screen.getAllByText("Sun 25")).toHaveLength(1);
    const xs = [...container.querySelectorAll("svg rect[rx='2']")].map((r) =>
      Number(r.getAttribute("x"))
    );
    // 14 h past the 06:00 row start, across a 596 px plot after the 44 px gutter.
    expect(xs).toHaveLength(2);
    for (const x of xs) expect(x).toBeCloseTo(44 + (596 * 14) / 24, 3);
  });

  it("leaves the span where it is when the highlight is clicked without a drag, even on a phone", () => {
    layout.width = 362;
    mock(DATA);
    render(wrap(<SessionTimelineCard />));
    for (let i = 0; i < 3; i++) {
      const highlight = document.querySelector(".visx-brush-selection");
      if (!highlight) throw new Error("no brush");
      act(() => {
        fireEvent.pointerDown(highlight, { clientX: 100, clientY: 5 });
      });
      act(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
    }
    expect(screen.getByText("Tue 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to latest" })).toBeNull();
  });
});
