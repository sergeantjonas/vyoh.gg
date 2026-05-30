import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SteamPreferences } from "./steam-preferences";

afterEach(() => {
  localStorage.clear();
});

// TooltipProvider lives in __root in the app; supply it here so the trigger's
// Radix tooltip mounts.
function renderPrefs() {
  return render(
    <TooltipPrimitive.Provider>
      <SteamPreferences />
    </TooltipPrimitive.Provider>
  );
}

describe("SteamPreferences", () => {
  it("opens the popover when the trigger is clicked", () => {
    renderPrefs();
    expect(screen.queryByText("Steam preferences")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Steam preferences" }));
    expect(screen.getByText("Steam preferences")).toBeTruthy();
  });

  it("renders the mature-content toggle reflecting the persisted preference", () => {
    localStorage.setItem("vyoh:steam-show-mature-screenshots", "1");
    renderPrefs();
    fireEvent.click(screen.getByRole("button", { name: "Steam preferences" }));
    const checkbox = screen.getByRole("checkbox", {
      name: /Show mature content/,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("flipping the toggle persists the preference to localStorage", () => {
    renderPrefs();
    fireEvent.click(screen.getByRole("button", { name: "Steam preferences" }));
    const checkbox = screen.getByRole("checkbox", {
      name: /Show mature content/,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(localStorage.getItem("vyoh:steam-show-mature-screenshots")).toBe("1");
    fireEvent.click(checkbox);
    expect(localStorage.getItem("vyoh:steam-show-mature-screenshots")).toBeNull();
  });
});
