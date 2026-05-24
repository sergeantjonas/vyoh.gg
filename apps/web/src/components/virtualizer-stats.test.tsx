import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VirtualizerStats } from "./virtualizer-stats";

const STORAGE_KEY = "vyoh:perf";

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

describe("VirtualizerStats", () => {
  it("renders nothing when the perf flag is off", () => {
    const { container } = render(<VirtualizerStats rendered={5} total={100} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders rendered/total/saved when the perf flag is on via localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<VirtualizerStats rendered={20} total={100} />);
    expect(screen.getByText("rendered")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("total")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("saved")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("renders the optional lane count for grid virtualizers", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<VirtualizerStats rendered={20} total={100} lanes={5} />);
    expect(screen.getByText("lanes")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("collapses the saved-percent to an em-dash when total is 0", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<VirtualizerStats rendered={0} total={0} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
