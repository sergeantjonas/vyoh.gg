import { render, screen } from "@testing-library/react";
import type { SteamPlaySessionDigest } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { RecentSessionRows } from "./recent-session-rows";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function session(
  id: string,
  appid: number,
  name: string,
  startedAt: string,
  minutes: number,
  unlocks = 0
): SteamPlaySessionDigest {
  const started = new Date(startedAt);
  return {
    id,
    game: { appid, name },
    startedAt,
    endedAt: new Date(started.getTime() + minutes * 60_000).toISOString(),
    durationMinutes: minutes,
    beats: [],
    unlocks: Array.from({ length: unlocks }, (_, i) => ({
      apiName: `a${i}`,
      displayName: `Achievement ${i}`,
      hidden: false,
      unlockedAt: startedAt,
      globalPercent: null,
    })),
  };
}

const ONIMUSHA = 1;
const SEKIRO = 2;

const SESSIONS = [
  session("s1", ONIMUSHA, "Onimusha", "2026-09-15T17:04:00.000Z", 216, 2),
  session("s2", ONIMUSHA, "Onimusha", "2026-09-13T07:48:00.000Z", 110),
  session("s3", SEKIRO, "Sekiro", "2026-09-10T20:20:00.000Z", 58),
];

describe("RecentSessionRows", () => {
  it("names the slot for the headline's game and the game for any other", () => {
    render(<RecentSessionRows sessions={SESSIONS} limit={4} headlineAppid={ONIMUSHA} />);
    // 17:04Z is 19:04 in Brussels; 07:48Z is 09:48.
    expect(screen.getByText("Tue evening")).toBeTruthy();
    expect(screen.getByText("Sun morning")).toBeTruthy();
    expect(screen.getByText("Sekiro")).toBeTruthy();
    expect(screen.queryByText("Onimusha")).toBeNull();
  });

  it("shows each session's duration and its unlock count when it has one", () => {
    render(<RecentSessionRows sessions={SESSIONS} limit={4} headlineAppid={ONIMUSHA} />);
    expect(screen.getByText("3h 36m")).toBeTruthy();
    expect(screen.getByText("2 unlocks")).toBeTruthy();
    expect(screen.queryByText("0 unlocks")).toBeNull();
  });

  it("stops at the limit", () => {
    render(<RecentSessionRows sessions={SESSIONS} limit={2} headlineAppid={ONIMUSHA} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("drops blip sessions rather than listing a zero-minute row", () => {
    const blip = session("s0", ONIMUSHA, "Onimusha", "2026-09-16T10:00:00.000Z", 0);
    render(
      <RecentSessionRows
        sessions={[blip, ...SESSIONS]}
        limit={4}
        headlineAppid={ONIMUSHA}
      />
    );
    expect(screen.queryByText("0m")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders nothing when every session is a blip", () => {
    const blip = session("s0", ONIMUSHA, "Onimusha", "2026-09-16T10:00:00.000Z", 0);
    const { container } = render(
      <RecentSessionRows sessions={[blip]} limit={4} headlineAppid={ONIMUSHA} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("leaves the rows as text, since a session has no page of its own", () => {
    render(<RecentSessionRows sessions={SESSIONS} limit={4} headlineAppid={ONIMUSHA} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <RecentSessionRows sessions={SESSIONS} limit={4} headlineAppid={ONIMUSHA} />
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
