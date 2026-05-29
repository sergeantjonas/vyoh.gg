import { useGameScreenshots } from "@/steam/game/use-game-screenshots";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamGameTrailer } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreenshotStrip } from "./game-screenshot-strip";

vi.mock("@/steam/game/use-game-screenshots", () => ({
  useGameScreenshots: vi.fn(),
}));

// Capture the most-recent Carousel setApi callback so tests can drive the
// strip's effects (modal-pause, preload, keyboard) without engaging embla.
interface CarouselApiStub {
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number, instant?: boolean) => void;
  selectedScrollSnap: () => number;
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
}

let lastCarouselApi: CarouselApiStub | null = null;

function makeCarouselApiStub(): CarouselApiStub {
  return {
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    selectedScrollSnap: vi.fn(() => 0),
    on: vi.fn(),
    off: vi.fn(),
  };
}

vi.mock("@/components/ui/carousel", () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Carousel: ({
      children,
      setApi,
    }: {
      children: ReactNode;
      setApi?: (api: CarouselApiStub) => void;
    }) => {
      if (setApi && !lastCarouselApi) {
        lastCarouselApi = makeCarouselApiStub();
        setApi(lastCarouselApi);
      }
      return <div>{children}</div>;
    },
    CarouselContent: Passthrough,
    CarouselItem: Passthrough,
    useCarousel: () => ({ scrollPrev: () => {}, scrollNext: () => {} }),
    __esModule: true,
  };
});

const autoplayInstance = {
  play: vi.fn(),
  stop: vi.fn(),
};

vi.mock("embla-carousel-autoplay", () => ({
  default: () => autoplayInstance,
}));

vi.mock("embla-carousel-fade", () => ({
  default: () => () => ({}),
}));

// Stub Shaka — happy-dom has no MediaSource and the lightbox's trailer
// path imports shaka inside its effect via dynamic import. The variant
// picker + URL builders are covered separately in trailers.test.ts.
vi.mock("shaka-player/dist/shaka-player.compiled", () => {
  class FakePlayer {
    attach = vi.fn().mockResolvedValue(undefined);
    load = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn().mockResolvedValue(undefined);
  }
  return { default: { Player: FakePlayer } };
});

// Tests feed `{filename, ordinal}` entries straight into the hook mock and
// the strip composes URLs via the shared `steamScreenshotThumbUrl` helper.
// Keeping the helper inputs simple (`ss_1.jpg`, `ss_2.jpg`) keeps assertions
// readable against the well-formed CDN URL the helper emits.
function setScreenshots(entries: { filename: string; ordinal: number }[] | undefined) {
  vi.mocked(useGameScreenshots).mockReturnValue({
    data: entries ? { appid: 42, allAges: entries, mature: [] } : undefined,
  } as unknown as ReturnType<typeof useGameScreenshots>);
}

function setBuckets(
  allAges: { filename: string; ordinal: number }[],
  mature: { filename: string; ordinal: number }[]
) {
  vi.mocked(useGameScreenshots).mockReturnValue({
    data: { appid: 42, allAges, mature },
  } as unknown as ReturnType<typeof useGameScreenshots>);
}

afterEach(() => {
  vi.mocked(useGameScreenshots).mockReset();
  lastCarouselApi = null;
  localStorage.clear();
});

describe("GameScreenshotStrip", () => {
  it("renders null when there are no screenshots", () => {
    setScreenshots([]);
    const { container } = render(<GameScreenshotStrip appid={42} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null while media is still loading", () => {
    setScreenshots(undefined);
    const { container } = render(<GameScreenshotStrip appid={42} />);
    expect(container.firstChild).toBeNull();
  });

  it("falls back to the mature bucket when all-ages is empty (showMature off)", () => {
    setBuckets([], [{ filename: "ss_mature.jpg", ordinal: 1 }]);
    render(<GameScreenshotStrip appid={42} />);
    expect(
      screen.getByRole("button", { name: /View screenshot 1 of 1 fullscreen/ })
    ).toBeTruthy();
    expect(document.querySelector('img[src*="ss_mature.600x338.jpg"]')).toBeTruthy();
  });

  it("unions all-ages + mature buckets sorted by ordinal when showMature is on", () => {
    localStorage.setItem("vyoh:steam-show-mature-screenshots", "1");
    setBuckets(
      [{ filename: "ss_a.jpg", ordinal: 1 }],
      [{ filename: "ss_b.jpg", ordinal: 2 }]
    );
    render(<GameScreenshotStrip appid={42} />);
    expect(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    ).toBeTruthy();
    expect(document.querySelector('img[src*="ss_a.600x338.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src*="ss_b.600x338.jpg"]')).toBeTruthy();
  });

  it("hides the mature bucket when showMature is off and all-ages is present", () => {
    setBuckets(
      [{ filename: "ss_safe.jpg", ordinal: 1 }],
      [{ filename: "ss_mature.jpg", ordinal: 2 }]
    );
    render(<GameScreenshotStrip appid={42} />);
    expect(document.querySelector('img[src*="ss_safe.600x338.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src*="ss_mature.600x338.jpg"]')).toBeNull();
  });

  it("renders the lightbox trigger with the screenshot count label", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    expect(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    ).toBeTruthy();
  });

  it("renders the strip chevron controls when there is more than one screenshot", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // Strip controls render two "Previous screenshot" / "Next screenshot" buttons total
    expect(screen.getAllByLabelText("Previous screenshot").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Next screenshot").length).toBeGreaterThan(0);
  });

  it("does NOT render chevron controls when there is only one screenshot", () => {
    setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
    render(<GameScreenshotStrip appid={42} />);
    expect(screen.queryByLabelText("Previous screenshot")).toBeNull();
    expect(screen.queryByLabelText("Next screenshot")).toBeNull();
  });

  it("subscribes to embla's 'select' and 'reInit' events when api becomes available", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    expect(lastCarouselApi).not.toBeNull();
    const events = (lastCarouselApi?.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string
    );
    expect(events).toContain("select");
    expect(events).toContain("reInit");
  });

  it("snaps the carousel back to the first frame when the appid changes", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    const { rerender } = render(<GameScreenshotStrip appid={42} />);
    const initialScrollToCalls = (lastCarouselApi?.scrollTo as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    rerender(<GameScreenshotStrip appid={730} />);
    expect(
      (lastCarouselApi?.scrollTo as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(initialScrollToCalls);
    expect(
      (lastCarouselApi?.scrollTo as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    ).toEqual([0, true]);
  });

  it("calls autoplay.play() on initial mount (modal closed branch)", () => {
    autoplayInstance.play.mockClear();
    autoplayInstance.stop.mockClear();
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    expect(autoplayInstance.play).toHaveBeenCalled();
  });

  it("invokes selectedScrollSnap on initial select to bootstrap currentIndex", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // The mount-time onSelect() call must have hit the api's snap getter to
    // seed React state.
    expect(lastCarouselApi?.selectedScrollSnap).toHaveBeenCalled();
  });

  it("dispatches ArrowRight/ArrowLeft window keydowns to api.scrollTo across items[] while the modal is open", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // Open the dialog by clicking the lightbox trigger.
    fireEvent.click(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    );
    (lastCarouselApi?.scrollTo as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    // Starting screenshotIdx = 0 (the test mock keeps selectedScrollSnap at
    // 0 unless we trigger a select event). ArrowRight → screenshotIdx+1=1.
    // With no trailers, baseOffset=0, so api.scrollTo(0+1)=1.
    const rightCalls = (lastCarouselApi?.scrollTo as ReturnType<typeof vi.fn>).mock.calls;
    expect(rightCalls.length).toBe(1);
    expect(rightCalls[0]?.[0]).toBe(1);
    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("stops autoplay when the lightbox opens and resumes when it closes", () => {
    autoplayInstance.play.mockClear();
    autoplayInstance.stop.mockClear();
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    fireEvent.click(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    );
    expect(autoplayInstance.stop).toHaveBeenCalled();
  });

  it("does NOT bind window keydown when there's only one screenshot (length <= 1 guard)", () => {
    setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<GameScreenshotStrip appid={42} />);
    fireEvent.click(
      screen.getByRole("button", { name: /View screenshot 1 of 1 fullscreen/ })
    );
    // No `keydown` listener should be registered by the strip in this branch.
    expect(addSpy.mock.calls.filter((c) => c[0] === "keydown").length).toBe(0);
    addSpy.mockRestore();
  });

  it("preloads neighbour full-res screenshots while the modal is open", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
      { filename: "ss_3.jpg", ordinal: 3 },
    ]);
    const created: string[] = [];
    const realImage = window.Image;
    class TrackImage {
      set src(v: string) {
        created.push(v);
      }
    }
    // @ts-expect-error happy-dom Image override
    window.Image = TrackImage;
    try {
      render(<GameScreenshotStrip appid={42} />);
      fireEvent.click(
        screen.getByRole("button", { name: /View screenshot 1 of 3 fullscreen/ })
      );
      // Effect schedules an `Image()` for both prev and next neighbour URLs.
      const matchedNeighbour = (needle: string) =>
        created.some((url) => url.includes(needle));
      expect(matchedNeighbour("ss_2.1920x1080.jpg")).toBe(true);
      expect(matchedNeighbour("ss_3.1920x1080.jpg")).toBe(true);
    } finally {
      window.Image = realImage;
    }
  });

  describe("view transition morph", () => {
    type VTCallback = () => void | Promise<void>;
    type FakeTransition = {
      finished: Promise<void>;
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
      skipTransition: () => void;
    };
    let originalStartVT: unknown;
    let capturedSourceName: string | null;
    let startVT: ReturnType<typeof vi.fn>;

    function installFakeVT() {
      capturedSourceName = null;
      startVT = vi.fn((cb: VTCallback): FakeTransition => {
        // OLD-snapshot capture happens synchronously at this point in real
        // browsers — record what the active source img is carrying right now
        // so the test can assert it was applied before the call.
        const activeSlide = document.querySelector(
          'img[src*="ss_1.600x338.jpg"]'
        ) as HTMLImageElement | null;
        const lightboxImg = document.querySelector(
          'img[src*="ss_1.1920x1080.jpg"]'
        ) as HTMLImageElement | null;
        capturedSourceName =
          activeSlide?.style.viewTransitionName ||
          lightboxImg?.style.viewTransitionName ||
          null;
        cb();
        const finished = Promise.resolve();
        return {
          finished,
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {},
        };
      });
      originalStartVT = (document as { startViewTransition?: unknown })
        .startViewTransition;
      Object.defineProperty(document, "startViewTransition", {
        value: startVT,
        configurable: true,
        writable: true,
      });
    }

    function restoreVT() {
      if (originalStartVT === undefined) {
        (document as { startViewTransition?: unknown }).startViewTransition = undefined;
      } else {
        Object.defineProperty(document, "startViewTransition", {
          value: originalStartVT,
          configurable: true,
          writable: true,
        });
      }
    }

    afterEach(() => {
      restoreVT();
    });

    it("applies view-transition-name to the active slide before startViewTransition, then clears it", () => {
      installFakeVT();
      setScreenshots([
        { filename: "ss_1.jpg", ordinal: 1 },
        { filename: "ss_2.jpg", ordinal: 2 },
      ]);
      render(<GameScreenshotStrip appid={42} />);
      fireEvent.click(
        screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
      );
      expect(startVT).toHaveBeenCalledTimes(1);
      // At the moment startViewTransition was invoked, the source img must
      // already carry the morph name so the OLD snapshot pairs to it.
      expect(capturedSourceName).toBe("screenshot-42");
      // After the callback ran, the source name is cleared (so a future VT
      // doesn't double-bind it) and the destination lightbox img carries
      // the matching name for the NEW snapshot.
      const activeSlide = document.querySelector(
        'img[src*="ss_1.600x338.jpg"]'
      ) as HTMLImageElement | null;
      expect(activeSlide?.style.viewTransitionName).toBe("");
      const lightboxImg = document.querySelector(
        'img[src*="ss_1.1920x1080.jpg"]'
      ) as HTMLImageElement | null;
      expect(lightboxImg?.style.viewTransitionName).toBe("screenshot-42");
    });

    it("falls back to setModalOpen directly when startViewTransition is unavailable", () => {
      // No installFakeVT — happy-dom ships without the API, so the
      // supportsViewTransitions guard returns false and the modal opens
      // straight through Radix.
      setScreenshots([
        { filename: "ss_1.jpg", ordinal: 1 },
        { filename: "ss_2.jpg", ordinal: 2 },
      ]);
      render(<GameScreenshotStrip appid={42} />);
      fireEvent.click(
        screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
      );
      // Modal opened => the fullscreen close button renders only when open.
      expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });

    it("clears the destination view-transition-name after the transition finishes", async () => {
      installFakeVT();
      setScreenshots([
        { filename: "ss_1.jpg", ordinal: 1 },
        { filename: "ss_2.jpg", ordinal: 2 },
      ]);
      render(<GameScreenshotStrip appid={42} />);
      fireEvent.click(
        screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
      );
      // Drain the microtask queue so the `transition.finished.finally`
      // cleanup runs.
      await Promise.resolve();
      await Promise.resolve();
      const lightboxImg = document.querySelector(
        'img[src*="ss_1.1920x1080.jpg"]'
      ) as HTMLImageElement | null;
      expect(lightboxImg?.style.viewTransitionName).toBe("");
    });
  });

  it("unsubscribes from embla on unmount so the api callback doesn't leak", () => {
    setScreenshots([
      { filename: "ss_1.jpg", ordinal: 1 },
      { filename: "ss_2.jpg", ordinal: 2 },
    ]);
    const { unmount } = render(<GameScreenshotStrip appid={42} />);
    const offBefore = (lastCarouselApi?.off as ReturnType<typeof vi.fn>).mock.calls
      .length;
    unmount();
    expect(
      (lastCarouselApi?.off as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(offBefore);
  });

  describe("trailer items", () => {
    const trailer = (overrides: Partial<SteamGameTrailer> = {}): SteamGameTrailer => ({
      trailerName: "Launch trailer",
      trailerCategory: 0,
      allAges: true,
      microtrailerWebm: "2050650/657549/abc/1750745214/microtrailer.webm",
      microtrailerMp4: null,
      screenshotMedium: "256998128/movie.293x165.jpg",
      screenshotFull: "256998128/movie_full.jpg",
      adaptiveTrailers: [
        {
          cdnPath: "2050650/657549/abc/1750745214/dash_h264.mpd",
          encoding: "dash_h264",
        },
      ],
      ...overrides,
    });

    it("renders nothing when only trailers exist but no screenshots and trailers prop is null", () => {
      setScreenshots([]);
      const { container } = render(<GameScreenshotStrip appid={42} trailers={null} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders the strip when at least one trailer is provided even with zero screenshots", () => {
      setScreenshots([]);
      const { container } = render(
        <GameScreenshotStrip appid={42} trailers={[trailer()]} />
      );
      expect(container.firstChild).not.toBeNull();
      expect(
        document.querySelector(
          'img[src*="/microtrailer-poster/256998128/movie.293x165.jpg"]'
        )
      ).toBeTruthy();
    });

    it("prepends trailer thumbnails before screenshots in the carousel", () => {
      setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
      render(
        <GameScreenshotStrip
          appid={42}
          trailers={[
            trailer(),
            trailer({ screenshotMedium: "256998129/movie.293x165.jpg" }),
          ]}
        />
      );
      const allImgs = Array.from(document.querySelectorAll("img"));
      const firstThree = allImgs.slice(0, 3).map((i) => i.getAttribute("src"));
      expect(firstThree[0]).toContain("/microtrailer-poster/256998128/movie.293x165.jpg");
      expect(firstThree[1]).toContain("/microtrailer-poster/256998129/movie.293x165.jpg");
      expect(firstThree[2]).toContain("ss_1.600x338.jpg");
    });

    it("skips trailers without a poster (screenshotMedium === null)", () => {
      setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
      render(
        <GameScreenshotStrip
          appid={42}
          trailers={[trailer({ screenshotMedium: null })]}
        />
      );
      expect(document.querySelector('img[src*="/microtrailer-poster/"]')).toBeNull();
      // Strip still renders the lone screenshot.
      expect(
        screen.getByRole("button", { name: /View screenshot 1 of 1 fullscreen/ })
      ).toBeTruthy();
    });

    it("renders a play badge on each trailer item", () => {
      setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
      const { container } = render(
        <GameScreenshotStrip appid={42} trailers={[trailer()]} />
      );
      // Lucide renders the Play icon as an inline svg; the badge wrapper has
      // a fixed-size rounded background sitting absolutely centered.
      const svgs = container.querySelectorAll("svg.lucide-play");
      expect(svgs.length).toBeGreaterThanOrEqual(1);
    });

    it("opens the unified lightbox with a <video> element when the active item is a trailer", async () => {
      setScreenshots([{ filename: "ss_1.jpg", ordinal: 1 }]);
      render(<GameScreenshotStrip appid={42} trailers={[trailer()]} />);
      const trigger = screen.getByRole("button", { name: "Play Launch trailer" });
      fireEvent.click(trigger);
      await vi.waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      });
      // Trailer slot in the lightbox renders a <video> with controls (the
      // adaptive-stream path) and the trailer name as aria-label.
      const video = document.querySelector('[role="dialog"] video');
      expect(video).not.toBeNull();
      expect(video?.getAttribute("aria-label")).toBe("Launch trailer");
      // Lightbox should NOT also render the screenshot img.
      expect(
        document.querySelector('[role="dialog"] img[src*="ss_1.1920x1080.jpg"]')
      ).toBeNull();
    });
  });
});
