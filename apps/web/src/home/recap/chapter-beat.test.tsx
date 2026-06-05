import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// ChapterBeat reads its nudge state from ChapterGroup via context. Tests
// run ChapterBeat in isolation (no surrounding ChapterGroup), so we mock
// the context-reading hook to control the nudge value per test.
const nudgeState = vi.hoisted(() => ({ nudged: false }));
vi.mock("./chapter-group", () => ({
  useChapterBeatNudge: () => nudgeState.nudged,
}));

import { ChapterBeat } from "./chapter-beat";

describe("ChapterBeat (sticky-stage slot)", () => {
  it("renders a [data-beat-body] wrapper carrying beat index, slug, ariaLabel, and consumer className", () => {
    nudgeState.nudged = false;
    const { container } = render(
      <ChapterBeat
        index={2}
        slug="ahri-stats"
        ariaLabel="Ahri stats beat"
        className="px-6"
      >
        <span data-testid="content">hi</span>
      </ChapterBeat>
    );
    const wrapper = container.querySelector("[data-beat-body]");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute("data-beat")).toBe("2");
    expect(wrapper?.getAttribute("data-beat-slug")).toBe("ahri-stats");
    expect(wrapper?.getAttribute("aria-label")).toBe("Ahri stats beat");
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("h-full");
    expect(wrapper?.className).toContain("w-full");
    expect(wrapper?.className).toContain("px-6");
  });

  it("invokes the render-prop child with nudged=false when ChapterGroup has not flipped it", () => {
    nudgeState.nudged = false;
    const fn = vi.fn(
      (nudged: boolean): ReactNode => (
        <span data-testid="rp">nudged={String(nudged)}</span>
      )
    );
    const { getByTestId } = render(<ChapterBeat index={0}>{fn}</ChapterBeat>);
    expect(getByTestId("rp").textContent).toBe("nudged=false");
    expect(fn).toHaveBeenCalledWith(false);
  });

  it("invokes the render-prop child with nudged=true when ChapterGroup has flipped it", () => {
    nudgeState.nudged = true;
    const fn = vi.fn(
      (nudged: boolean): ReactNode => (
        <span data-testid="rp">nudged={String(nudged)}</span>
      )
    );
    const { getByTestId } = render(<ChapterBeat index={0}>{fn}</ChapterBeat>);
    expect(getByTestId("rp").textContent).toBe("nudged=true");
    expect(fn).toHaveBeenCalledWith(true);
  });

  it("renders static children as-is when no render-prop is passed", () => {
    nudgeState.nudged = false;
    const { getByTestId } = render(
      <ChapterBeat index={0}>
        <span data-testid="static">static</span>
      </ChapterBeat>
    );
    expect(getByTestId("static")).toBeTruthy();
  });

  it("does NOT carry the legacy snap / 130dvh / sticky geometry — orchestration is now in ChapterGroup", () => {
    nudgeState.nudged = false;
    const { container } = render(
      <ChapterBeat index={0}>
        <span>x</span>
      </ChapterBeat>
    );
    const wrapper = container.querySelector("[data-beat-body]");
    expect(wrapper?.className).not.toContain("scroll-snap-align");
    expect(wrapper?.className).not.toContain("h-[130dvh]");
    expect(wrapper?.className).not.toContain("sticky");
    // The legacy data attributes from the prior architectures are also gone.
    expect(wrapper?.hasAttribute("data-beat-inner")).toBe(false);
    expect(wrapper?.hasAttribute("data-beat-wrapper")).toBe(false);
    expect(wrapper?.hasAttribute("data-beat-zone")).toBe(false);
  });
});
