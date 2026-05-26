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

// Default to "no reduce motion" so the html branch renders <video>.
// Individual tests override via mockReturnValueOnce.
vi.mock("motion/react", () => ({
  useReducedMotion: vi.fn(() => false),
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

  it("prefers rendered html over bbcode when both are present and renders <video>", () => {
    const hash = "b2d503549e33e6603c86b6bd7babdb38";
    const payload: SteamGameDescription = {
      appid: 1245620,
      bbcode: "[b]bbcode fallback[/b]",
      html: `<h2>About</h2><video autoplay muted loop playsinline poster="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${hash}.poster.avif"><source src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${hash}.webm" type="video/webm"></video>`,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={1245620} />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("poster")).toBe(
      `http://localhost:2010/img/steam/desc/1245620/extras/${hash}.poster.avif`
    );
    expect(video?.getAttribute("preload")).toBe("metadata");
    const source = container.querySelector("video source");
    expect(source?.getAttribute("src")).toBe(
      `http://localhost:2010/img/steam/desc/1245620/extras/${hash}.webm`
    );
    expect(container.textContent).not.toContain("bbcode fallback");
  });

  it("swaps <video> for an <img> using the poster under prefers-reduced-motion", async () => {
    const { useReducedMotion } = await import("motion/react");
    vi.mocked(useReducedMotion).mockReturnValueOnce(true);
    const hash = "b2d503549e33e6603c86b6bd7babdb38";
    const payload: SteamGameDescription = {
      appid: 1245620,
      bbcode: null,
      html: `<video autoplay poster="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${hash}.poster.avif" width="780" height="320"><source src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${hash}.webm" type="video/webm"></video>`,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={1245620} />);
    expect(container.querySelector("video")).toBeNull();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      `http://localhost:2010/img/steam/desc/1245620/extras/${hash}.poster.avif`
    );
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
    expect(img?.getAttribute("width")).toBe("780");
    expect(img?.getAttribute("height")).toBe("320");
  });

  it("caps rendered media at the editorial limit", () => {
    const hash = "b2d503549e33e6603c86b6bd7babdb38";
    const sources = Array.from({ length: 8 }, () => hash);
    const videos = sources
      .map(
        (h) =>
          `<video autoplay poster="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/extras/${h}.poster.avif"><source src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/extras/${h}.webm" type="video/webm"></video>`
      )
      .join("");
    const payload: SteamGameDescription = {
      appid: 1,
      bbcode: null,
      html: `<p>Intro</p>${videos}<p>Outro</p>`,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={1} />);
    expect(container.querySelectorAll("video").length).toBe(5);
    expect(container.textContent).toContain("Intro");
  });

  it("adds loading=lazy + decoding=async to inline <img> in the html branch", () => {
    const payload: SteamGameDescription = {
      appid: 1245620,
      bbcode: null,
      html: '<p>x</p><img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/b2d503549e33e6603c86b6bd7babdb38.poster.avif" alt="frame">',
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={1245620} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
  });

  it("falls back to bbcode rendering when html is null", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[b]bbcode fallback[/b]",
      html: null,
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.querySelector("strong")?.textContent).toBe("bbcode fallback");
  });

  it("falls back to bbcode when html is the terminal empty-string sentinel", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: "[b]bbcode body[/b]",
      html: "",
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.querySelector("strong")?.textContent).toBe("bbcode body");
  });

  it("drops non-extras image URLs from the rendered html branch", () => {
    const payload: SteamGameDescription = {
      appid: 42,
      bbcode: null,
      html: '<p>Body</p><img src="https://publisher.example.com/promo.jpg" alt="promo">',
    };
    vi.mocked(useGameDescription).mockReturnValue({
      data: payload,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useGameDescription>);

    const { container } = renderWithClient(<GameAboutBlock appid={42} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Body");
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
