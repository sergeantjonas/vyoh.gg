import { render, screen } from "@testing-library/react";
import type { SteamScreenshotEntry } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SteamChapterCloserMedia } from "./steam-chapter-closer-media";

// Microtrailer fixtures match the upstream shape (`appid/depot/.../microtrailer.{webm,mp4}`).
// These exact paths are exercised by `steamMicrotrailerUrl` / `steamMicrotrailerPosterUrl`
// in `steam-image.test.ts` — reused here so the URL composition is consistent
// with the rest of the Steam asset pipeline.
const microtrailerWebm = "2050650/657549/abc/1750745214/microtrailer.webm";
const microtrailerMp4 = "2050650/657549/abc/1750745214/microtrailer.mp4";
const microtrailerPoster = "256998128/movie.293x165.jpg";

const screenshots: SteamScreenshotEntry[] = [
  { id: 1, filename: "ss_1.jpg" },
  { id: 2, filename: "ss_2.jpg" },
  { id: 3, filename: "ss_3.jpg" },
] as unknown as SteamScreenshotEntry[];

function withMotion(ui: React.ReactNode, reducedMotion: "always" | "never" = "never") {
  return <MotionConfig reducedMotion={reducedMotion}>{ui}</MotionConfig>;
}

beforeEach(() => {
  // happy-dom's HTMLMediaElement doesn't implement play/pause; stub them so
  // the per-flip effect doesn't throw or warn.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SteamChapterCloserMedia (R-10 trailer slot)", () => {
  it("renders a looping microtrailer when one is available and motion is allowed", () => {
    render(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={microtrailerWebm}
          microtrailerMp4={microtrailerMp4}
          microtrailerPoster={microtrailerPoster}
          microtrailerName="Launch trailer"
          active
        />
      )
    );
    const video = screen.getByLabelText("Launch trailer") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    // `playsInline` is a real DOM property in browsers but happy-dom
    // doesn't implement it — verify the attribute landed instead. The
    // browser path uses the JSX prop directly so this attribute-check
    // is a faithful proxy for the real-world behavior.
    expect(video.hasAttribute("playsinline")).toBe(true);
    // Poster proxied through the image-server URL helper. Read the
    // attribute directly because happy-dom doesn't implement the
    // `video.poster` reflection.
    expect(video.getAttribute("poster")).toContain("/img/steam/microtrailer-poster/");
    // Two source elements (webm then mp4).
    const sources = video.querySelectorAll("source");
    expect(sources.length).toBe(2);
    expect(sources[0]?.type).toBe("video/webm");
    expect(sources[1]?.type).toBe("video/mp4");
  });

  it("plays the trailer when active flips on and pauses+resets when active flips off", () => {
    const { rerender } = render(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={microtrailerWebm}
          microtrailerMp4={null}
          microtrailerPoster={null}
          microtrailerName={null}
          active={false}
        />
      )
    );
    const video = screen.getByLabelText("") as HTMLVideoElement;
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    rerender(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={microtrailerWebm}
          microtrailerMp4={null}
          microtrailerPoster={null}
          microtrailerName={null}
          active
        />
      )
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    rerender(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={microtrailerWebm}
          microtrailerMp4={null}
          microtrailerPoster={null}
          microtrailerName={null}
          active={false}
        />
      )
    );
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    // After flipping inactive, currentTime is reset so the next entrance
    // starts at the first frame.
    expect(video.currentTime).toBe(0);
  });

  it("falls back to the screenshot strip when no microtrailer exists", () => {
    render(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={null}
          microtrailerMp4={null}
          microtrailerPoster={null}
          microtrailerName={null}
          active
        />
      )
    );
    // Screenshot strip renders <img> elements with thumb URLs; no <video>.
    expect(screen.queryByRole("video")).toBeNull();
    const imgs = document.querySelectorAll('img[src*="cloudflare.steamstatic.com"]');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("falls back to the screenshot strip under reduced motion even when a trailer is available", () => {
    render(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={screenshots}
          microtrailerWebm={microtrailerWebm}
          microtrailerMp4={microtrailerMp4}
          microtrailerPoster={microtrailerPoster}
          microtrailerName="Launch trailer"
          active
        />,
        "always"
      )
    );
    // Trailer suppressed; screenshot fallback renders.
    expect(screen.queryByLabelText("Launch trailer")).toBeNull();
    const imgs = document.querySelectorAll('img[src*="cloudflare.steamstatic.com"]');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("renders nothing when there is no trailer and no screenshots", () => {
    const { container } = render(
      withMotion(
        <SteamChapterCloserMedia
          appid={2050650}
          screenshots={[]}
          microtrailerWebm={null}
          microtrailerMp4={null}
          microtrailerPoster={null}
          microtrailerName={null}
          active
        />
      )
    );
    expect(container.firstChild).toBeNull();
  });

  it("falls back to the screenshot strip on data-saver connections", () => {
    // Mock Network Information API to indicate saveData. Restored by
    // afterEach via vi.restoreAllMocks.
    const originalConnection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    try {
      render(
        withMotion(
          <SteamChapterCloserMedia
            appid={2050650}
            screenshots={screenshots}
            microtrailerWebm={microtrailerWebm}
            microtrailerMp4={microtrailerMp4}
            microtrailerPoster={microtrailerPoster}
            microtrailerName="Launch trailer"
            active
          />
        )
      );
      expect(screen.queryByLabelText("Launch trailer")).toBeNull();
      const imgs = document.querySelectorAll('img[src*="cloudflare.steamstatic.com"]');
      expect(imgs.length).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: originalConnection,
      });
    }
  });
});
