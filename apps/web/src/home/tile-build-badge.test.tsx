import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TileBuildBadge } from "./tile-build-badge";

const NOW = new Date("2026-05-19T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TileBuildBadge", () => {
  it("renders the build commit and a relative deploy timestamp", () => {
    render(<TileBuildBadge />);
    expect(screen.getByText("Last deploy")).toBeTruthy();
    // __BUILD_COMMIT__ is injected by vite.config.ts at test setup time.
    expect(screen.getByText(__BUILD_COMMIT__)).toBeTruthy();
  });

  it("renders 'just now' when the deploy was less than a minute ago", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() + 30_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("just now")).toBeTruthy();
  });

  it("renders minutes ago when within the hour", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() + 5 * 60_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("5m ago")).toBeTruthy();
  });

  it("renders hours ago when within the day", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() + 3 * 60 * 60_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("3h ago")).toBeTruthy();
  });

  it("renders days ago when between a day and a month", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() + 5 * 86_400_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("5d ago")).toBeTruthy();
  });

  it("renders months ago when at least 30 days old", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() + 60 * 86_400_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("2mo ago")).toBeTruthy();
  });

  it("falls back to 'just now' for a future build time (clock skew)", () => {
    vi.setSystemTime(new Date(new Date(__BUILD_TIME__).getTime() - 60_000));
    render(<TileBuildBadge />);
    expect(screen.getByText("just now")).toBeTruthy();
  });
});
