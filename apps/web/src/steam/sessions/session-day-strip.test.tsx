import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamPlaySessionDigest } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { SessionDayStrip } from "./session-day-strip";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

const TIME_ZONE = "Europe/Brussels";
const THROUGH = "2026-09-10T12:00:00.000Z";

function session(
  startedAt: string,
  endedAt: string,
  unlocks = 0,
  game = { appid: 1, name: "Onimusha" }
): SteamPlaySessionDigest {
  return {
    id: startedAt,
    game,
    startedAt,
    endedAt,
    durationMinutes: Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
    ),
    beats: [],
    unlocks: Array.from({ length: unlocks }, (_, i) => ({
      apiName: `a${i}`,
      displayName: `Achievement ${i}`,
      hidden: false,
      unlockedAt: endedAt,
      globalPercent: null,
    })),
  };
}

const PLAYED_DAYS = [
  session("2026-09-09T18:00:00.000Z", "2026-09-09T20:00:00.000Z", 2),
  session("2026-09-06T10:00:00.000Z", "2026-09-06T11:00:00.000Z"),
];

function renderStrip(
  sessions: SteamPlaySessionDigest[],
  live: Parameters<typeof SessionDayStrip>[0]["live"] = null
) {
  return render(
    <TooltipPrimitive.Provider delayDuration={0}>
      <SessionDayStrip
        sessions={sessions}
        live={live}
        timeZone={TIME_ZONE}
        days={28}
        through={THROUGH}
      />
    </TooltipPrimitive.Provider>
  );
}

describe("SessionDayStrip", () => {
  it("draws nothing until two days in the window carry play", () => {
    const { container } = renderStrip([PLAYED_DAYS[0] as SteamPlaySessionDigest]);
    expect(container.firstChild).toBeNull();
  });

  it("labels the window's first and last day", () => {
    renderStrip(PLAYED_DAYS);
    expect(screen.getByText("14 Aug")).toBeTruthy();
    expect(screen.getByText("10 Sept")).toBeTruthy();
  });

  it("lists only played days in the screen-reader table", () => {
    renderStrip(PLAYED_DAYS);
    // One header row plus the two played days; the 26 silent ones stay out.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("rowheader", { name: "9 Sept" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "6 Sept" })).toBeTruthy();
  });

  it("carries each day's unlock count", () => {
    renderStrip(PLAYED_DAYS);
    expect(screen.getAllByRole("cell").map((c) => c.textContent)).toContain("2");
  });

  it("counts the running session toward today", () => {
    renderStrip([PLAYED_DAYS[1] as SteamPlaySessionDigest], {
      id: "open",
      game: { appid: 1, name: "Onimusha" },
      startedAt: "2026-09-10T09:00:00.000Z",
      beats: [],
    });
    expect(screen.getByRole("rowheader", { name: "10 Sept" })).toBeTruthy();
  });

  it("names the window's other games rather than letting one hue claim them", () => {
    renderStrip([
      ...PLAYED_DAYS,
      session("2026-09-02T19:00:00.000Z", "2026-09-02T21:00:00.000Z", 0, {
        appid: 2,
        name: "Mortal Shell II",
      }),
    ]);
    // The legend says there is something else, and the table says what.
    expect(screen.getByText("1 other game")).toBeTruthy();
    expect(screen.getByText("Mortal Shell II")).toBeTruthy();
  });

  it("drops the legend when the window holds only the headline's game", () => {
    renderStrip(PLAYED_DAYS);
    expect(screen.queryByText(/other game/)).toBeNull();
  });

  it("names the strip for assistive tech", () => {
    renderStrip(PLAYED_DAYS);
    expect(
      screen.getByRole("img", { name: "Minutes played per day over the last 28 days" })
    ).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderStrip(PLAYED_DAYS);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
