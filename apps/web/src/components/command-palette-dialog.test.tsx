import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";
import { CommandPaletteProvider } from "./command-palette-context";
import CommandPaletteDialog from "./command-palette-dialog";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/" } }),
}));

vi.mock("@/identity/use-me", () => ({
  useMe: () => ({ data: undefined }),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (key: string) => key,
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
