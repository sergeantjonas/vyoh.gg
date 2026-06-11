import { __testOnlyResetAudioPrefsCache } from "@/lib/use-audio";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioToggle } from "./audio-toggle";

const ENABLED_KEY = "vyoh:audio-enabled";
const VOLUME_KEY = "vyoh:audio-volume";

function renderToggle() {
  return render(
    <TooltipPrimitive.Provider delayDuration={0}>
      <AudioToggle />
    </TooltipPrimitive.Provider>
  );
}

beforeEach(() => {
  localStorage.clear();
  __testOnlyResetAudioPrefsCache();
  function MockCtor() {
    return {
      currentTime: 0,
      state: "running",
      destination: {},
      createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
      createOscillator: vi.fn(() => ({
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(() => ({ connect: vi.fn() })),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBuffer: vi.fn(),
      createBufferSource: vi.fn(),
      createBiquadFilter: vi.fn(),
      close: vi.fn(),
      resume: vi.fn(() => Promise.resolve()),
    };
  }
  vi.stubGlobal("AudioContext", MockCtor);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioToggle", () => {
  it("renders the VolumeX icon when disabled with 'Sound off' label", () => {
    renderToggle();
    const trigger = screen.getByRole("button", { name: /Sound off/ });
    expect(trigger).toBeDefined();
  });

  it("renders the Volume2 icon with percentage when enabled", () => {
    localStorage.setItem(ENABLED_KEY, "1");
    localStorage.setItem(VOLUME_KEY, "0.5");
    renderToggle();
    const trigger = screen.getByRole("button", { name: /Sound on \(50%\)/ });
    expect(trigger).toBeDefined();
  });

  it("opens a popover with switch + slider on trigger click", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Sound off/ }));
    expect(screen.getByRole("switch")).toBeDefined();
    expect(screen.getByRole("slider")).toBeDefined();
  });

  it("toggles the switch and writes to localStorage", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Sound off/ }));
    const switchEl = screen.getByRole("switch");
    expect(switchEl.getAttribute("aria-checked")).toBe("false");
    await user.click(switchEl);
    expect(localStorage.getItem(ENABLED_KEY)).toBe("1");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("disables the slider when sound is off", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Sound off/ }));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });

  it("enables the slider when sound is on and persists volume changes", async () => {
    const user = userEvent.setup();
    localStorage.setItem(ENABLED_KEY, "1");
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Sound on/ }));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.disabled).toBe(false);
    fireEvent.change(slider, { target: { value: "0.7" } });
    expect(localStorage.getItem(VOLUME_KEY)).toBe("0.7");
  });

  it("axe scan: no a11y violations in closed state", async () => {
    const { container } = renderToggle();
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("axe scan: no a11y violations in open state", async () => {
    const user = userEvent.setup();
    const { container } = renderToggle();
    await user.click(screen.getByRole("button", { name: /Sound off/ }));
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
