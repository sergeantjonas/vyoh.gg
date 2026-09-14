import type { SteamPlaySessionDigest, SteamSessionBeat } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { copyFor, headlineFor, liveHeadlineFor } from "./session-copy";

// A Tuesday evening in Brussels: 20:40 → 22:50 local.
function digest(beats: SteamSessionBeat[], unlocks = 0): SteamPlaySessionDigest {
  return {
    id: "s1",
    game: { appid: 1, name: "Onimusha" },
    startedAt: "2026-09-08T18:40:00.000Z",
    endedAt: "2026-09-08T20:50:00.000Z",
    durationMinutes: 130,
    beats,
    unlocks: Array.from({ length: unlocks }, (_, i) => ({
      apiName: `A${i}`,
      displayName: `Ach ${i}`,
      description: "",
      iconUrl: null,
      hidden: false,
      unlockedAt: "2026-09-08T19:00:00.000Z",
      globalPercent: 10,
    })),
  };
}

const SHAPE: SteamSessionBeat = {
  kind: "shape",
  strength: 0.1,
  slot: { weekday: 1, hour: 20 },
  durationMinutes: 130,
};

describe("headlineFor", () => {
  it("gives a session with no unlocks and no other beat a real sentence", () => {
    const h = headlineFor(digest([SHAPE]));
    expect(h.masthead).toBe("2h 10m");
    expect(h.sentence).toBe("2h 10m of Onimusha, a Tuesday evening.");
    expect(h.chips).toEqual([]);
  });

  it("leads with the strongest beat and turns the next two into chips", () => {
    const h = headlineFor(
      digest([
        { kind: "longest-in-game", strength: 0.9, rank: 1, of: 14 },
        { kind: "streak", strength: 0.5, days: 4 },
        { kind: "milestone", strength: 0.55, hours: 50 },
        { kind: "usual-slot", strength: 0.25, slot: { weekday: 1, hour: 20 }, rank: 2 },
        SHAPE,
      ])
    );
    expect(h.sentence).toBe("Your longest Onimusha session on record, out of 14.");
    expect(h.chips).toEqual(["4 days running", "Past 50h"]);
  });

  it("never spends a chip on the shape beat", () => {
    const h = headlineFor(
      digest([{ kind: "return", strength: 0.6, daysSince: 80 }, SHAPE])
    );
    expect(h.sentence).toBe("The first Onimusha in 3 months.");
    expect(h.chips).toEqual([]);
  });
});

describe("liveHeadlineFor", () => {
  const live = {
    id: "open",
    game: { appid: 1, name: "Onimusha" },
    startedAt: "2026-09-08T18:40:00.000Z",
    beats: [],
  };

  it("names the start when nothing has been earned yet, and calls the first minute just opened", () => {
    expect(liveHeadlineFor(live, 0)).toEqual({
      masthead: "Just opened",
      sentence: "Onimusha, open since 20:40.",
      chips: [],
    });
    expect(liveHeadlineFor(live, 72).masthead).toBe("1h 12m");
  });

  it("leads with a launch-time beat and chips the rest", () => {
    const h = liveHeadlineFor(
      {
        ...live,
        beats: [
          { kind: "return", strength: 0.6, daysSince: 80 },
          {
            kind: "bounced-from",
            strength: 0.35,
            appid: 2,
            name: "Wallpaper Engine",
            minutes: 8,
          },
        ],
      },
      5
    );
    expect(h.sentence).toBe("The first Onimusha in 3 months.");
    expect(h.chips).toEqual(["After 8m of Wallpaper Engine"]);
  });
});

describe("copyFor", () => {
  const d = digest([SHAPE]);

  it("formats clocks in Brussels time", () => {
    // Ends 00:52 local the next day.
    const late = { ...d, endedAt: "2026-09-08T22:52:00.000Z", durationMinutes: 252 };
    expect(
      copyFor({ kind: "late-finish", strength: 0.6, endHour: 0 }, late).sentence
    ).toBe("A run past midnight — Onimusha until 00:52.");
    expect(copyFor({ kind: "early-start", strength: 0.4, startHour: 6 }, d).chip).toBe(
      "From 20:40"
    );
  });

  it("speaks about rarity only when a percent is known", () => {
    expect(
      copyFor({ kind: "unlocks", strength: 0.6, count: 3, rarestPercent: 2.5 }, d)
        .sentence
    ).toBe("3 unlocks, the rarest held by 2.5% of players.");
    expect(
      copyFor({ kind: "unlocks", strength: 0.6, count: 1, rarestPercent: null }, d)
        .sentence
    ).toBe("1 unlock in Onimusha.");
    expect(
      copyFor({ kind: "unlocks", strength: 0.6, count: 2, rarestPercent: 0.04 }, d).chip
    ).toBe("2 unlocks · rarest <0.1%");
  });

  it("scales the return span with the gap", () => {
    expect(copyFor({ kind: "return", strength: 0.5, daysSince: 15 }, d).chip).toBe(
      "First in 2 weeks"
    );
    expect(copyFor({ kind: "return", strength: 0.9, daysSince: 400 }, d).chip).toBe(
      "First in 1+ year"
    );
  });

  it("names the neighbours", () => {
    expect(
      copyFor(
        {
          kind: "bounced-from",
          strength: 0.35,
          appid: 2,
          name: "Wallpaper Engine",
          minutes: 8,
        },
        d
      ).sentence
    ).toBe("Opened after 8 minutes of Wallpaper Engine.");
    expect(
      copyFor({ kind: "moved-on-to", strength: 0.3, appid: 3, name: "Nightreign" }, d)
        .chip
    ).toBe("Then Nightreign");
  });

  it("uses an ordinal for a rank below first", () => {
    expect(
      copyFor({ kind: "longest-in-game", strength: 0.5, rank: 3, of: 9 }, d)
    ).toEqual({
      sentence: "Your third-longest Onimusha session of 9.",
      chip: "Third-longest of 9",
    });
  });
});
