import { useGameMedia } from "@/steam/library/use-game-media";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreenshotStrip } from "./game-screenshot-strip";

vi.mock("@/steam/library/use-game-media", () => ({
  useGameMedia: vi.fn(),
}));

// Embla's plugin interface is intricate enough that a hand-rolled mock crashes
// the reactive-utils setup. Mock the entire Carousel wrapper instead so the
// strip's own render branches can be exercised without engaging embla.
vi.mock("@/components/ui/carousel", () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Carousel: Passthrough,
    CarouselContent: Passthrough,
    CarouselItem: Passthrough,
    useCarousel: () => ({ scrollPrev: () => {}, scrollNext: () => {} }),
    __esModule: true,
  };
});

vi.mock("embla-carousel-autoplay", () => ({
  default: () => () => ({}),
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
});
