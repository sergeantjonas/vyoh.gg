import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { SteamGameDescription } from "@vyoh/shared";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameAboutBlock } from "./game-about-block";
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

describe("GameAboutBlock", () => {
  it("renders a card-shaped skeleton while the query is pending", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.querySelector("[aria-busy]")).toBeTruthy();
  });

  it("renders nothing when the description is null (DLC / bundle / unresolved app)", () => {
    const payload: SteamGameDescription = { appid: 42, bbcode: null, html: null };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the 'About this game' heading + sanitised HTML when BBCode is present", async () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[h1]Game Title[/h1]\n\n[b]Bold[/b] paragraph.",
      html: null,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    renderWithClient(<GameAboutBlock appid={42} />);
    await waitFor(() => {
      expect(screen.getByText("About this game")).toBeTruthy();
    });
    expect(screen.getByText("Game Title").tagName).toBe("H1");
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
  });

  it("drops [img] tags via the rewriteImgSrc=null hook (no <img> rendered)", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[img]https://steamcdn-a.akamaihd.net/foo.jpg[/img]\n\nText.",
      html: null,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/Text\./)).toBeTruthy();
  });

  it("renders nothing on a network error", () => {
    vi.mocked(useGameDescription).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.firstChild).toBeNull();
  });
});
