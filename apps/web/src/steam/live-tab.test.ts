import type { SteamPlayerState } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { steamLiveTab } from "./live-tab";

const OPEN = {
  currentGame: { appid: 2638890, name: "Onimusha: Way of the Sword" },
} as unknown as SteamPlayerState;
const IDLE = { currentGame: null } as unknown as SteamPlayerState;

describe("steamLiveTab", () => {
  it("points at the sessions page while a game is open, naming the game for screen readers", () => {
    expect(steamLiveTab(OPEN, "/steam/library")).toEqual({
      to: "/steam/sessions",
      active: false,
      label: "Playing",
      ariaLabel: "Playing Onimusha: Way of the Sword",
    });
    expect(steamLiveTab(OPEN, "/steam/sessions")?.active).toBe(true);
  });

  it("is absent with no game open or before the poll answers", () => {
    expect(steamLiveTab(IDLE, "/steam")).toBeUndefined();
    expect(steamLiveTab(undefined, "/steam")).toBeUndefined();
  });
});
