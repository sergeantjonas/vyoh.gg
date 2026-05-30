import { SectionShellProvider } from "@/_shared/section-layout/section-shell-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { RankEntry } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { LolIdentityHero } from "./identity-hero";

// Pin the patch so asset URLs are deterministic; useChampionName falls back
// to the raw alias.
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

type Props = Parameters<typeof LolIdentityHero>[0];

function renderHero(overrides: Partial<Props> = {}, { compact = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: Props = {
    gameName: "Vyoh",
    tagLine: "Ahri",
    profileIconId: 123,
    summonerLevel: 412,
    rankEntries: [entry()],
    splashChampion: "Ahri",
    lastMatch: {
      champion: "Ahri",
      playedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    ...overrides,
  };
  // The hero reads `compact` from the section shell to yield its identity to
  // the strip morph; provide it so the hook doesn't throw.
  return render(
    <QueryClientProvider client={client}>
      <SectionShellProvider value={{ compact }}>
        <MotionConfig reducedMotion="always">
          <LolIdentityHero {...props} />
        </MotionConfig>
      </SectionShellProvider>
    </QueryClientProvider>
  );
}

describe("LolIdentityHero", () => {
  it("renders the Riot ID headline", () => {
    renderHero();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Vyoh#Ahri");
  });

  it("renders the queue's tier + LP in the rank strip and the level badge", () => {
    renderHero();
    // The rank strip renders tier and LP on separate lines per queue.
    expect(screen.getByText("Emerald I")).toBeTruthy();
    expect(screen.getByText("17 LP")).toBeTruthy();
    expect(screen.getByText("412")).toBeTruthy();
  });

  it("renders both ranked queues in the strip (Solo and Flex)", () => {
    renderHero({
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
    // Both queues now share one surface (no Solo-preference collapse).
    expect(screen.getByText("Diamond II")).toBeTruthy();
    expect(screen.getByText("44 LP")).toBeTruthy();
    expect(screen.getByText("Gold IV")).toBeTruthy();
    expect(screen.getByText("5 LP")).toBeTruthy();
  });

  it("shows Unranked in both queue cells when no rank entries exist", () => {
    renderHero({ rankEntries: [] });
    // Strip keeps both columns; each unranked queue shows the placeholder.
    expect(screen.getAllByText("Unranked")).toHaveLength(2);
  });

  it("brings the signature champion splash into focus via the sharp splash variant", () => {
    const { container } = renderHero();
    // The sharp `splash` variant, NOT the blurred `backdrop` the ambient wash
    // uses — same subject, brought into focus.
    const splash = container.querySelector('img[src*="/champion/ahri/splash/"]');
    expect(splash).toBeTruthy();
    expect(splash?.getAttribute("alt")).toBe("");
    expect(container.querySelector('img[src*="/backdrop/"]')).toBeNull();
  });

  it("omits the splash layer when there is no signature champion", () => {
    const { container } = renderHero({ splashChampion: null });
    expect(container.querySelector('img[src*="/splash/"]')).toBeNull();
  });

  it("renders the avatar and rank emblem through the image proxy", () => {
    const { container } = renderHero();
    expect(container.querySelector('img[src*="/profile-icon/123/16.9.1"]')).toBeTruthy();
    expect(container.querySelector('img[src*="/rank/EMERALD/"]')).toBeTruthy();
  });

  it("renders the last-played champion and relative time", () => {
    const { container } = renderHero();
    expect(container.textContent).toContain("Last played Ahri");
    expect(container.textContent).toMatch(/2h ago/);
  });

  it("omits the last-played row when no match is known", () => {
    const { container } = renderHero({ lastMatch: null });
    expect(container.textContent).not.toContain("Last played");
  });

  it("keeps the headline visible at scroll-top (not compact)", () => {
    renderHero({}, { compact: false });
    expect(screen.getByRole("heading", { level: 2 }).className).not.toContain(
      "opacity-0"
    );
  });

  it("hides its avatar + name when compact so the strip morph owns the identity", () => {
    const { container } = renderHero({}, { compact: true });
    // Name fades out; only opacity changes (the box stays laid out as the
    // shared-layout morph source for the strip copy).
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("opacity-0");
    // Avatar container (the element wrapping the proxied profile icon) also fades.
    const avatar = container.querySelector('img[src*="/profile-icon/123/"]');
    expect(avatar?.parentElement?.className).toContain("opacity-0");
  });

  it("marks its avatar + name as the cross-nav identity owner when not compact", () => {
    const { container } = renderHero({}, { compact: false });
    expect(container.querySelector("[data-identity-avatar]")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2 }).hasAttribute("data-identity-name")
    ).toBe(true);
  });

  it("drops the identity markers when compact so the strip owns them", () => {
    const { container } = renderHero({}, { compact: true });
    expect(container.querySelector("[data-identity-avatar]")).toBeNull();
    expect(container.querySelector("[data-identity-name]")).toBeNull();
  });

  it("wears an emerald activity ring when the account is in a live game", () => {
    const { container } = renderHero({ inLiveGame: true });
    const avatar = container.querySelector<HTMLImageElement>("[data-live-game]");
    expect(avatar).toBeTruthy();
    expect(avatar?.className).toContain("ring-emerald-400");
    // Live activity gets a sibling pulse halo behind the avatar.
    // `useReducedMotion()` reads the OS media query (NOT MotionConfig), so it
    // returns false under happy-dom and the pulse renders in tests.
    expect(container.querySelector("span.animate-ping.bg-emerald-400\\/35")).toBeTruthy();
  });

  it("falls back to the neutral chrome ring when not in a live game", () => {
    const { container } = renderHero({ inLiveGame: false });
    const avatar = container.querySelector<HTMLImageElement>(
      'img[src*="/profile-icon/123/"]'
    );
    expect(avatar?.className).toContain("ring-white/15");
    expect(avatar?.className).not.toContain("ring-emerald-400");
    expect(avatar?.hasAttribute("data-live-game")).toBe(false);
  });

  it("has no axe violations", async () => {
    const { container } = renderHero();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
