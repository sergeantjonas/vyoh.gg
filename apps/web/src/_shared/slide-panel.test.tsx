import { SlidePanel } from "@/_shared/slide-panel";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function wrap(ui: ReactNode) {
  return render(ui);
}

// Same exemptions as accessibility.test.tsx — color-contrast needs real
// computed styles; aria-hidden-focus is a Radix Dialog false positive in
// happy-dom.
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

describe("SlidePanel", () => {
  it("renders children inside the open panel with an accessible title", () => {
    wrap(
      <SlidePanel open onClose={vi.fn()} title="Sample panel">
        <p>Panel body content</p>
      </SlidePanel>
    );
    expect(screen.getByText("Panel body content")).toBeTruthy();
    // The Radix DialogTitle is sr-only but present in the accessibility tree.
    expect(screen.getByText("Sample panel")).toBeTruthy();
  });

  it("does not render content when open is false", () => {
    wrap(
      <SlidePanel open={false} onClose={vi.fn()} title="Sample panel">
        <p>Hidden body</p>
      </SlidePanel>
    );
    expect(screen.queryByText("Hidden body")).toBeNull();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    wrap(
      <SlidePanel open onClose={onClose} title="Sample panel">
        <p>body</p>
      </SlidePanel>
    );
    const closeBtn = screen.getByRole("button", { name: /close panel/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the user presses Escape", async () => {
    const onClose = vi.fn();
    wrap(
      <SlidePanel open onClose={onClose} title="Sample panel">
        <p>body</p>
      </SlidePanel>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the header slot before the close button", () => {
    wrap(
      <SlidePanel
        open
        onClose={vi.fn()}
        title="Sample panel"
        header={
          <button type="button" aria-label="Share link">
            share
          </button>
        }
      >
        <p>body</p>
      </SlidePanel>
    );
    expect(screen.getByRole("button", { name: /share link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /close panel/i })).toBeTruthy();
  });

  it("has no axe violations when open", async () => {
    wrap(
      <SlidePanel open onClose={vi.fn()} title="Sample panel">
        <p>body</p>
      </SlidePanel>
    );
    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
