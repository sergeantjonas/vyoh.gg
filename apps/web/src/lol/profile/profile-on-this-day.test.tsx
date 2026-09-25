import { render, screen } from "@testing-library/react";
import type { OnThisDay } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProfileOnThisDay,
  formatOnThisDayDate,
  onThisDayLabel,
} from "./profile-on-this-day";
import { useOnThisDay } from "./use-on-this-day";

vi.mock("./use-on-this-day", () => ({ useOnThisDay: vi.fn() }));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => (alias === "MonkeyKing" ? "Wukong" : alias),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: { children: ReactNode; params: { accountSlug: string; matchId: string } }) => (
    <a href={`/lol/${params.accountSlug}/matches/${params.matchId}`}>{children}</a>
  ),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const TWO_YEARS: OnThisDay = {
  years: [
    {
      yearsAgo: 1,
      date: "2025-09-25",
      exact: true,
      games: 4,
      wins: 3,
      topChampion: "Ahri",
      headline: {
        matchId: "EUW1_1",
        champion: "Ahri",
        win: true,
        kills: 12,
        deaths: 2,
        assists: 9,
      },
    },
    {
      yearsAgo: 2,
      date: "2024-09-24",
      exact: false,
      games: 1,
      wins: 0,
      topChampion: "MonkeyKing",
      headline: {
        matchId: "EUW1_2",
        champion: "MonkeyKing",
        win: false,
        kills: 3,
        deaths: 7,
        assists: 4,
      },
    },
  ],
};

function mockOnThisDay(data: OnThisDay | undefined) {
  vi.mocked(useOnThisDay).mockReturnValue({ data } as ReturnType<typeof useOnThisDay>);
}

function renderCard() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileOnThisDay accountSlug="ahri" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useOnThisDay).mockReset();
});

describe("onThisDayLabel", () => {
  it("says today on the exact date and this week when a nearby day stood in", () => {
    expect(onThisDayLabel({ yearsAgo: 1, exact: true })).toBe("A year ago today");
    expect(onThisDayLabel({ yearsAgo: 2, exact: false })).toBe("Two years ago this week");
    expect(onThisDayLabel({ yearsAgo: 10, exact: true })).toBe("Ten years ago today");
    expect(onThisDayLabel({ yearsAgo: 11, exact: true })).toBe("11 years ago today");
  });
});

describe("formatOnThisDayDate", () => {
  it("prints the stored day even in a zone west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    try {
      expect(formatOnThisDayDate("2024-09-24")).toMatch(/Tue,? 24 Sept? 2024/);
      // What the stored day would read as through the local zone instead.
      expect(new Date("2024-09-24T00:00:00Z").getDate()).toBe(23);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("ProfileOnThisDay", () => {
  it("draws nothing while loading, and nothing on a day with no earlier games", () => {
    mockOnThisDay(undefined);
    expect(renderCard().container.firstChild).toBeNull();
    mockOnThisDay({ years: [] });
    expect(renderCard().container.firstChild).toBeNull();
  });

  it("gives each earlier year a row that opens its best game", () => {
    mockOnThisDay(TWO_YEARS);
    renderCard();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/lol/ahri/matches/EUW1_1",
      "/lol/ahri/matches/EUW1_2",
    ]);
    expect(links[0]?.textContent).toContain("A year ago today");
    expect(links[0]?.textContent).toContain("4 games · 3W 1L · mostly Ahri");
    expect(links[1]?.textContent).toContain("Two years ago this week");
  });

  it("names champions by display name and prints the date as it was in Brussels", () => {
    mockOnThisDay(TWO_YEARS);
    renderCard();
    const second = screen.getAllByRole("link")[1];
    expect(second?.textContent).toContain("mostly Wukong");
    expect(second?.textContent).toContain("Loss");
    expect(second?.textContent).toMatch(/Tue,? 24 Sept? 2024/);
  });

  it("shows at most three years, most recent first", () => {
    const years = Array.from({ length: 5 }, (_, i) => ({
      ...TWO_YEARS.years[0],
      yearsAgo: i + 1,
      headline: { ...TWO_YEARS.years[0]?.headline, matchId: `EUW1_${i}` },
    })) as OnThisDay["years"];
    mockOnThisDay({ years });
    renderCard();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("has no axe violations", async () => {
    mockOnThisDay(TWO_YEARS);
    const { container } = renderCard();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
