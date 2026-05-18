import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { type MatchDetailTabId, MatchDetailTabs } from "./match-detail-tabs";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to: _to,
    params: _params,
    replace: _replace,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    replace?: boolean;
    [key: string]: unknown;
  }) => <a {...(props as Record<string, string>)}>{children}</a>,
}));

const BASE = { accountSlug: "ahri", matchId: "EUW1_123" } as const;

function renderTabs(active: MatchDetailTabId) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchDetailTabs {...BASE} active={active} />
    </MotionConfig>
  );
}

describe("MatchDetailTabs", () => {
  it("renders all three tab labels", () => {
    renderTabs("recap");
    expect(screen.getByRole("tab", { name: "Recap" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Your game" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Timeline" })).not.toBeNull();
  });

  it("marks the active tab with aria-selected=true", () => {
    renderTabs("your-game");
    expect(
      screen.getByRole("tab", { name: "Your game" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.getByRole("tab", { name: "Recap" }).getAttribute("aria-selected")).toBe(
      "false"
    );
    expect(
      screen.getByRole("tab", { name: "Timeline" }).getAttribute("aria-selected")
    ).toBe("false");
  });

  it("updates active selection when prop changes", () => {
    const { rerender } = renderTabs("recap");
    expect(screen.getByRole("tab", { name: "Recap" }).getAttribute("aria-selected")).toBe(
      "true"
    );

    rerender(
      <MotionConfig reducedMotion="always">
        <MatchDetailTabs {...BASE} active="timeline" />
      </MotionConfig>
    );
    expect(
      screen.getByRole("tab", { name: "Timeline" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.getByRole("tab", { name: "Recap" }).getAttribute("aria-selected")).toBe(
      "false"
    );
  });
});
