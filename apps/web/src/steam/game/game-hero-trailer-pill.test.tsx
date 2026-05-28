import { fireEvent, render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { GameHeroTrailerPill } from "./game-hero-trailer-pill";

function props(overrides: Partial<Parameters<typeof GameHeroTrailerPill>[0]> = {}) {
  return {
    microtrailerWebm: "367520/2090056095/abc/microtrailer.webm",
    microtrailerMp4: "367520/2090056095/abc/microtrailer.mp4",
    microtrailerPoster: "367520/extras/launch_trailer_medium.jpg",
    microtrailerName: "Full Launch trailer",
    ...overrides,
  } satisfies Parameters<typeof GameHeroTrailerPill>[0];
}

describe("GameHeroTrailerPill", () => {
  it("renders nothing when no microtrailer is set", () => {
    const { container } = render(
      <GameHeroTrailerPill {...props({ microtrailerWebm: null })} />
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders nothing when the stored filename is malformed (URL builder rejects)", () => {
    const { container } = render(
      <GameHeroTrailerPill {...props({ microtrailerWebm: "not-a-valid-path" })} />
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders the pill closed by default with the Play affordance", () => {
    const { container } = render(<GameHeroTrailerPill {...props()} />);
    const button = container.querySelector("button");
    if (!button) throw new Error("pill button not rendered");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Play Full Launch trailer");
    expect(button.textContent).toContain("Preview");
    expect(container.querySelector("video")).toBeNull();
  });

  it("mounts the looping <video> on click and toggles the pill to the Hide affordance", () => {
    const { container } = render(<GameHeroTrailerPill {...props()} />);
    const button = container.querySelector("button");
    if (!button) throw new Error("pill button not rendered");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Hide Full Launch trailer");
    expect(button.textContent).toContain("Hide preview");
    const video = container.querySelector("video");
    if (!video) throw new Error("video not rendered after click");
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.hasAttribute("loop")).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.getAttribute("aria-label")).toBe("Full Launch trailer");
    const sources = video.querySelectorAll("source");
    expect(sources.length).toBe(2);
    expect(sources[0]?.getAttribute("type")).toBe("video/webm");
    expect(sources[1]?.getAttribute("type")).toBe("video/mp4");
  });

  it("unmounts the video on a second click (dismiss)", () => {
    const { container } = render(<GameHeroTrailerPill {...props()} />);
    const button = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(container.querySelector("video")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("falls back to the 'Trailer' aria-label when the publisher name is null", () => {
    const { container } = render(
      <GameHeroTrailerPill {...props({ microtrailerName: null })} />
    );
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Play Trailer");
  });

  it("omits the mp4 source when only the webm filename is set", () => {
    const { container } = render(
      <GameHeroTrailerPill {...props({ microtrailerMp4: null })} />
    );
    fireEvent.click(container.querySelector("button") as HTMLButtonElement);
    const sources = container.querySelectorAll("video source");
    expect(sources.length).toBe(1);
    expect(sources[0]?.getAttribute("type")).toBe("video/webm");
  });

  it("collapses the crossfade to a hard cut under prefers-reduced-motion", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <GameHeroTrailerPill {...props()} />
      </MotionConfig>
    );
    fireEvent.click(container.querySelector("button") as HTMLButtonElement);
    const video = container.querySelector("video");
    if (!video) throw new Error("video not rendered");
    // Hard cut: opacity-100 only, no `animate-in fade-in-0` enter class chain.
    expect(video.className).toContain("opacity-100");
    expect(video.className).not.toContain("fade-in-0");
  });
});
