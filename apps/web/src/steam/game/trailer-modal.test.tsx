import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamGameTrailer } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrailerModal } from "./trailer-modal";

// Stub Shaka — the test environment is happy-dom which has no real
// MediaSource, and exercising the actual loader would race the dynamic
// import against the modal's unmount. The interesting assertions are
// "does the variant picker pick the right manifest" + "does the modal
// fall back correctly when there's no manifest" — both reachable without
// a real player.
vi.mock("shaka-player/dist/shaka-player.compiled", () => {
  class FakePlayer {
    attach = vi.fn().mockResolvedValue(undefined);
    load = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn().mockResolvedValue(undefined);
  }
  return { default: { Player: FakePlayer } };
});

// AV1 detect uses MediaSource.isTypeSupported which happy-dom doesn't
// expose — happens at module-load time, so without stubbing it the
// supportsAv1 cache is false. That's fine for these tests (we assert
// the non-AV1 path); the picker logic is covered separately in
// trailers.test.ts.

function trailer(overrides: Partial<SteamGameTrailer> = {}): SteamGameTrailer {
  return {
    trailerName: "Full Launch trailer",
    trailerCategory: 0,
    allAges: true,
    microtrailerWebm: "2050650/657549/abc/1750745214/microtrailer.webm",
    microtrailerMp4: "2050650/657549/abc/1750745214/microtrailer.mp4",
    screenshotMedium: "256998128/movie.293x165.jpg",
    screenshotFull: "256998128/movie_full.jpg",
    adaptiveTrailers: [
      {
        cdnPath: "2050650/657549/abc/1750745214/dash_h264.mpd",
        encoding: "dash_h264",
      },
      {
        cdnPath: "2050650/657549/abc/1750745214/hls_264_master.m3u8",
        encoding: "hls_h264",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  // Radix Dialog reads matchMedia; happy-dom has it as a no-op, so no
  // mock needed. Reset the doc body in case a prior test left an
  // open portal.
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TrailerModal", () => {
  it("renders nothing in the DOM when open=false", () => {
    render(<TrailerModal trailer={trailer()} open={false} onOpenChange={() => {}} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("renders the <video> + Shaka-fed variant when open with an adaptive manifest", () => {
    render(<TrailerModal trailer={trailer()} open={true} onOpenChange={() => {}} />);
    const video = document.querySelector("video");
    if (!video) throw new Error("video element not rendered");
    // Shaka path: no <source> tags on the video — Shaka attaches the
    // MediaSource itself. The src attribute stays empty until Shaka
    // loads, which the mock skips.
    expect(video.querySelectorAll("source").length).toBe(0);
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("uses screenshotFull as poster when present, falling back to medium", () => {
    const { rerender } = render(
      <TrailerModal trailer={trailer()} open={true} onOpenChange={() => {}} />
    );
    expect(document.querySelector("video")?.getAttribute("poster")).toContain(
      "/store_trailers/256998128/movie_full.jpg"
    );
    rerender(
      <TrailerModal
        trailer={trailer({ screenshotFull: null })}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(document.querySelector("video")?.getAttribute("poster")).toContain(
      "/store_trailers/256998128/movie.293x165.jpg"
    );
  });

  it("falls back to a static <video> with the microtrailer mp4 when no adaptive variants exist", () => {
    render(
      <TrailerModal
        trailer={trailer({ adaptiveTrailers: [] })}
        open={true}
        onOpenChange={() => {}}
      />
    );
    const video = document.querySelector("video");
    if (!video) throw new Error("fallback video not rendered");
    // Fallback path: <source> tag with the mp4, muted + looping (no
    // audio + no controls — degraded fallback).
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.hasAttribute("loop")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(false);
    const source = video.querySelector("source");
    expect(source?.getAttribute("type")).toBe("video/mp4");
    expect(source?.getAttribute("src")).toContain(
      "/store_trailers/2050650/657549/abc/1750745214/microtrailer.mp4"
    );
  });

  it("renders the poster image when neither adaptive variants nor microtrailer mp4 exist", () => {
    render(
      <TrailerModal
        trailer={trailer({ adaptiveTrailers: [], microtrailerMp4: null })}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(document.querySelector("video")).toBeNull();
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toContain(
      "/store_trailers/256998128/movie_full.jpg"
    );
    expect(img?.getAttribute("alt")).toBe("Full Launch trailer");
  });

  it("uses the publisher trailer name as the SR-only dialog title", () => {
    render(<TrailerModal trailer={trailer()} open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Full Launch trailer")).toBeTruthy();
  });

  it("falls back to a generic 'Trailer' label when trailerName is null", () => {
    render(
      <TrailerModal
        trailer={trailer({ trailerName: null })}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText("Trailer")).toBeTruthy();
  });

  it("fires onOpenChange(false) when the close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(<TrailerModal trailer={trailer()} open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByLabelText("Close trailer"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("collapses entrance + exit animations to hard cuts under prefers-reduced-motion", () => {
    render(
      <MotionConfig reducedMotion="always">
        <TrailerModal trailer={trailer()} open={true} onOpenChange={() => {}} />
      </MotionConfig>
    );
    const content = document.querySelector('[role="dialog"]');
    expect(content?.className).not.toContain("animate-in");
    expect(content?.className).toContain("opacity-100");
  });
});
