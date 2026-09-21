import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelativeTime } from "./relative-time";

// The timestamps from the report that prompted this: a Steam profile opened at
// 00:47Z kept rendering "33m ago" and "checked just now" thirteen hours later.
const OPENED_AT = new Date("2026-09-21T00:47:00Z");
const LAST_PLAYED = "2026-09-21T00:14:00Z";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

describe("RelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(OPENED_AT);
    setVisibility("visible");
  });
  afterEach(() => vi.useRealTimers());

  it("ages while the page stays open rather than freezing at first render", () => {
    render(<RelativeTime iso={LAST_PLAYED} />);
    expect(screen.getByText("33m ago")).toBeTruthy();

    act(() => vi.advanceTimersByTime(13 * 60 * 60_000));

    expect(screen.getByText("13h ago")).toBeTruthy();
  });

  it("steps on the minute the string changes, not before it", () => {
    render(<RelativeTime iso={LAST_PLAYED} />);

    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.getByText("33m ago")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("34m ago")).toBeTruthy();
  });

  // Past an hour the units coarsen, so waking once a minute would be 59
  // re-renders that cannot change anything.
  it("sleeps until the next hour once the gap is measured in hours", () => {
    render(<RelativeTime iso={LAST_PLAYED} />);
    act(() => vi.advanceTimersByTime(2 * 60 * 60_000));
    expect(screen.getByText("2h ago")).toBeTruthy();

    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("2h ago")).toBeTruthy();
  });

  it("waits out the whole week once the string is counting weeks", () => {
    render(<RelativeTime iso={LAST_PLAYED} />);
    act(() => vi.advanceTimersByTime(8 * 24 * 60 * 60_000));
    expect(screen.getByText("1w ago")).toBeTruthy();

    act(() => vi.advanceTimersByTime(5 * 24 * 60 * 60_000));
    expect(screen.getByText("1w ago")).toBeTruthy();

    act(() => vi.advanceTimersByTime(24 * 60 * 60_000));
    expect(screen.getByText("2w ago")).toBeTruthy();
  });

  // A sleeping machine stops firing timers entirely, so the wake-up that should
  // have stepped the string never ran — the overnight case from the report.
  it("re-reads the clock when a hidden tab becomes visible again", () => {
    render(<RelativeTime iso={LAST_PLAYED} />);
    expect(screen.getByText("33m ago")).toBeTruthy();

    setVisibility("hidden");
    vi.setSystemTime(new Date("2026-09-21T14:00:00Z"));
    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("13h ago")).toBeTruthy();
  });

  it("stops ticking once unmounted", () => {
    const { unmount } = render(<RelativeTime iso={LAST_PLAYED} />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
