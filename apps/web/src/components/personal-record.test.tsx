import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalRecord } from "./personal-record";

const STORAGE_PREFIX = "vyoh:pr:";

function getPersisted(key: string): string | null {
  return localStorage.getItem(STORAGE_PREFIX + key);
}

function getWrapper(): HTMLSpanElement {
  const el = document.querySelector(".pr-flare");
  if (!(el instanceof HTMLSpanElement)) {
    throw new Error("PersonalRecord wrapper not found");
  }
  return el;
}

describe("PersonalRecord", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    localStorage.clear();
  });

  it("does NOT fire on first mount when there is no prior value", () => {
    render(
      <PersonalRecord storageKey="kda-jinx" value={4.2} direction="higher-better">
        <span>4.2</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
    expect(screen.queryByLabelText("New personal best")).toBeNull();
  });

  it("persists the first observed value as the baseline even when not firing", () => {
    render(
      <PersonalRecord storageKey="kda-baseline" value={3.1} direction="higher-better">
        <span>3.1</span>
      </PersonalRecord>
    );
    expect(getPersisted("kda-baseline")).toBe("3.1");
  });

  it("fires when the value improves on a higher-better stat", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-up`, "3");
    render(
      <PersonalRecord storageKey="kda-up" value={5} direction="higher-better">
        <span>5</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("true");
    expect(screen.getByLabelText("New personal best")).toBeTruthy();
    expect(getPersisted("kda-up")).toBe("5");
  });

  it("fires when the value improves on a lower-better stat", () => {
    localStorage.setItem(`${STORAGE_PREFIX}fastest-win`, "1500");
    render(
      <PersonalRecord storageKey="fastest-win" value={1200} direction="lower-better">
        <span>1200</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("true");
    expect(getPersisted("fastest-win")).toBe("1200");
  });

  it("does NOT fire when the value equals the prior best", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-eq`, "4");
    render(
      <PersonalRecord storageKey="kda-eq" value={4} direction="higher-better">
        <span>4</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
    expect(screen.queryByLabelText("New personal best")).toBeNull();
  });

  it("does NOT fire and does NOT overwrite when the value is worse than the prior best", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-worse`, "5");
    render(
      <PersonalRecord storageKey="kda-worse" value={3} direction="higher-better">
        <span>3</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
    // The "best ever" must not be clobbered by a non-record value.
    expect(getPersisted("kda-worse")).toBe("5");
  });

  it("prevents replay across remounts at the same value (persisted prior == next)", () => {
    const { unmount } = render(
      <PersonalRecord storageKey="kda-replay" value={6} direction="higher-better">
        <span>6</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
    expect(getPersisted("kda-replay")).toBe("6");
    unmount();

    render(
      <PersonalRecord storageKey="kda-replay" value={6} direction="higher-better">
        <span>6</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
  });

  it("clears the fire flag after the flare hold window", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-decay`, "3");
    render(
      <PersonalRecord storageKey="kda-decay" value={5} direction="higher-better">
        <span>5</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("true");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(getWrapper().dataset.recordFire).toBe("false");
  });

  it("removes the badge after the longer badge hold window", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-badge`, "3");
    render(
      <PersonalRecord storageKey="kda-badge" value={5} direction="higher-better">
        <span>5</span>
      </PersonalRecord>
    );
    expect(screen.getByLabelText("New personal best")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Flare has decayed but the affordance lingers long enough to be read.
    expect(screen.getByLabelText("New personal best")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByLabelText("New personal best")).toBeNull();
  });

  it("ignores non-finite values (NaN, Infinity) without firing or persisting", () => {
    render(
      <PersonalRecord storageKey="kda-nan" value={Number.NaN} direction="higher-better">
        <span>NaN</span>
      </PersonalRecord>
    );
    expect(getWrapper().dataset.recordFire).toBe("false");
    expect(getPersisted("kda-nan")).toBeNull();
  });

  it("treats a corrupted localStorage entry as no prior", () => {
    localStorage.setItem(`${STORAGE_PREFIX}kda-corrupt`, "not-a-number");
    render(
      <PersonalRecord storageKey="kda-corrupt" value={4} direction="higher-better">
        <span>4</span>
      </PersonalRecord>
    );
    // No fire (no valid prior), but the entry is rewritten to a valid baseline.
    expect(getWrapper().dataset.recordFire).toBe("false");
    expect(getPersisted("kda-corrupt")).toBe("4");
  });

  it("merges a className prop into the flare wrapper", () => {
    render(
      <PersonalRecord
        storageKey="kda-class"
        value={4}
        direction="higher-better"
        className="text-3xl"
      >
        <span>4</span>
      </PersonalRecord>
    );
    expect(getWrapper().className).toContain("text-3xl");
    expect(getWrapper().className).toContain("pr-flare");
  });
});
