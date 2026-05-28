import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SteamGameTrailer } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { GameHeroTrailerPill } from "./game-hero-trailer-pill";

// Stub the modal child — the pill's job is to gate, render an affordance,
// and toggle the modal's open state. The modal's own behavior is covered
// in trailer-modal.test.tsx.
vi.mock("./trailer-modal", () => ({
  TrailerModal: ({
    open,
    onOpenChange,
    trailer,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    trailer: SteamGameTrailer;
  }) =>
    open ? (
      <div data-testid="trailer-modal-stub" data-trailer-name={trailer.trailerName}>
        <button type="button" onClick={() => onOpenChange(false)}>
          stub-close
        </button>
      </div>
    ) : null,
}));

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
    ],
    ...overrides,
  };
}

describe("GameHeroTrailerPill", () => {
  it("renders nothing when no trailer is set", () => {
    const { container } = render(<GameHeroTrailerPill trailer={null} />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders the Preview pill with a play affordance", () => {
    const { container } = render(<GameHeroTrailerPill trailer={trailer()} />);
    const button = container.querySelector("button");
    if (!button) throw new Error("pill button not rendered");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-label")).toBe("Play Full Launch trailer");
    expect(button.textContent).toContain("Preview");
  });

  it("does not mount the modal until the pill is clicked", () => {
    render(<GameHeroTrailerPill trailer={trailer()} />);
    expect(screen.queryByTestId("trailer-modal-stub")).toBeNull();
  });

  it("mounts the TrailerModal with the provided trailer on click", async () => {
    render(<GameHeroTrailerPill trailer={trailer()} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Full Launch trailer" }));
    const modal = await waitFor(() => screen.getByTestId("trailer-modal-stub"));
    expect(modal.dataset.trailerName).toBe("Full Launch trailer");
  });

  it("falls back to 'Trailer' on the aria-label when the publisher name is null", () => {
    render(<GameHeroTrailerPill trailer={trailer({ trailerName: null })} />);
    expect(screen.getByRole("button", { name: "Play Trailer" })).toBeTruthy();
  });

  it("unmounts the modal subtree when its onOpenChange flips to false", async () => {
    render(<GameHeroTrailerPill trailer={trailer()} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Full Launch trailer" }));
    await waitFor(() => screen.getByTestId("trailer-modal-stub"));
    fireEvent.click(screen.getByText("stub-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("trailer-modal-stub")).toBeNull();
    });
  });
});
