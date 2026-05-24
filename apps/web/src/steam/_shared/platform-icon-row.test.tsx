import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { PlatformIconRow } from "./platform-icon-row";

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

describe("PlatformIconRow", () => {
  it("renders three glyphs when win/mac/linux all resolved (true or false)", () => {
    const { container } = renderWithTooltip(
      <PlatformIconRow windows={true} mac={false} linux={true} vr={false} />
    );
    expect(screen.getByLabelText("Windows: supported")).toBeTruthy();
    expect(screen.getByLabelText("macOS: not supported")).toBeTruthy();
    expect(screen.getByLabelText("Linux: supported")).toBeTruthy();
    // VR=false: glyph suppressed (only show when true).
    expect(container.textContent).not.toContain("VR");
  });

  it("renders the VR badge when vr is true", () => {
    renderWithTooltip(
      <PlatformIconRow windows={true} mac={null} linux={null} vr={true} />
    );
    expect(screen.getByLabelText("VR supported: supported")).toBeTruthy();
  });

  it("hides individual glyphs that come back null (unresolved)", () => {
    renderWithTooltip(
      <PlatformIconRow windows={true} mac={null} linux={null} vr={null} />
    );
    expect(screen.getByLabelText("Windows: supported")).toBeTruthy();
    expect(screen.queryByLabelText(/macOS/)).toBeNull();
    expect(screen.queryByLabelText(/Linux/)).toBeNull();
  });

  it("renders nothing when every flag is null (no enrichment row at all)", () => {
    const { container } = renderWithTooltip(
      <PlatformIconRow windows={null} mac={null} linux={null} vr={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
