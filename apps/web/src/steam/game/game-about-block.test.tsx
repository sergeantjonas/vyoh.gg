import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { SteamGameDescription } from "@vyoh/shared";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameAboutBlock, useGameDescriptionHtml } from "./game-about-block";
import { useGameDescription } from "./use-game-description";

vi.mock("./use-game-description", () => ({
  useGameDescription: vi.fn(),
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(useGameDescription).mockReset();
});

describe("GameAboutBlock (inline prose, no card chrome)", () => {
  it("renders a small inline skeleton while the query is pending", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(
      <GameAboutBlock appid={42} shortDescription={null} />
    );
    expect(container.querySelector("[aria-busy]")).toBeTruthy();
  });

  it("renders a 'no description on file' note when bbcode is null", () => {
    const payload: SteamGameDescription = { appid: 42, bbcode: null };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(<GameAboutBlock appid={42} shortDescription={null} />);
    expect(screen.getByText(/No full description on file/)).toBeTruthy();
  });

  it("renders sanitised HTML when BBCode is present (no h2 wrapper)", async () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[h1]About Title[/h1]\n\n[b]Bold[/b] paragraph.",
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(
      <GameAboutBlock appid={42} shortDescription={null} />
    );
    await waitFor(() => {
      expect(screen.getByText("About Title")).toBeTruthy();
    });
    // The parent identity card owns the section heading now — this component
    // must NOT render its own "About this game" h2.
    expect(container.querySelector("h2")).toBeNull();
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
  });

  it("drops [img] tags via the rewriteImgSrc=null hook (no <img> rendered)", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[img]https://steamcdn-a.akamaihd.net/foo.jpg[/img]\n\nText.",
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(
      <GameAboutBlock appid={42} shortDescription={null} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/Text\./)).toBeTruthy();
  });
});

describe("useGameDescriptionHtml", () => {
  function HookProbe({
    appid,
    shortDescription = null,
  }: {
    appid: number;
    shortDescription?: string | null;
  }) {
    const { hasDescription, isPending, html } = useGameDescriptionHtml(
      appid,
      shortDescription
    );
    return (
      <div
        data-testid="probe"
        data-has={String(hasDescription)}
        data-pending={String(isPending)}
        data-html-len={(html ?? "").length}
      />
    );
  }

  it("reports hasDescription=true when sanitised body is non-empty", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[b]Hi[/b]",
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(<HookProbe appid={42} />);
    expect(screen.getByTestId("probe").dataset.has).toBe("true");
  });

  it("reports hasDescription=false on a network error (parent suppresses toggle)", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(<HookProbe appid={42} />);
    expect(screen.getByTestId("probe").dataset.has).toBe("false");
  });

  it("reports hasDescription=false when bbcode is null", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: { appid: 42, bbcode: null },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(<HookProbe appid={42} />);
    expect(screen.getByTestId("probe").dataset.has).toBe("false");
  });

  it("strips overlap with the short description before sanitising", () => {
    // Short paraphrases the opening line — the dedupe pass should drop it,
    // leaving the unique sentence behind.
    vi.mocked(useGameDescription).mockReturnValue({
      data: {
        appid: 42,
        bbcode: [
          "Defeat the dragon king of Aldoria.",
          "",
          "Featuring 40 hours of branching narrative content.",
        ].join("\n"),
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(
      <HookProbe
        appid={42}
        shortDescription="Defeat the dragon king and save the realm of Aldoria."
      />
    );
    renderWithClient(
      <GameAboutBlock
        appid={42}
        shortDescription="Defeat the dragon king and save the realm of Aldoria."
      />
    );
    expect(screen.getAllByText(/Featuring 40 hours/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Defeat the dragon king/)).toBeNull();
  });

  it("leaves the body untouched when the short doesn't overlap (tagline case)", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: {
        appid: 42,
        bbcode: "Welcome to the void between stars, traveller.",
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(
      <GameAboutBlock
        appid={42}
        shortDescription="A roguelike deckbuilder for the cosmically curious."
      />
    );
    expect(screen.getByText(/Welcome to the void/)).toBeTruthy();
  });
});
