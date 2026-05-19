import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SeriousQueuesProvider } from "./serious-queues";
import { SeriousQueuesSettings } from "./serious-queues-settings";

const STORAGE_KEY = "vyoh:serious-queues";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

function renderSettings() {
  return render(
    <MotionConfig reducedMotion="always">
      <SeriousQueuesProvider>
        <SeriousQueuesSettings />
      </SeriousQueuesProvider>
    </MotionConfig>
  );
}

describe("SeriousQueuesSettings", () => {
  it("renders the trigger button closed by default", () => {
    renderSettings();
    const btn = screen.getByRole("button", { name: "Serious-queues preferences" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Serious queues")).toBeNull();
  });

  it("opens the popover when the trigger is clicked", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Serious-queues preferences" }));
    expect(screen.getByText("Serious queues")).toBeTruthy();
    expect(screen.getByLabelText("Ranked Solo")).toBeTruthy();
    expect(screen.getByLabelText("Ranked Flex")).toBeTruthy();
    expect(screen.getByLabelText("Normal Draft")).toBeTruthy();
  });

  it("toggles a queue and persists the new selection", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Serious-queues preferences" }));
    const flex = screen.getByLabelText("Ranked Flex") as HTMLInputElement;
    expect(flex.checked).toBe(true);
    fireEvent.click(flex);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("420");
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain("440");
  });

  it("closes when Escape is pressed", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Serious-queues preferences" }));
    expect(screen.getByText("Serious queues")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Serious queues")).toBeNull();
  });
});
