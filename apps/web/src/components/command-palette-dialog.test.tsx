import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";
import { CommandPaletteProvider } from "./command-palette-context";
import CommandPaletteDialog from "./command-palette-dialog";

const { navigateSpy, pathnameRef } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  pathnameRef: { current: "/" },
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
  useMe: () => ({ data: undefined }),
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
});
