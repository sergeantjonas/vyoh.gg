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
    params,
    children,
    className,
    ...rest
  }: {
    to?: string;
    search?: Record<string, string>;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => {
    let href = to ?? "";
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    const qs =
      search && Object.keys(search).length > 0
        ? `?${new URLSearchParams(search).toString()}`
        : "";
    return (
      <a href={`${href}${qs}`} className={className} {...(rest as object)}>
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

// NavigationMenu opens on the trigger's pointer-move sequence; click alone
// is insufficient because Radix gates open on a hover heuristic. The same
// pointerDown→pointerUp→click ordering worked for DropdownMenu/Popover, so
// we keep it for compatibility with both menu kinds the suite exercises.
function openLolMenu() {
  const trigger = screen.getByRole("button", { name: /^LoL$/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);
  return trigger;
}

describe("Nav", () => {
  it("renders the brand and the four nav entries", () => {
    vi.mocked(useRouterState).mockReturnValue("/" as never);
    renderNav();
    expect(screen.getByText("vyoh")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Home/ })).toBeTruthy();
    // LoL is a NavigationMenu trigger button now, not a top-level link.
    expect(screen.getByRole("button", { name: /^LoL$/i })).toBeTruthy();
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

  it("marks the LoL trigger active under a /lol/<account> subpath", () => {
    vi.mocked(useRouterState).mockReturnValue("/lol/me-euw/matches" as never);
    renderNav();
    const trigger = screen.getByRole("button", { name: /^LoL$/i });
    expect(trigger.className).toContain("text-foreground");
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

  describe("LoL menu", () => {
    it("reveals the Patches link when the trigger is activated", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      openLolMenu();
      await waitFor(() => screen.getByRole("link", { name: /Patches/i }));
    });

    it("pre-fills ?as=<slug> on the Patches link when a default LoL account exists", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      accountsRef.current = [
        { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "europe" },
      ];
      renderNav();
      openLolMenu();
      const item = await screen.findByRole("link", { name: /Patches/i });
      expect(item.getAttribute("href")).toBe("/lol/patches?as=jonas-euw");
    });

    it("falls back to the neutral /lol/patches link when no default account is available", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      openLolMenu();
      const item = await screen.findByRole("link", { name: /Patches/i });
      expect(item.getAttribute("href")).toBe("/lol/patches");
    });

    it("renders an account row per LoL account linking to /lol/<slug>", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      accountsRef.current = [
        { slug: "jonas-euw", gameName: "Jonas", tagLine: "EUW", region: "europe" },
        { slug: "alt-na", gameName: "Alt", tagLine: "NA1", region: "americas" },
      ];
      renderNav();
      openLolMenu();
      const jonas = await screen.findByRole("link", { name: /Jonas/i });
      expect(jonas.getAttribute("href")).toBe("/lol/jonas-euw");
      const alt = screen.getByRole("link", { name: /Alt/i });
      expect(alt.getAttribute("href")).toBe("/lol/alt-na");
    });

    it("closes the menu when Escape is pressed", async () => {
      vi.mocked(useRouterState).mockReturnValue("/" as never);
      renderNav();
      openLolMenu();
      await screen.findByRole("link", { name: /Patches/i });
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("link", { name: /Patches/i })).toBeNull();
      });
    });
  });
});
