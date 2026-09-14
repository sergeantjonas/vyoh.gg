import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionsPage } from "./sessions-page";
import { useSteamSessions } from "./use-sessions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-sessions", () => ({ useSteamSessions: vi.fn(), SESSIONS_WEEKS: 12 }));
vi.mock("@/steam/profile-backdrop", () => ({ useSteamGameBackdrop: vi.fn() }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

const EMPTY_RECORDS: SteamSessions["records"] = {
  longest: null,
  latestFinish: null,
  mostUnlocks: null,
  longestDrySpell: null,
  quickestBounce: null,
};

const SHAPE = {
  kind: "shape",
  strength: 0.1,
  slot: { weekday: 5, hour: 11 },
  durationMinutes: 260,
} as const;

// A quiet Saturday marathon: the longest Onimusha session on record, nothing
// unlocked in it.
const QUIET: SteamSessions = {
  window: {
    from: "2026-06-22T00:00:00.000Z",
    to: "2026-09-14T00:00:00.000Z",
    observedSince: "2026-05-16T01:16:00.000Z",
    sessionCount: 41,
  },
  sessions: [
    {
      id: "s1",
      game: { appid: 3_000_001, name: "Onimusha" },
      startedAt: "2026-09-12T09:50:00.000Z",
      endedAt: "2026-09-12T14:10:00.000Z",
      durationMinutes: 260,
      beats: [
        { kind: "longest-in-game", strength: 0.86, rank: 1, of: 14 },
        { kind: "streak", strength: 0.58, days: 4 },
        SHAPE,
      ],
      unlocks: [],
    },
  ],
  hourMatrix: [],
  timeZone: "Europe/Brussels",
  perGame: [],
  milestones: [],
  records: {
    ...EMPTY_RECORDS,
    longest: {
      sessionId: "s1",
      game: { appid: 3_000_001, name: "Onimusha" },
      startedAt: "2026-09-12T09:50:00.000Z",
      value: 260,
    },
    longestDrySpell: {
      sessionId: "s1",
      game: { appid: 3_000_001, name: "Onimusha" },
      startedAt: "2026-09-12T09:50:00.000Z",
      value: 260,
    },
  },
  offCamera: [],
};

function wrap(ui: ReactNode) {
  return (
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

function mockQuery(
  data: SteamSessions | undefined,
  state: "success" | "pending" | "error"
) {
  vi.mocked(useSteamSessions).mockReturnValue({
    data,
    isPending: state === "pending",
    isError: state === "error",
  } as unknown as ReturnType<typeof useSteamSessions>);
}

describe("SessionsPage", () => {
  it("opens a zero-unlock session with a claim, not a placeholder", async () => {
    mockQuery(QUIET, "success");
    const { container } = render(wrap(<SessionsPage />));
    expect(screen.getByRole("heading", { name: "4h 20m" })).toBeTruthy();
    expect(
      screen.getByText("Your longest Onimusha session on record, out of 14.")
    ).toBeTruthy();
    expect(screen.getByText("4 days running")).toBeTruthy();
    expect(screen.queryByLabelText("Unlocked in this session")).toBeNull();
    expect(screen.queryByText(/no unlocks/i)).toBeNull();
    expect(screen.getByText(/41 observed sessions in 12 weeks/)).toBeTruthy();
    expect(screen.getByText("4h 20m in one sitting.")).toBeTruthy();
    expect(screen.getByText("4h 20m without a single unlock.")).toBeTruthy();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("renders the unlock row only when the session earned something", () => {
    mockQuery(
      {
        ...QUIET,
        sessions: QUIET.sessions.map((s) => ({
          ...s,
          beats: [
            { kind: "unlocks", strength: 0.72, count: 1, rarestPercent: 2.5 },
            SHAPE,
          ],
          unlocks: [
            {
              apiName: "BLADEMASTER",
              displayName: "Blademaster",
              description: "",
              iconUrl: null,
              hidden: false,
              unlockedAt: "2026-09-12T12:00:00.000Z",
              globalPercent: 2.5,
            },
          ],
        })),
      },
      "success"
    );
    render(wrap(<SessionsPage />));
    expect(screen.getByLabelText("Unlocked in this session")).toBeTruthy();
    expect(screen.getByText("Blademaster")).toBeTruthy();
    expect(screen.getByText("14:00 · 2.5% of players")).toBeTruthy();
    // The router mock renders a bare anchor, so it has no link role to query.
    expect(screen.getByText("Blademaster").closest("a")?.getAttribute("to")).toBe(
      "/steam/library/$appid"
    );
  });

  it("keeps a heading and a sentence while the log is loading", () => {
    mockQuery(undefined, "pending");
    render(wrap(<SessionsPage />));
    expect(screen.getByRole("heading", { name: "Reading the log" })).toBeTruthy();
    expect(screen.getAllByText("Reading the log…").length).toBeGreaterThan(0);
  });
});
