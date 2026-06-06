import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamScreenshotEntry } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";
import { ScreenshotLightboxStrip } from "./screenshot-lightbox";

const SCREENSHOTS: SteamScreenshotEntry[] = Array.from({ length: 3 }, (_, i) => ({
  filename: `steam/apps/367520/ss_${i}.jpg`,
  ordinal: i,
}));

describe("ScreenshotLightboxStrip", () => {
  it("renders one trigger button per screenshot", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    expect(screen.getAllByRole("button", { name: /Open screenshot/ })).toHaveLength(3);
  });

  it("renders nothing when the list is empty", () => {
    const { container } = render(
      <ScreenshotLightboxStrip appid={367520} screenshots={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens a dialog at the clicked index", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 2 of 3" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("steps forward with Next and wraps at the end", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 3 of 3" }));
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("steps backward with Previous and wraps at the start", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 1 of 3" }));
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("steps with the arrow keys while the dialog is open", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 2 of 3" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("hides prev/next chevrons when there is only one screenshot", () => {
    render(
      <ScreenshotLightboxStrip
        appid={367520}
        screenshots={[SCREENSHOTS[0] as SteamScreenshotEntry]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 1 of 1" }));
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  describe("filmstrip marquee", () => {
    afterEach(() => {
      vi.mocked(useReducedMotion).mockReset();
      vi.mocked(useReducedMotion).mockReturnValue(false);
    });

    it("renders a marquee track with running animation when the beat is active", () => {
      const { container } = render(
        <ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} nudged={true} />
      );
      const track = container.querySelector<HTMLElement>("[data-screenshot-marquee]");
      expect(track).toBeTruthy();
      // Marquee animation runs by default; pause states (hover, nudged
      // off, reduced motion) override via inline style.
      expect(track?.style.animationPlayState).toBe("running");
      // Animation string set on the wrapper.
      expect(track?.style.animation).toContain("recap-marquee");
    });

    it("pauses the marquee while the beat hasn't been nudged into view", () => {
      const { container } = render(
        <ScreenshotLightboxStrip
          appid={367520}
          screenshots={SCREENSHOTS}
          nudged={false}
        />
      );
      const track = container.querySelector<HTMLElement>("[data-screenshot-marquee]");
      expect(track?.style.animationPlayState).toBe("paused");
    });

    it("pauses the marquee on pointer-enter and resumes on pointer-leave", () => {
      const { container } = render(
        <ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} nudged={true} />
      );
      const wrapper = container.querySelector<HTMLElement>(
        "[data-screenshot-marquee]"
      )?.parentElement;
      expect(wrapper).toBeTruthy();
      fireEvent.pointerEnter(wrapper as HTMLElement);
      let track = container.querySelector<HTMLElement>("[data-screenshot-marquee]");
      expect(track?.style.animationPlayState).toBe("paused");
      fireEvent.pointerLeave(wrapper as HTMLElement);
      track = container.querySelector<HTMLElement>("[data-screenshot-marquee]");
      expect(track?.style.animationPlayState).toBe("running");
    });

    it("renders the marquee duplicate set as aria-hidden so AT and tests see only the original buttons", () => {
      const { container } = render(
        <ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} nudged={true} />
      );
      // Original buttons are queryable; the clone's `<span>` thumbnails
      // are not buttons and the clone `<ul>` carries aria-hidden, so the
      // accessible tree only exposes the three original buttons.
      expect(screen.getAllByRole("button", { name: /Open screenshot/ })).toHaveLength(3);
      // Two ul siblings inside the marquee track — the original + the
      // aria-hidden clone.
      const lists = container.querySelectorAll("[data-screenshot-marquee] > ul");
      expect(lists.length).toBe(2);
      expect(lists[0]?.getAttribute("aria-hidden")).toBeNull();
      expect(lists[1]?.getAttribute("aria-hidden")).toBe("true");
    });

    it("renders no marquee and no duplicate under prefers-reduced-motion", () => {
      vi.mocked(useReducedMotion).mockReturnValue(true);
      const { container } = render(
        <ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} nudged={true} />
      );
      // No marquee track under reduced motion — the fallback path
      // renders a single scrollable ul instead.
      expect(container.querySelector("[data-screenshot-marquee]")).toBeNull();
      // Only one ul (no aria-hidden duplicate).
      expect(container.querySelectorAll("ul").length).toBe(1);
      // Buttons still queryable + lightbox still wires up.
      expect(screen.getAllByRole("button", { name: /Open screenshot/ })).toHaveLength(3);
    });

    it("renders contact-sheet index labels (S01, S02 …) under each thumb", () => {
      render(
        <ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} nudged={true} />
      );
      // Labels in the original visible set — getAllByText handles the
      // case where the clone might also render the same label (those are
      // aria-hidden but text still in DOM).
      expect(screen.getAllByText("S01").length).toBeGreaterThan(0);
      expect(screen.getAllByText("S02").length).toBeGreaterThan(0);
      expect(screen.getAllByText("S03").length).toBeGreaterThan(0);
    });
  });
});
