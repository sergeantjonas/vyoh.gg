import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LiveMatch, SteamPlayerState } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconDot } from "./use-favicon-dot";

const DEFAULT_HREF = "/vyoh-orb-favicon.svg";
const BADGED = "data:image/png;base64,badged";

// happy-dom ships no canvas backend and no image loader, so the two browser
// APIs the badge is drawn with have to be stood up here. The assertions are
// about which fill lands on the dot, not about the pixels.
let fills: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  #src = "";
  get src() {
    return this.#src;
  }
  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      this.complete = true;
      this.onload?.();
    });
  }
}

function makeContext() {
  return {
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    set fillStyle(value: string) {
      fills.push(value);
    },
  };
}

let getContext: ReturnType<typeof vi.fn>;

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function faviconHref() {
  return document.querySelector<HTMLLinkElement>("link[rel='icon']")?.href;
}

beforeEach(() => {
  fills = [];
  vi.stubGlobal("Image", FakeImage);
  getContext = vi.fn(() => makeContext());
  HTMLCanvasElement.prototype.getContext =
    getContext as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => BADGED);
  const link = document.createElement("link");
  link.rel = "icon";
  link.setAttribute("href", DEFAULT_HREF);
  document.head.append(link);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const el of document.querySelectorAll("link[rel='icon']")) el.remove();
});

describe("useFaviconDot", () => {
  it("badges the favicon green while a Steam game is running", async () => {
    const client = new QueryClient();
    client.setQueryData<SteamPlayerState>(["steam", "player-state"], {
      currentGame: { appid: 1, name: "NIGHTREIGN" },
    } as SteamPlayerState);

    renderHook(() => useFaviconDot(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(faviconHref()).toContain(BADGED));
    expect(fills).toContain("#22c55e");
  });

  it("treats any live LoL account as live, with no Steam state at all", async () => {
    const client = new QueryClient();
    client.setQueryData<LiveMatch | null>(["lol", "live", "ahri"], {
      gameId: 1,
    } as LiveMatch);

    renderHook(() => useFaviconDot(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(fills).toContain("#22c55e"));
  });

  it("leaves the favicon alone when nothing is running", async () => {
    const client = new QueryClient();
    client.setQueryData<LiveMatch | null>(["lol", "live", "ahri"], null);

    renderHook(() => useFaviconDot(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(getContext).not.toHaveBeenCalled());
    expect(faviconHref()).toContain(DEFAULT_HREF);
  });

  // The blue dot is the whole point of the "just finished" window: it has to
  // outlive the query going empty, and then clear itself without another
  // cache event to ride on.
  it("holds a blue dot for a minute after the game ends, then restores", async () => {
    const client = new QueryClient();
    client.setQueryData<SteamPlayerState>(["steam", "player-state"], {
      currentGame: { appid: 1, name: "NIGHTREIGN" },
    } as SteamPlayerState);

    renderHook(() => useFaviconDot(), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(fills).toContain("#22c55e"));

    vi.useFakeTimers();
    client.setQueryData<SteamPlayerState>(["steam", "player-state"], {
      currentGame: null,
    } as SteamPlayerState);

    await vi.waitFor(() => expect(fills).toContain("#60a5fa"));
    expect(faviconHref()).toContain(BADGED);

    vi.advanceTimersByTime(60_000);
    expect(faviconHref()).toContain(DEFAULT_HREF);
  });

  it("restores the default favicon on unmount", async () => {
    const client = new QueryClient();
    client.setQueryData<SteamPlayerState>(["steam", "player-state"], {
      currentGame: { appid: 1, name: "NIGHTREIGN" },
    } as SteamPlayerState);

    const { unmount } = renderHook(() => useFaviconDot(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(faviconHref()).toContain(BADGED));

    unmount();
    expect(faviconHref()).toContain(DEFAULT_HREF);
  });

  it("falls back to the plain favicon when the canvas has no 2d context", async () => {
    getContext.mockReturnValue(null);
    // Seeded with a badge so the fallback has something to undo — asserting
    // against the default href from the default href proves nothing.
    document.querySelector("link[rel='icon']")?.setAttribute("href", BADGED);
    const client = new QueryClient();
    client.setQueryData<SteamPlayerState>(["steam", "player-state"], {
      currentGame: { appid: 1, name: "NIGHTREIGN" },
    } as SteamPlayerState);

    renderHook(() => useFaviconDot(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(faviconHref()).toContain(DEFAULT_HREF));
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });
});
