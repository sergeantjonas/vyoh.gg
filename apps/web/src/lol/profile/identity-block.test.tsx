import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { RankEntry } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { LolIdentityBlock } from "./identity-block";

// useDDragonVersion reads a query that isn't provided here; pin it so the
// avatar URL is deterministic. useChampionName falls back to the raw alias.
vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "16.9.1",
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function entry(overrides: Partial<RankEntry> = {}): RankEntry {
  return {
    queueId: "RANKED_SOLO_5x5",
    tier: "EMERALD",
    rank: "I",
    leaguePoints: 17,
    wins: 30,
    losses: 20,
    hotStreak: false,
    ...overrides,
  };
}

type Props = Parameters<typeof LolIdentityBlock>[0];

function renderBlock(overrides: Partial<Props> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: Props = {
    gameName: "Vyoh",
    tagLine: "Ahri",
    profileIconId: 123,
    summonerLevel: 412,
    rankEntries: [entry()],
    lastMatch: {
      champion: "Ahri",
      playedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    ...overrides,
  };
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="always">
          <LolIdentityBlock {...props} />
        </MotionConfig>
      </QueryClientProvider>
    </TooltipPrimitive.Provider>
  );
}

describe("LolIdentityBlock", () => {
  it("renders the Riot ID headline with the tag line", () => {
    const { container } = renderBlock();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Vyoh#Ahri");
    expect(container.textContent).toContain("#Ahri");
  });

  it("renders the primary-queue rank line and the summoner level badge", () => {
    renderBlock();
    expect(screen.getByText("Emerald I · 17 LP")).toBeTruthy();
    expect(screen.getByText("412")).toBeTruthy();
  });

  it("prefers Solo over Flex for the rank headline", () => {
    renderBlock({
      rankEntries: [
        entry({ queueId: "RANKED_FLEX_SR", tier: "GOLD", rank: "IV", leaguePoints: 5 }),
        entry({
          queueId: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 44,
        }),
      ],
    });
    expect(screen.getByText("Diamond II · 44 LP")).toBeTruthy();
  });

  it("falls back to Flex when only the Flex queue is ranked", () => {
    renderBlock({
      rankEntries: [
        entry({
          queueId: "RANKED_FLEX_SR",
          tier: "PLATINUM",
          rank: "III",
          leaguePoints: 80,
        }),
      ],
    });
    expect(screen.getByText("Platinum III · 80 LP")).toBeTruthy();
  });

  it("shows Unranked when no rank entries exist", () => {
    renderBlock({ rankEntries: [] });
    // The headline line reads Unranked; the two empty rank tiles also do.
    expect(screen.getAllByText("Unranked").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the last-played champion and relative time when a match is present", () => {
    const { container } = renderBlock();
    expect(container.textContent).toContain("Last played Ahri");
    expect(container.textContent).toMatch(/2h ago/);
  });

  it("omits the last-played row when no match is known", () => {
    const { container } = renderBlock({ lastMatch: null });
    expect(container.textContent).not.toContain("Last played");
  });

  it("renders the avatar through the profile-icon proxy at the pinned patch", () => {
    const { container } = renderBlock();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/profile-icon/123/16.9.1");
    // Decorative — the adjacent Riot ID is the accessible name.
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("shows an avatar placeholder when the profile icon is unknown", () => {
    // No rank entries → no emblem imgs, so the only avatar candidate is the
    // placeholder div (not an <img>).
    const { container } = renderBlock({ profileIconId: null, rankEntries: [] });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".animate-pulse.rounded-full")).toBeTruthy();
  });

  it("renders the Solo/Flex rank tiles as the second section", () => {
    renderBlock();
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
    expect(screen.getByText("Ranked Flex")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderBlock();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
