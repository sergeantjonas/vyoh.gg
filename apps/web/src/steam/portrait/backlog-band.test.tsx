import { render, screen } from "@testing-library/react";
import type {
  GenreFingerprint,
  SteamPortrait,
  SteamPortraitBacklog,
  SteamPortraitSuggestion,
} from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BacklogBand } from "./backlog-band";
import { useSteamPortrait } from "./use-portrait";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-portrait", () => ({ useSteamPortrait: vi.fn() }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

// The owner's live backlog as of 2026-08-05, over 117 never-launched
// candidates: a Souls-like anchor deep enough that the pick, the sleeping genre
// and the abandoned game all come out of it. Both suggestions match on every
// genre they carry, which is the case the copy has to survive — two cards side
// by side with identical arithmetic available to them.
const PICK: SteamPortraitSuggestion = {
  appid: 2694490,
  name: "Nioh 3",
  matched: ["Souls-like", "Action RPG", "Hack and Slash"],
  genreCount: 3,
  score: 0.552,
  minutes: 0,
};

const REGRET: SteamPortraitSuggestion = {
  appid: 2701660,
  name: "Where Winds Meet",
  matched: ["Souls-like", "Action RPG", "Action-Adventure"],
  genreCount: 3,
  score: 0.577,
  minutes: 49,
};

// The sleeping card reaches back into the lifetime fingerprint for the count of
// games the owner *did* play in that genre — the denominator its hours need.
const LIFETIME_GENRES: GenreFingerprint["genres"] = [
  {
    tag: "Souls-like",
    minutes: 42_300,
    share: 0.299,
    gameCount: 16,
    examples: [{ appid: 1245620, name: "ELDEN RING", minutes: 22_664 }],
  },
];

const BACKLOG: SteamPortraitBacklog = {
  pick: PICK,
  sleeping: {
    tag: "Souls-like",
    minutes: 42_300,
    games: [
      { appid: 2513280, name: "Mortal Shell II", minutes: 0 },
      { appid: 2215430, name: "Ghost of Tsushima DIRECTOR'S CUT", minutes: 0 },
      { appid: 1501750, name: "Lords of the Fallen", minutes: 0 },
    ],
    untouchedCount: 11,
  },
  regret: REGRET,
  candidateCount: 117,
};

function portrait(
  backlog: SteamPortraitBacklog = BACKLOG,
  lifetimeGenres: GenreFingerprint["genres"] = LIFETIME_GENRES
): SteamPortrait {
  // The band reads `backlog`, the tasted count, and the lifetime share of
  // whichever genre is asleep. The rest is shaped rather than measured — a
  // fuller payload would go stale against the cards that do read it.
  return {
    lifetime: {
      genres: lifetimeGenres,
      distributedMinutes: 141_360,
      gamesCounted: 54,
      gamesWithoutGenre: 1,
    },
    recent: null,
    posture: {
      ownedCount: 186,
      meaningfulCount: 55,
      tastedCount: 11,
      ghostCount: 120,
      totalMinutes: 143_100,
      meaningfulMinutes: 142_814,
    },
    anti: {
      tasted: {
        count: 11,
        totalMinutes: 265,
        medianMinutes: 22,
        quickest: [],
        fingerprint: {
          genres: [],
          distributedMinutes: 210,
          gamesCounted: 9,
          gamesWithoutGenre: 2,
        },
      },
      singleAchievement: { games: [], withAnyUnlock: 54, withSchema: 157 },
      coldest: null,
    },
    backlog,
    completion: {
      cohortCount: 34,
      finishedCount: 18,
      perfectCount: 17,
      medianCompletion: 0.95,
      finished: [],
    },
    lastSyncedAt: "2026-08-05T00:00:00.000Z",
  };
}

function mockHook(value: {
  data: SteamPortrait | undefined;
  isPending: boolean;
  isError: boolean;
}): void {
  vi.mocked(useSteamPortrait).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamPortrait>
  );
}

function mockData(
  backlog?: SteamPortraitBacklog,
  lifetimeGenres?: GenreFingerprint["genres"]
): void {
  mockHook({ data: portrait(backlog, lifetimeGenres), isPending: false, isError: false });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("BacklogBand", () => {
  it("names the pick and the pool it was picked from", () => {
    mockData();
    render(<BacklogBand />);

    expect(screen.getByText(/Nioh 3 is the closest thing on your shelf/)).toBeTruthy();
    expect(screen.getByText(/Picked from 117 games/)).toBeTruthy();
  });

  it("says every genre matched rather than 3 of its 3", () => {
    mockData();
    render(<BacklogBand />);

    // Serial comma, which is not decoration here: the last genre is "Hack and
    // Slash", so without it the sentence reads as four genres rather than three.
    expect(
      screen.getByText(
        /Every genre it carries is one you play: Souls-like, Action RPG, and Hack and Slash/
      )
    ).toBeTruthy();
  });

  it("shows a partial match as a fraction", () => {
    mockData({ ...BACKLOG, pick: { ...PICK, genreCount: 5 } });
    render(<BacklogBand />);

    expect(screen.getByText(/3 of its 5 genres are ones you play/)).toBeTruthy();
  });

  it("renders the score as a share of the portrait", () => {
    mockData();
    render(<BacklogBand />);

    expect(screen.getByText(/55% of your portrait between them/)).toBeTruthy();
    expect(screen.getByText(/58% of your portrait between them/)).toBeTruthy();
  });

  // Live, the pick and the regret both match on every genre they carry, so the
  // two cards sit side by side with the same numbers available to them. They
  // must not open with the same sentence.
  it("does not repeat the pick's opening on the regret", () => {
    mockData();
    render(<BacklogBand />);

    expect(screen.getAllByText(/Every genre it carries is one you play/)).toHaveLength(1);
    expect(screen.getByText(/Whatever stopped you, it wasn't the genre/)).toBeTruthy();
  });

  it("counts the whole sleeping queue while naming a sample of it", () => {
    mockData();
    render(<BacklogBand />);

    // Untouched count first: the Portrait hero already states the anchor
    // genre's hours and carriers, and the sleeping genre is usually that same
    // anchor, so leading with the hours restates the masthead two bands later.
    expect(
      screen.getByText(
        /11 Souls-like games you've never launched, against 16 you've put 705h into/
      )
    ).toBeTruthy();
    expect(screen.getByText("Mortal Shell II")).toBeTruthy();
    // Eleven waiting, three named — the remainder has to be stated or the list
    // reads as the whole queue.
    expect(screen.getByText("+8 more")).toBeTruthy();
  });

  it("drops the played count when the genre is not in the fingerprint", () => {
    mockData(BACKLOG, []);
    render(<BacklogBand />);

    expect(
      screen.getByText(
        /11 Souls-like games you've never launched, against 705h already in the genre/
      )
    ).toBeTruthy();
  });

  it("states the pool the reopen candidate was chosen from", () => {
    mockData();
    render(<BacklogBand />);

    expect(
      screen.getByText(/Best match of the 11 you dropped inside the hour/)
    ).toBeTruthy();
  });

  it("links every named game into the library", () => {
    mockData();
    render(<BacklogBand />);

    // The router mock renders an `<a>` with no href, which carries no `link`
    // role, so these are matched by their text rather than by role.
    expect(screen.getByText("Open Nioh 3 →").tagName).toBe("A");
    expect(screen.getByText("Open Where Winds Meet →").tagName).toBe("A");
    expect(screen.getByText("Lords of the Fallen").tagName).toBe("A");
  });

  it("pluralises the abandoned minute", () => {
    mockData({ ...BACKLOG, regret: { ...REGRET, minutes: 1 } });
    render(<BacklogBand />);

    expect(screen.getByText(/got 1 minute and stopped there/)).toBeTruthy();
  });

  it("falls back per card rather than hiding the band", () => {
    mockData({ pick: null, sleeping: null, regret: null, candidateCount: 0 });
    render(<BacklogBand />);

    expect(screen.getByText("What to play")).toBeTruthy();
    expect(
      screen.getByText(/Nothing you own but haven't launched shares a genre/)
    ).toBeTruthy();
    expect(
      screen.getByText(/No genre you play has more than one game waiting/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Nothing you dropped inside the hour matches what you play/)
    ).toBeTruthy();
  });

  it("renders the loading shells without claiming a pick", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    render(<BacklogBand />);

    expect(screen.getByText("Scoring the shelf…")).toBeTruthy();
    expect(screen.queryByText(/Nioh 3/)).toBeNull();
  });

  it("renders the error shells", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    render(<BacklogBand />);

    expect(screen.getByText("The recommendation is unavailable right now.")).toBeTruthy();
    expect(
      screen.getByText("The sleeping genres are unavailable right now.")
    ).toBeTruthy();
  });

  it("has no axe violations", async () => {
    mockData();
    const { container } = render(<BacklogBand />);

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
