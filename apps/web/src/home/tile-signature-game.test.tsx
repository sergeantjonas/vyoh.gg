import { useMatches } from "@/lol/matches/use-matches";
import { render, screen } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileSignatureGame } from "./tile-signature-game";

vi.mock("@/lol/matches/use-matches", () => ({ useMatches: vi.fn() }));
vi.mock("@/lol/recap/recap-signature-game", () => ({
  RecapSignatureGame: ({ accountSlug }: { accountSlug: string }) => (
    <div data-testid="recap" data-slug={accountSlug} />
  ),
}));

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

afterEach(() => {
  vi.mocked(useMatches).mockReset();
});

describe("TileSignatureGame", () => {
  it("renders the no-account empty shell when no account is provided", () => {
    vi.mocked(useMatches).mockReturnValue({
      data: undefined,
      isPending: false,
    } as unknown as ReturnType<typeof useMatches>);
    render(<TileSignatureGame account={undefined} />);
    expect(screen.getByText("No account connected yet.")).toBeTruthy();
  });

  it("renders the loading empty shell while matches are pending and no cache exists", () => {
    vi.mocked(useMatches).mockReturnValue({
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useMatches>);
    render(<TileSignatureGame account={account} />);
    expect(screen.getByText("Loading recent play…")).toBeTruthy();
  });

  it("delegates to RecapSignatureGame once matches are resolved", () => {
    vi.mocked(useMatches).mockReturnValue({
      data: { pages: [[]] },
      isPending: false,
    } as unknown as ReturnType<typeof useMatches>);
    render(<TileSignatureGame account={account} />);
    const node = screen.getByTestId("recap");
    expect(node.getAttribute("data-slug")).toBe("ahri");
  });
});
