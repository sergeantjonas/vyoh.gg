import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteProvider, useCommandPalette } from "./command-palette-context";
import { Nav } from "./nav";

type MockAccount = { slug: string; gameName: string; tagLine: string; region: string };

const { accountsRef } = vi.hoisted(() => ({
  accountsRef: { current: [] as MockAccount[] },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    className,
    ...rest
  }: {
    to?: string;
    search?: Record<string, string>;
    children: ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => {
    const qs =
      search && Object.keys(search).length > 0
        ? `?${new URLSearchParams(search).toString()}`
        : "";
    return (
      <a href={`${to ?? ""}${qs}`} className={className} {...(rest as object)}>
        {children}
      </a>
    );
  },
  useRouterState: vi.fn(),
}));

vi.mock("@/identity/use-me", () => ({
  useMe: () =>
    accountsRef.current.length > 0
      ? { data: { lol: accountsRef.current, steam: [] } }
      : { data: undefined },
}));

beforeEach(() => {
  accountsRef.current = [];
});

afterEach(() => {
  vi.mocked(useRouterState).mockReset();
});

function renderNav() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <CommandPaletteProvider>
            <Nav />
          </CommandPaletteProvider>
        </TooltipPrimitive.Provider>
      </MotionConfig>
    </QueryClientProvider>
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

  it("marks the LoL pill active under a /lol/<account> subpath", () => {
    vi.mocked(useRouterState).mockReturnValue("/lol/me-euw/matches" as never);
    const { container } = renderNav();
    // The compound pill (link + dropdown chevron) shares a wrapper div that
    // carries the active styling so the highlight covers both. Find the
    // wrapper by walking up from the LoL link.
    const lolLink = container.querySelector('a[href="/lol"]') as HTMLElement;
    const wrapper = lolLink.parentElement as HTMLElement;
    expect(wrapper.className).toContain("text-foreground");
  });

  it("opens the command palette when the shortcut chip is clicked", () => {
    vi.mocked(useRouterState).mockReturnValue("/" as never);
    const observed: { current: ReturnType<typeof useCommandPalette> | null } = {
      current: null,
    };
    function Probe() {
      observed.current = useCommandPalette();
      return null;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="always">
          <TooltipPrimitive.Provider>
            <CommandPaletteProvider>
              <Probe />
              <Nav />
            </CommandPaletteProvider>
          </TooltipPrimitive.Provider>
        </MotionConfig>
      </QueryClientProvider>
    );
    expect(observed.current?.open).toBe(false);
    const trigger = screen.getByRole("button", { name: "Open command palette" });
    fireEvent.click(trigger);
    expect(observed.current?.open).toBe(true);
  });

  describe("LoL dropdown", () => {
    it("renders the dropdown trigger with an accessible label", () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      expect(screen.getByRole("button", { name: /Open LoL menu/i })).toBeTruthy();
    });

    it("reveals the Patches menu item when the chevron is clicked", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      const trigger = screen.getByRole("button", { name: /Open LoL menu/i });
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
      fireEvent.pointerUp(trigger);
      fireEvent.click(trigger);
      await waitFor(() => screen.getByRole("menuitem", { name: /Patches/i }));
    });

    it("pre-fills ?as=<slug> on the Patches link when a default LoL account exists", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      accountsRef.current = [
        { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "europe" },
      ];
      renderNav();
      const trigger = screen.getByRole("button", { name: /Open LoL menu/i });
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
      fireEvent.pointerUp(trigger);
      fireEvent.click(trigger);
      // `DropdownMenuItem asChild` collapses the menuitem role onto the Link
      // itself, so the role and the href are on the same element.
      const item = await screen.findByRole("menuitem", { name: /Patches/i });
      expect(item.getAttribute("href")).toBe("/lol/patches?as=jonas-euw");
    });

    it("falls back to the neutral /lol/patches link when no default account is available", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      const trigger = screen.getByRole("button", { name: /Open LoL menu/i });
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
      fireEvent.pointerUp(trigger);
      fireEvent.click(trigger);
      const item = await screen.findByRole("menuitem", { name: /Patches/i });
      expect(item.getAttribute("href")).toBe("/lol/patches");
    });

    it("closes the dropdown when Escape is pressed", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      const trigger = screen.getByRole("button", { name: /Open LoL menu/i });
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
      fireEvent.pointerUp(trigger);
      fireEvent.click(trigger);
      await screen.findByRole("menuitem", { name: /Patches/i });
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: /Patches/i })).toBeNull();
      });
    });
  });
});
