import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("renders the final value immediately in test mode (animation bypassed)", () => {
    render(<CountUp to={42} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("formats the value to the requested decimal precision", () => {
    render(<CountUp to={Math.PI} decimals={2} />);
    expect(screen.getByText("3.14")).toBeTruthy();
  });

  it("applies the className to the wrapping span", () => {
    const { container } = render(<CountUp to={5} className="font-mono" />);
    expect(container.querySelector("span")?.className).toContain("font-mono");
  });
});

// SHOULD_ANIMATE is a module-level const evaluated at import time, gated on
// import.meta.env.MODE. Re-import the module after stubbing MODE so the
// animation branch (otherwise dead under vitest) actually runs.
describe("CountUp animation branch (re-imported with MODE=production)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("starts at 0 and animates up to the target value, then cleans up on unmount", async () => {
    vi.stubEnv("MODE", "production");
    vi.resetModules();
    const { CountUp: AnimatedCountUp } = await import("./count-up");

    const { container, unmount } = render(<AnimatedCountUp to={100} duration={0.05} />);
    // Before the animation runs, display starts at 0.
    expect(container.querySelector("span")?.textContent).toBe("0");

    // Let motion drive the value to completion. With duration=0.05s a few
    // 60Hz frames is enough, but happy-dom doesn't run rAF on a real clock,
    // so we just wait macrotasks long enough for animate() to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    // After the animation, display reflects the target rounded to 0 decimals.
    expect(container.querySelector("span")?.textContent).toBe("100");

    // Unmount triggers the cleanup return that calls unsubscribe + controls.stop.
    expect(() => unmount()).not.toThrow();
  });

  it("rounds the in-flight display to the requested decimal precision", async () => {
    vi.stubEnv("MODE", "production");
    vi.resetModules();
    const { CountUp: AnimatedCountUp } = await import("./count-up");

    const { container } = render(
      <AnimatedCountUp to={Math.PI} decimals={2} duration={0.05} />
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    // The on("change") subscription rounds via the `factor = 10 ** decimals`
    // path; final display should be the target rounded to 2 decimals.
    expect(container.querySelector("span")?.textContent).toBe("3.14");
  });
});
