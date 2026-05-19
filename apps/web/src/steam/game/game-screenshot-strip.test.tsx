import { useGameMedia } from "@/steam/library/use-game-media";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreenshotStrip } from "./game-screenshot-strip";

vi.mock("@/steam/library/use-game-media", () => ({
  useGameMedia: vi.fn(),
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

function setMedia(screenshots: { thumbUrl: string; fullUrl: string }[] | undefined) {
  vi.mocked(useGameMedia).mockReturnValue({
    data: screenshots ? { screenshots } : undefined,
  } as unknown as ReturnType<typeof useGameMedia>);
}

afterEach(() => {
  vi.mocked(useGameMedia).mockReset();
  lastCarouselApi = null;
});

describe("GameScreenshotStrip", () => {
  it("renders null when there are no screenshots", () => {
    setMedia([]);
    const { container } = render(<GameScreenshotStrip appid={42} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null while media is still loading", () => {
    setMedia(undefined);
    const { container } = render(<GameScreenshotStrip appid={42} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the lightbox trigger with the screenshot count label", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    expect(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    ).toBeTruthy();
  });

  it("renders the strip chevron controls when there is more than one screenshot", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // Strip controls render two "Previous screenshot" / "Next screenshot" buttons total
    expect(screen.getAllByLabelText("Previous screenshot").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Next screenshot").length).toBeGreaterThan(0);
  });

  it("does NOT render chevron controls when there is only one screenshot", () => {
    setMedia([{ thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" }]);
    render(<GameScreenshotStrip appid={42} />);
    expect(screen.queryByLabelText("Previous screenshot")).toBeNull();
    expect(screen.queryByLabelText("Next screenshot")).toBeNull();
  });

  it("subscribes to embla's 'select' and 'reInit' events when api becomes available", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
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
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
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
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    expect(autoplayInstance.play).toHaveBeenCalled();
  });

  it("invokes selectedScrollSnap on initial select to bootstrap currentIndex", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // The mount-time onSelect() call must have hit the api's snap getter to
    // seed React state.
    expect(lastCarouselApi?.selectedScrollSnap).toHaveBeenCalled();
  });

  it("dispatches ArrowRight/ArrowLeft window keydowns to api.scrollNext/scrollPrev while the modal is open", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    // Open the dialog by clicking the lightbox trigger.
    fireEvent.click(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    );
    (lastCarouselApi?.scrollNext as ReturnType<typeof vi.fn>).mockClear();
    (lastCarouselApi?.scrollPrev as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(lastCarouselApi?.scrollNext).toHaveBeenCalled();
    expect(lastCarouselApi?.scrollPrev).toHaveBeenCalled();
  });

  it("stops autoplay when the lightbox opens and resumes when it closes", () => {
    autoplayInstance.play.mockClear();
    autoplayInstance.stop.mockClear();
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    render(<GameScreenshotStrip appid={42} />);
    fireEvent.click(
      screen.getByRole("button", { name: /View screenshot 1 of 2 fullscreen/ })
    );
    expect(autoplayInstance.stop).toHaveBeenCalled();
  });

  it("does NOT bind window keydown when there's only one screenshot (length <= 1 guard)", () => {
    setMedia([{ thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" }]);
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
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
      { thumbUrl: "/t3.jpg", fullUrl: "/f3.jpg" },
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
      expect(created).toEqual(expect.arrayContaining(["/f2.jpg", "/f3.jpg"]));
    } finally {
      window.Image = realImage;
    }
  });

  it("unsubscribes from embla on unmount so the api callback doesn't leak", () => {
    setMedia([
      { thumbUrl: "/t1.jpg", fullUrl: "/f1.jpg" },
      { thumbUrl: "/t2.jpg", fullUrl: "/f2.jpg" },
    ]);
    const { unmount } = render(<GameScreenshotStrip appid={42} />);
    const offBefore = (lastCarouselApi?.off as ReturnType<typeof vi.fn>).mock.calls
      .length;
    unmount();
    expect(
      (lastCarouselApi?.off as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(offBefore);
  });
});
