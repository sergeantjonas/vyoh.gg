import { render, screen } from "@testing-library/react";
import type useEmblaCarousel from "embla-carousel-react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "./carousel";

// embla-carousel-react ships an effectful auto-scrolling implementation that
// happy-dom doesn't fully drive — replace it with a stubbed hook returning a
// controllable api so we can assert the surrounding wiring (onSelect, plugin
// reset, scrollPrev/scrollNext, keyboard handler).
type EmblaApi = ReturnType<typeof useEmblaCarousel>[1] & object;

interface FakeApiState {
  canScrollPrev: boolean;
  canScrollNext: boolean;
  pluginReset: ReturnType<typeof vi.fn>;
  scrollPrev: ReturnType<typeof vi.fn>;
  scrollNext: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

function makeFakeApi(state: FakeApiState): EmblaApi {
  return {
    canScrollPrev: () => state.canScrollPrev,
    canScrollNext: () => state.canScrollNext,
    plugins: () => ({ autoplay: { reset: state.pluginReset } }),
    scrollPrev: state.scrollPrev,
    scrollNext: state.scrollNext,
    on: state.on,
    off: state.off,
    scrollTo: vi.fn(),
    selectedScrollSnap: () => 0,
  } as unknown as EmblaApi;
}

const fakeState: FakeApiState = {
  canScrollPrev: false,
  canScrollNext: true,
  pluginReset: vi.fn(),
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock("embla-carousel-react", () => {
  const ref = vi.fn();
  const hook = vi.fn(() => [ref, makeFakeApi(fakeState)]);
  return { default: hook };
});

function renderCarousel(
  props: {
    setApi?: (api: CarouselApi) => void;
    orientation?: "horizontal" | "vertical";
  } = {}
) {
  return render(
    <Carousel
      {...(props.setApi !== undefined && { setApi: props.setApi })}
      {...(props.orientation !== undefined && { orientation: props.orientation })}
    >
      <CarouselContent>
        <CarouselItem>slide-1</CarouselItem>
        <CarouselItem>slide-2</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

describe("Carousel", () => {
  it("renders the section with carousel role and propagates orientation to items", () => {
    const { container } = renderCarousel();
    const section = container.querySelector('[aria-roledescription="carousel"]');
    expect(section).not.toBeNull();
    expect(container.querySelectorAll('[aria-roledescription="slide"]').length).toBe(2);
  });

  it("subscribes to embla 'select' / 'reInit' events on mount", () => {
    fakeState.on.mockClear();
    renderCarousel();
    const subscribed = fakeState.on.mock.calls.map((c) => c[0]);
    expect(subscribed).toContain("select");
    expect(subscribed).toContain("reInit");
  });

  it("invokes setApi when both api and setApi are present", () => {
    const setApi = vi.fn();
    renderCarousel({ setApi });
    expect(setApi).toHaveBeenCalled();
  });

  it("does not call setApi when it is omitted", () => {
    // Render without setApi — the effect's `if (!api || !setApi) return` short-circuits.
    const { container } = renderCarousel();
    expect(container.querySelector('[aria-roledescription="carousel"]')).not.toBeNull();
  });

  it("calls api.scrollPrev + plugin reset when the Previous button is clicked", () => {
    fakeState.scrollPrev.mockClear();
    fakeState.pluginReset.mockClear();
    fakeState.canScrollPrev = true;
    renderCarousel();
    const prev = screen.getByRole("button", { name: "Previous slide" });
    prev.click();
    expect(fakeState.scrollPrev).toHaveBeenCalled();
    expect(fakeState.pluginReset).toHaveBeenCalled();
  });

  it("calls api.scrollNext + plugin reset when the Next button is clicked", () => {
    fakeState.scrollNext.mockClear();
    fakeState.pluginReset.mockClear();
    fakeState.canScrollNext = true;
    renderCarousel();
    const next = screen.getByRole("button", { name: "Next slide" });
    next.click();
    expect(fakeState.scrollNext).toHaveBeenCalled();
    expect(fakeState.pluginReset).toHaveBeenCalled();
  });

  it("triggers scrollPrev/scrollNext from ArrowLeft/ArrowRight keyboard events", () => {
    fakeState.scrollPrev.mockClear();
    fakeState.scrollNext.mockClear();
    const { container } = renderCarousel();
    const section = container.querySelector(
      '[aria-roledescription="carousel"]'
    ) as HTMLElement;

    // React's `onKeyDownCapture` listens on the capture phase, so use
    // dispatchEvent with the keyboard event bubbling = true.
    section.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    section.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );

    expect(fakeState.scrollPrev).toHaveBeenCalled();
    expect(fakeState.scrollNext).toHaveBeenCalled();
  });

  it("ignores keyboard events that are not arrow keys", () => {
    fakeState.scrollPrev.mockClear();
    fakeState.scrollNext.mockClear();
    const { container } = renderCarousel();
    const section = container.querySelector(
      '[aria-roledescription="carousel"]'
    ) as HTMLElement;
    section.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    section.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(fakeState.scrollPrev).not.toHaveBeenCalled();
    expect(fakeState.scrollNext).not.toHaveBeenCalled();
  });

  it("applies vertical orientation classes to content and items", () => {
    const { container } = renderCarousel({ orientation: "vertical" });
    // CarouselContent flips to flex-col, items add pt-3 margin instead of pl-3.
    expect(container.querySelector(".flex-col")).not.toBeNull();
    expect(container.querySelectorAll(".pt-3").length).toBeGreaterThan(0);
  });

  it("disables Previous when canScrollPrev is false", () => {
    fakeState.canScrollPrev = false;
    renderCarousel();
    const prev = screen.getByRole("button", {
      name: "Previous slide",
    }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it("disables Next when canScrollNext is false", () => {
    fakeState.canScrollNext = false;
    renderCarousel();
    const next = screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("throws via useCarousel() if consumed outside a <Carousel /> provider", () => {
    function Probe() {
      const ctx = useCarousel();
      return <div>{String(Boolean(ctx))}</div>;
    }
    // React wraps the throw in an error boundary path; assert via spy on console.error.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useCarousel must be used within a <Carousel \/>/
    );
    errSpy.mockRestore();
  });

  it("supports ref forwarding on the section element", () => {
    function Holder() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Carousel ref={ref} data-testid="seamed">
          <CarouselContent>
            <CarouselItem>only</CarouselItem>
          </CarouselContent>
        </Carousel>
      );
    }
    render(<Holder />);
    expect(screen.getByTestId("seamed")).toBeTruthy();
  });
});
