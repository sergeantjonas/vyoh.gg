import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamScreenshotEntry } from "@vyoh/shared";
import { describe, expect, it } from "vitest";

import { ScreenshotLightboxStrip } from "./screenshot-lightbox";

const SCREENSHOTS: SteamScreenshotEntry[] = Array.from({ length: 3 }, (_, i) => ({
  filename: `steam/apps/367520/ss_${i}.jpg`,
  ordinal: i,
}));

describe("ScreenshotLightboxStrip", () => {
  it("renders one trigger button per screenshot", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    expect(screen.getAllByRole("button", { name: /Open screenshot/ })).toHaveLength(3);
  });

  it("renders nothing when the list is empty", () => {
    const { container } = render(
      <ScreenshotLightboxStrip appid={367520} screenshots={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens a dialog at the clicked index", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 2 of 3" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("steps forward with Next and wraps at the end", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 3 of 3" }));
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("steps backward with Previous and wraps at the start", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 1 of 3" }));
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("steps with the arrow keys while the dialog is open", () => {
    render(<ScreenshotLightboxStrip appid={367520} screenshots={SCREENSHOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 2 of 3" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("hides prev/next chevrons when there is only one screenshot", () => {
    render(
      <ScreenshotLightboxStrip
        appid={367520}
        screenshots={[SCREENSHOTS[0] as SteamScreenshotEntry]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open screenshot 1 of 1" }));
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
