import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { NotFound } from "./not-found";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("NotFound", () => {
  it("renders the apology copy and a back-home link", () => {
    render(
      <MotionConfig reducedMotion="always">
        <NotFound />
      </MotionConfig>
    );
    expect(screen.getByText("No such page.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Back home" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/");
  });
});
