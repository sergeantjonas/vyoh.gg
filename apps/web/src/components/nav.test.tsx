import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useRouterState } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteProvider, useCommandPalette } from "./command-palette-context";
import { Nav } from "./nav";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useRouterState: vi.fn(),
}));

afterEach(() => {
  vi.mocked(useRouterState).mockReset();
});

function renderNav() {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <CommandPaletteProvider>
          <Nav />
        </CommandPaletteProvider>
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("Nav", () => {
  it("renders the brand and the four nav entries", () => {
    vi.mocked(useRouterState).mockReturnValue("/" as never);
    renderNav();
    expect(screen.getByText("vyoh")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Home/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /LoL/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Steam/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Status/ })).toBeTruthy();
  });

  it("marks Home active only when pathname is exactly '/'", () => {
    vi.mocked(useRouterState).mockReturnValue("/" as never);
    const { container } = renderNav();
    const homeLink = container.querySelector('a[href="/"][class*="px-3"]') as HTMLElement;
    expect(homeLink.className).toContain("text-foreground");
    expect(homeLink.className).not.toContain("text-muted-foreground");
  });

  it("marks LoL active under a /lol/<account> subpath", () => {
    vi.mocked(useRouterState).mockReturnValue("/lol/me-euw/matches" as never);
    const { container } = renderNav();
    const lolLink = container.querySelector('a[href="/lol"]') as HTMLElement;
    expect(lolLink.className).toContain("text-foreground");
  });

  it("opens the command palette when the shortcut chip is clicked", () => {
    vi.mocked(useRouterState).mockReturnValue("/" as never);
    // Probe captures the live context value so we can verify open flips
    // from false to true after click.
    const observed: { current: ReturnType<typeof useCommandPalette> | null } = {
      current: null,
    };
    function Probe() {
      observed.current = useCommandPalette();
      return null;
    }
    render(
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <CommandPaletteProvider>
            <Probe />
            <Nav />
          </CommandPaletteProvider>
        </TooltipPrimitive.Provider>
      </MotionConfig>
    );
    expect(observed.current?.open).toBe(false);
    const trigger = screen.getByRole("button", { name: "Open command palette" });
    fireEvent.click(trigger);
    expect(observed.current?.open).toBe(true);
  });
});
