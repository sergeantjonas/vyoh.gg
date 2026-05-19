import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TileDomainAge } from "./tile-domain-age";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TileDomainAge", () => {
  it("renders 'Live for 1 day' on the day after launch", () => {
    vi.setSystemTime(new Date("2026-05-07T12:00:00.000Z"));
    render(<TileDomainAge />);
    expect(screen.getByText("Domain age")).toBeTruthy();
    expect(screen.getByText("Live for 1 day")).toBeTruthy();
    expect(screen.getByText("First commit 2026-05-06")).toBeTruthy();
  });

  it("renders plural 'days' once past day 1", () => {
    vi.setSystemTime(new Date("2026-05-19T00:00:00.000Z"));
    render(<TileDomainAge />);
    expect(screen.getByText("Live for 13 days")).toBeTruthy();
  });

  it("clamps to 0 days when the clock is before the launch date", () => {
    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));
    render(<TileDomainAge />);
    expect(screen.getByText("Live for 0 days")).toBeTruthy();
  });
});
