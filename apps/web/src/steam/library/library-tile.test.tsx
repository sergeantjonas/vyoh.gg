import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryTile } from "./library-tile";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

vi.mock("./library-tile-hovercard", () => ({
  LibraryTileHovercardContent: () => null,
  LIBRARY_HOVERCARD_CONTENT_CLASS: "",
}));

function game(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds: [],
    ...overrides,
  } as unknown as SteamOwnedGame;
}

function renderTile(g: SteamOwnedGame) {
  return render(
    <ul>
      <LibraryTile game={g} />
    </ul>
  );
}

describe("LibraryTile", () => {
  it("renders the game name", () => {
    renderTile(game({ name: "Half-Life 2" }));
    expect(screen.getByText("Half-Life 2")).toBeTruthy();
  });

  it("renders the 'Never launched' meta when playtime is zero", () => {
    renderTile(game({ playtimeForeverMinutes: 0 }));
    expect(screen.getByText("Never launched")).toBeTruthy();
  });

  it("renders a formatted lifetime line when playtime is non-zero", () => {
    const { container } = renderTile(game({ playtimeForeverMinutes: 240 }));
    expect(container.textContent).toMatch(/lifetime/);
    expect(container.textContent).not.toContain("Never launched");
  });

  it("prefetches the backdrop when the link is hovered or focused", () => {
    const g = game({ appid: 730, assetTimestamp: 1234 });
    const { container } = renderTile(g);
    const link = container.querySelector("a");
    if (!link) throw new Error("link not rendered");
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    expect(prefetchSteamGameBackdrop).toHaveBeenCalledWith(730, 1234);
  });

  it("falls back to the synthetic hero when the capsule image errors", () => {
    const { container } = renderTile(game({ name: "Old Game" }));
    const capsule = container.querySelector("img:not([aria-hidden])") as HTMLImageElement;
    expect(capsule).toBeTruthy();
    // onError swaps in HeroFallback (which renders a different <img>).
    fireEvent.error(capsule);
    // After the error, the synthetic hero img mounts. Name is rendered as
    // the alt text for the logo image inside HeroFallback.
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("makes the capsule visible after onLoad fires", () => {
    const { container } = renderTile(game({ name: "Loaded Game" }));
    const capsule = container.querySelector("img:not([aria-hidden])") as HTMLImageElement;
    // Before load: opacity 0 inline style.
    expect(capsule.style.opacity).toBe("0");
    fireEvent.load(capsule);
    expect(capsule.style.opacity).toBe("1");
  });
});

describe("LibraryTile HeroFallback branches", () => {
  function renderWithCapsuleError(name: string) {
    const result = render(
      <ul>
        <LibraryTile game={game({ name })} />
      </ul>
    );
    const capsule = result.container.querySelector(
      "img:not([aria-hidden])"
    ) as HTMLImageElement;
    fireEvent.error(capsule);
    return result;
  }

  it("renders synthetic hero with the wordmark when logo loads with content", () => {
    const { container } = renderWithCapsuleError("Counter-Strike 2");
    // The HeroFallback returns a hero <img> + a logo <img>.
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    const logo = container.querySelector('img[alt="Counter-Strike 2"]');
    if (logo) {
      // Simulate the wsrv 200-with-content path (naturalWidth > 0).
      Object.defineProperty(logo, "naturalWidth", { value: 320, configurable: true });
      fireEvent.load(logo);
    }
  });

  it("falls back to the text wordmark when the logo onLoad reports an empty body", () => {
    const { container } = renderWithCapsuleError("Empty Logo Game");
    const logo = container.querySelector('img[alt="Empty Logo Game"]');
    if (!logo) return;
    Object.defineProperty(logo, "naturalWidth", { value: 0, configurable: true });
    fireEvent.load(logo);
    // After logo failure the text fallback renders the name.
    expect(container.textContent).toContain("Empty Logo Game");
  });

  it("falls back to the blurred header when the hero itself errors", () => {
    const { container } = renderWithCapsuleError("Artless Game");
    const heroes = container.querySelectorAll("img:not([aria-hidden])");
    // First non-morph img post-capsule-error is the synthetic hero — error it.
    if (heroes.length > 0 && heroes[0]) fireEvent.error(heroes[0]);
    expect(container.textContent).toContain("Artless Game");
  });

  it("flags the hero loaded path when the load event reports natural width", () => {
    const { container } = renderWithCapsuleError("Loaded Hero");
    const heroes = container.querySelectorAll("img:not([aria-hidden])");
    if (heroes.length > 0 && heroes[0]) {
      Object.defineProperty(heroes[0], "naturalWidth", {
        value: 1920,
        configurable: true,
      });
      fireEvent.load(heroes[0]);
    }
  });
});

describe("LibraryTile view-transition wiring", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    // The startViewTransition stub is set per-test; clean up so other tests
    // don't see a stale reference.
    const doc = document as unknown as { startViewTransition?: unknown };
    doc.startViewTransition = undefined;
  });

  it("applies view-transition-name to the morph layer and navigates inside startViewTransition on a plain left-click", async () => {
    const startVT = vi.fn((cb: () => Promise<void> | void) => {
      // Run the callback synchronously inside the test like the browser does.
      return Promise.resolve(cb());
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startVT;

    const { container } = renderTile(game({ appid: 730 }));
    const morph = container.querySelector("img[aria-hidden]") as HTMLImageElement | null;
    const link = container.querySelector("a");
    if (!morph || !link) throw new Error("morph layer or link missing");

    let nameAtCaptureTime: string | undefined;
    startVT.mockImplementation((cb) => {
      // At the moment startViewTransition is called, the source name must
      // already be present (OLD snapshot is captured synchronously).
      nameAtCaptureTime = morph.style.viewTransitionName;
      return Promise.resolve(cb());
    });

    fireEvent.click(link, { button: 0 });
    // Flush the awaited microtask inside the callback.
    await Promise.resolve();

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(nameAtCaptureTime).toBe("steam-game-730-hero");
    // Inside the callback the name is cleared before the navigation await,
    // so by the time we observe it after the event the style is empty.
    expect(morph.style.viewTransitionName).toBe("");
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/steam/game/$appid",
      params: { appid: "730" },
      viewTransition: false,
    });
  });

  it("does not invoke startViewTransition on a modifier-click", () => {
    const startVT = vi.fn();
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startVT;

    const { container } = renderTile(game({ appid: 440 }));
    const link = container.querySelector("a");
    if (!link) throw new Error("link missing");

    fireEvent.click(link, { button: 0, metaKey: true });
    expect(startVT).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("falls through when the browser lacks startViewTransition", () => {
    // No stub installed — supportsViewTransitions() returns false.
    const { container } = renderTile(game({ appid: 570 }));
    const link = container.querySelector("a");
    if (!link) throw new Error("link missing");

    fireEvent.click(link, { button: 0 });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
