import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";
import { CommandPaletteProvider } from "./command-palette-context";
import CommandPaletteDialog from "./command-palette-dialog";

type MockAccount = {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
};

const { navigateSpy, pathnameRef, accountsRef } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  pathnameRef: { current: "/" },
  accountsRef: { current: [] as MockAccount[] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: pathnameRef.current } }),
}));

vi.mock("@/identity/use-me", () => ({
  useMe: () =>
    accountsRef.current.length > 0
      ? { data: { lol: accountsRef.current } }
      : { data: undefined },
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (key: string) => key,
  useChampions: () => ({
    data: new Map([
      ["nidalee", { name: "Nidalee", description: "", roles: [] }],
      ["ahri", { name: "Ahri", description: "", roles: [] }],
      ["jarvaniv", { name: "Jarvan IV", description: "", roles: [] }],
    ]),
  }),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-testid={`champ-icon-${championName}`} />
  ),
}));

vi.mock("@/lol/matches/use-matches", () => ({
  prefetchCachedMatches: vi.fn(),
}));

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("CommandPalette keyboard shortcut", () => {
  it("⌘K opens the dialog", async () => {
    wrap(
      <CommandPaletteProvider>
        <CommandPalette />
      </CommandPaletteProvider>
    );
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => screen.getByPlaceholderText("Type a command or search…"));
  });

  it("Ctrl+K opens the dialog", async () => {
    wrap(
      <CommandPaletteProvider>
        <CommandPalette />
      </CommandPaletteProvider>
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => screen.getByPlaceholderText("Type a command or search…"));
  });
});

describe("CommandPaletteDialog", () => {
  beforeEach(() => {
    pathnameRef.current = "/";
    accountsRef.current = [];
    navigateSpy.mockClear();
    localStorage.clear();
  });

  it("shows Pages items when open", () => {
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: /Home/ })).not.toBeNull();
    expect(screen.getByRole("option", { name: /League of Legends/ })).not.toBeNull();
    expect(screen.getByRole("option", { name: /Steam/ })).not.toBeNull();
  });

  it("filters items when text is typed", () => {
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "steam" },
    });
    expect(screen.getByRole("option", { name: /Steam/ })).not.toBeNull();
    expect(screen.queryByRole("option", { name: /Home/ })).toBeNull();
  });

  it("renders parsed chips for structured verbs", () => {
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "with:nidalee wins" },
    });
    expect(
      screen.getByRole("button", { name: "Remove filter: with: nidalee" })
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove filter: wins" })).not.toBeNull();
  });

  it("does not show Champions group on freeText typing when no account is active", () => {
    pathnameRef.current = "/";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "nid" },
    });
    expect(screen.queryByRole("option", { name: /Nidalee/ })).toBeNull();
  });

  it("renders Champions group filtered by typed name when account is active", () => {
    pathnameRef.current = "/lol/foo";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "nid" },
    });
    expect(screen.getByRole("option", { name: /Nidalee/ })).not.toBeNull();
    expect(screen.queryByRole("option", { name: /Ahri/ })).toBeNull();
  });

  it("matches multi-word champion display name via alias-stripped input", () => {
    pathnameRef.current = "/lol/foo";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "jarvan" },
    });
    expect(screen.getByRole("option", { name: /Jarvan IV/ })).not.toBeNull();
  });

  it("selecting a champion navigates to /lol/<slug>/champions/<alias>", () => {
    pathnameRef.current = "/lol/foo";
    navigateSpy.mockClear();
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "nid" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Nidalee/ }));
    expect(navigateSpy).toHaveBeenCalledWith({ to: "/lol/foo/champions/nidalee" });
  });

  it("renders 'Search matches in <account>' companion for each matched account", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
      { slug: "jonalt-na", gameName: "JonAlt", tagLine: "NA", region: "NA1" },
    ];
    pathnameRef.current = "/";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "jon" },
    });
    expect(
      screen.getByRole("option", { name: /Search matches in.*Jonas/ })
    ).not.toBeNull();
    expect(
      screen.getByRole("option", { name: /Search matches in.*JonAlt/ })
    ).not.toBeNull();
  });

  it("clicking 'Search matches in X' navigates to /matches and clears input without closing", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/steam";
    const onOpenChange = vi.fn();
    wrap(<CommandPaletteDialog open onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText(
      "Type a command or search…"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "jon" } });
    fireEvent.click(screen.getByRole("option", { name: /Search matches in.*Jonas/ }));
    expect(navigateSpy).toHaveBeenCalledWith({ to: "/lol/jonas-euw/matches" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(input.value).toBe("");
  });

  it("hides 'Search matches in X' when a structured verb is in play", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "with:nidalee" },
    });
    expect(screen.queryByRole("option", { name: /Search matches in/ })).toBeNull();
  });

  it("hides Champions group when a structured verb is in play", () => {
    pathnameRef.current = "/lol/foo";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "with:nidalee" },
    });
    expect(screen.queryByRole("option", { name: /^Nidalee$/ })).toBeNull();
  });

  it("clicking a chip removes that token from the input and widens results", () => {
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(
      "Type a command or search…"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "with:nidalee wins" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: with: nidalee" }));
    expect(input.value).toBe("wins");
    expect(
      screen.queryByRole("button", { name: "Remove filter: with: nidalee" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Remove filter: wins" })).not.toBeNull();
  });

  it("persists Recent group across remounts when a Page is selected", () => {
    pathnameRef.current = "/";
    const { unmount } = wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    // Before selecting: only one Steam option (from Pages group).
    expect(screen.getAllByRole("option", { name: /Steam/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /Steam/ }));
    unmount();
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    // After re-open: Steam appears twice (Recent group + Pages group).
    expect(screen.getAllByRole("option", { name: /Steam/ })).toHaveLength(2);
  });

  it("hides Recent group once the user starts typing", () => {
    pathnameRef.current = "/";
    localStorage.setItem(
      "vyoh:palette-recents:global",
      JSON.stringify([{ path: "/steam", label: "Steam", kind: "page" }])
    );
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    // First render shows Recent group, then typing should hide it.
    const recentBefore = screen.queryAllByRole("option").map((o) => o.textContent);
    expect(recentBefore.some((t) => t?.includes("Steam"))).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "home" },
    });
    // After typing "home", the global Recent group is gone — only the matching
    // Page item remains.
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toMatch(/Home/);
  });

  it("scopes recents per stream — steam recents do not appear on /lol/<slug>", () => {
    localStorage.setItem(
      "vyoh:palette-recents:steam",
      JSON.stringify([{ path: "/steam/library/440", label: "TF2", kind: "page" }])
    );
    pathnameRef.current = "/lol/foo";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: /TF2/ })).toBeNull();
  });

  it("clears the input when the dialog is closed via onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    const { rerender } = wrap(<CommandPaletteDialog open onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText(
      "Type a command or search…"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input.value).toBe("hello");
    // Close the dialog by pressing escape — Radix wires this through onOpenChange.
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Re-mount to verify the input was reset by the close handler.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CommandPaletteDialog open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );
    expect(
      (screen.getByPlaceholderText("Type a command or search…") as HTMLInputElement).value
    ).toBe("");
  });

  it("renders 'Match history not loaded' and a Load matches action on a current account", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/lol/jonas-euw";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Match history not loaded yet/)).toBeTruthy();
    expect(screen.getByRole("option", { name: /Load matches/ })).toBeTruthy();
  });

  it("clicking Load matches calls prefetchCachedMatches", async () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/lol/jonas-euw";
    const useMatchesMod = await import("@/lol/matches/use-matches");
    const prefetch = vi.mocked(useMatchesMod.prefetchCachedMatches);
    prefetch.mockResolvedValueOnce(undefined);
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("option", { name: /Load matches/ }));
    await waitFor(() => expect(prefetch).toHaveBeenCalled());
  });

  it("renders cached matches and 'Xm/h/d ago' relative timestamps when query data exists", async () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/lol/jonas-euw";
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const playedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    client.setQueryData(
      ["lol", "matches-cached-infinite", "EUW1", "Jonas", "EUW", undefined],
      {
        pages: [
          {
            matches: [
              {
                matchId: "EUW1_42",
                champion: "Ahri",
                kills: 5,
                deaths: 2,
                assists: 7,
                win: true,
                queueType: "Ranked Solo",
                playedAt,
                remake: false,
                teamPosition: "MIDDLE",
                gameVersion: "16.9.1.1",
                laneOpponent: null,
              },
            ],
          },
        ],
      }
    );
    render(
      <QueryClientProvider client={client}>
        <CommandPaletteDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    // The Matches group renders the match row with a relative timestamp.
    expect(screen.getByText(/m ago|h ago|d ago/)).toBeTruthy();
    // Clicking the match navigates to the detail route.
    fireEvent.click(screen.getByRole("option", { name: /Ahri/ }));
    expect(navigateSpy).toHaveBeenCalledWith({
      to: "/lol/jonas-euw/matches/EUW1_42",
    });
  });

  it("clicking an Account option navigates to /lol/<slug>", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/";
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Type a command or search…"), {
      target: { value: "jonas" },
    });
    // The first option for the account (not the "Search matches in" companion).
    const accountOption = screen
      .getAllByRole("option", { name: /Jonas/ })
      .find((el) => !el.textContent?.includes("Search matches in"));
    if (!accountOption) throw new Error("account option not found");
    fireEvent.click(accountOption);
    expect(navigateSpy).toHaveBeenCalledWith({ to: "/lol/jonas-euw" });
  });

  it("relativeTime formats minute, hour, and day buckets distinctly", () => {
    accountsRef.current = [
      { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "EUW1" },
    ];
    pathnameRef.current = "/lol/jonas-euw";
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const now = Date.now();
    const playedMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const playedHourAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const playedDayAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    client.setQueryData(
      ["lol", "matches-cached-infinite", "EUW1", "Jonas", "EUW", undefined],
      {
        pages: [
          {
            matches: [
              {
                matchId: "EUW1_1",
                champion: "Ahri",
                kills: 1,
                deaths: 1,
                assists: 1,
                win: true,
                queueType: "Ranked Solo",
                playedAt: playedMinAgo,
                remake: false,
                teamPosition: "MIDDLE",
                gameVersion: "16.9.1.1",
                laneOpponent: null,
              },
              {
                matchId: "EUW1_2",
                champion: "Ahri",
                kills: 1,
                deaths: 1,
                assists: 1,
                win: false,
                queueType: "Ranked Solo",
                playedAt: playedHourAgo,
                remake: false,
                teamPosition: "MIDDLE",
                gameVersion: "16.9.1.1",
                laneOpponent: null,
              },
              {
                matchId: "EUW1_3",
                champion: "Ahri",
                kills: 1,
                deaths: 1,
                assists: 1,
                win: true,
                queueType: "Ranked Solo",
                playedAt: playedDayAgo,
                remake: false,
                teamPosition: "MIDDLE",
                gameVersion: "16.9.1.1",
                laneOpponent: null,
              },
            ],
          },
        ],
      }
    );
    render(
      <QueryClientProvider client={client}>
        <CommandPaletteDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/10m ago/)).toBeTruthy();
    expect(screen.getByText(/3h ago/)).toBeTruthy();
    expect(screen.getByText(/2d ago/)).toBeTruthy();
  });
});
