import { usePrimaryAccount } from "@/home/use-primary-account";
import { render, screen } from "@testing-library/react";
import type { LolAccountWithSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerIdentityStrip } from "./owner-identity-strip";

vi.mock("@/home/use-primary-account", () => ({ usePrimaryAccount: vi.fn() }));

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "15.10.1",
}));

vi.mock("@/lol/_shared/use-ranked-emblem-year", () => ({
  useRankedEmblemYear: () => "2026",
}));

vi.mock("@/lol/_shared/assets/summoner-icon", () => ({
  profileIconUrl: (id: number, patch: string) => `https://test/icon/${id}/${patch}.webp`,
}));

vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  rankEmblemUrl: (tier: string, year: string) =>
    `https://test/emblem/${tier}/${year}.webp`,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to?: string; [key: string]: unknown }) => (
    <a href={to} data-to={to} {...props}>
      {children}
    </a>
  ),
}));

function mockAccount(account: LolAccountWithSummary | undefined): void {
  vi.mocked(usePrimaryAccount).mockReturnValue({
    account,
    isPending: account === undefined,
  });
}

afterEach(() => {
  vi.mocked(usePrimaryAccount).mockReset();
});

describe("OwnerIdentityStrip", () => {
  it("renders nothing until the primary account resolves", () => {
    mockAccount(undefined);
    const { container } = render(<OwnerIdentityStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the game name + tagline and links to the primary profile", () => {
    mockAccount({
      slug: "ahri",
      gameName: "Vyoh",
      tagLine: "Ahri",
      region: "euw1",
      isOwner: true,
      isPrimary: true,
      profileIconId: 7,
      summary: null,
    });
    render(<OwnerIdentityStrip />);
    expect(screen.getByText("Vyoh")).toBeTruthy();
    expect(screen.getByText("#Ahri")).toBeTruthy();
    const link = screen.getByRole("link") as HTMLAnchorElement;
    // The router mock surfaces tanstack's `to` as both href and a data-to
    // attr for behaviour verification without a live router.
    expect(link.getAttribute("data-to")).toBe("/lol/$accountSlug");
  });

  it("renders the profile icon when one is set", () => {
    mockAccount({
      slug: "ahri",
      gameName: "Vyoh",
      tagLine: "Ahri",
      region: "euw1",
      profileIconId: 42,
      summary: null,
    });
    const { container } = render(<OwnerIdentityStrip />);
    // alt="" makes the icon presentational so getByRole("img") doesn't see
    // it. Query by src directly — that's the wiring we want to assert.
    const icon = container.querySelector('img[src="https://test/icon/42/15.10.1.webp"]');
    expect(icon).not.toBeNull();
  });

  it("renders the rank pill when the primary account is ranked", () => {
    mockAccount({
      slug: "ahri",
      gameName: "Vyoh",
      tagLine: "Ahri",
      region: "euw1",
      profileIconId: 7,
      summary: {
        rank: {
          tier: "DIAMOND",
          division: "II",
          leaguePoints: 42,
          queueId: "RANKED_SOLO_5x5",
        },
        lastPlayedChampionAlias: null,
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    });
    render(<OwnerIdentityStrip />);
    expect(screen.getByText(/Diamond II 42/)).toBeTruthy();
    const emblem = screen.getByAltText("DIAMOND") as HTMLImageElement;
    expect(emblem.src).toBe("https://test/emblem/DIAMOND/2026.webp");
  });

  it("omits the rank pill when the account is unranked", () => {
    mockAccount({
      slug: "ahri",
      gameName: "Vyoh",
      tagLine: "Ahri",
      region: "euw1",
      profileIconId: 7,
      summary: {
        rank: null,
        lastPlayedChampionAlias: null,
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    });
    render(<OwnerIdentityStrip />);
    expect(screen.queryByText(/Diamond/)).toBeNull();
  });
});
