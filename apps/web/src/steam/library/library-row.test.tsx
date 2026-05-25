import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { LibraryRow } from "./library-row";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

// profile-backdrop's prefetch import has side-effects; mock to keep tests pure.
vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

function makeGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: null,
    assetUrlFormat: null,
    assetTimestamp: null,
    libraryCapsulePath: null,
    libraryCapsule2xPath: null,
    libraryHeroPath: null,
    libraryHero2xPath: null,
    headerPath: null,
    heroCapsulePath: null,
    logoPath: null,
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: null,
    shortDescription: null,
    steamDeckCompat: null,
    platformWindows: null,
    platformMac: null,
    platformLinux: null,
    platformVr: null,
    reviewSummary: null,
    gameRating: null,
    publisherNames: [],
    developerNames: [],
    franchiseNames: [],
    subjectXPercent: null,
    subjectYPercent: null,
    ...overrides,
  };
}

const NOW_ISO = "2026-05-19T12:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("LibraryRow", () => {
  it("renders the game name (as logo alt) and 'Never launched' when no playtime is recorded", () => {
    render(<LibraryRow game={makeGame({ name: "Half-Life 2" })} />);
    // Name lives on the logo wordmark img's alt (see SteamGameRowShell).
    expect(screen.getByAltText("Half-Life 2")).toBeTruthy();
    expect(screen.getByText("Never launched")).toBeTruthy();
  });

  it("renders lifetime in hours when playtimeForeverMinutes is set", () => {
    const { container } = render(
      <LibraryRow game={makeGame({ playtimeForeverMinutes: 6000 })} />
    );
    // 6000m / 60 = 100h
    expect(container.textContent).toContain("100h lifetime");
  });

  it("appends 'last two weeks' marker when the 2-week field is non-zero", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: 120,
        })}
      />
    );
    expect(container.textContent).toContain("100h lifetime");
    expect(container.textContent).toContain("2h last two weeks");
  });

  it("suppresses the 'last played' hint when the 2-week marker is set (avoids duplicate signals)", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: 120,
          rtimeLastPlayedAt: "2026-05-18T00:00:00Z",
        })}
      />
    );
    expect(container.textContent).not.toMatch(/last played/);
  });

  it("renders the 'last played' hint for cold rows when 2-week is null", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: null,
          // 180 days ago
          rtimeLastPlayedAt: "2025-11-20T12:00:00Z",
        })}
      />
    );
    expect(container.textContent).toMatch(/last played .*months ago/);
  });

  it("stamps `library-row-${appid}` as view-transition-name on the li so sort/filter reorders pair OLD↔NEW", () => {
    const { container } = render(<LibraryRow game={makeGame({ appid: 12345 })} />);
    const li = container.querySelector("li");
    if (!li) throw new Error("li missing");
    expect(li.style.viewTransitionName).toBe("library-row-12345");
  });
});

describe("LibraryRow view-transition wiring", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    const doc = document as unknown as { startViewTransition?: unknown };
    doc.startViewTransition = undefined;
  });

  it("applies hero + logo view-transition-names on a plain left-click and clears them inside the callback", async () => {
    const startVT = vi.fn();
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startVT;

    const { container } = render(<LibraryRow game={makeGame({ appid: 730 })} />);
    const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
    // SteamGameRowShell renders imgs in order: [cover hero (heroRef), logo
    // (logoRef)]. The cover composition has no separate palette backdrop
    // layer.
    const [hero, logo] = imgs;
    const link = container.querySelector("a");
    if (!hero || !logo || !link) throw new Error("expected hero + logo imgs and a link");

    const namesAtCaptureTime: Record<string, string> = {};
    startVT.mockImplementation((cb: () => Promise<void> | void) => {
      // OLD-snapshot capture is synchronous with the startViewTransition call,
      // so each morph anchor must already carry its name at this point.
      namesAtCaptureTime.hero = hero.style.viewTransitionName;
      namesAtCaptureTime.logo = logo.style.viewTransitionName;
      return Promise.resolve(cb());
    });

    fireEvent.click(link, { button: 0 });
    await Promise.resolve();

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(namesAtCaptureTime).toEqual({
      hero: "steam-game-730-hero",
      logo: "steam-game-730-logo",
    });
    // Both cleared inside the callback before the navigate await so
    // neither collides with the destination's matching names at
    // NEW-snapshot capture (would silently drop one of the morph pairs).
    expect(hero.style.viewTransitionName).toBe("");
    expect(logo.style.viewTransitionName).toBe("");
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

    const { container } = render(<LibraryRow game={makeGame({ appid: 440 })} />);
    const link = container.querySelector("a");
    if (!link) throw new Error("link missing");

    fireEvent.click(link, { button: 0, metaKey: true });
    expect(startVT).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("falls through when the browser lacks startViewTransition", () => {
    const { container } = render(<LibraryRow game={makeGame({ appid: 570 })} />);
    const link = container.querySelector("a");
    if (!link) throw new Error("link missing");

    fireEvent.click(link, { button: 0 });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
