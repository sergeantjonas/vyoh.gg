import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ActiveGameProvider,
  type GameOrigin,
  useActiveGame,
} from "./active-game-context";
import { GameBreadcrumb } from "./game-breadcrumb";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

// Default the persisted prefs to "rows" so the breadcrumb's layout gate
// passes; the second describe block overrides it to "tiles" to exercise
// the skip path.
const layoutMock = { current: "rows" as "rows" | "tiles" };
vi.mock("./use-library-prefs", () => ({
  useLibraryPrefs: () => [{ layout: layoutMock.current }, vi.fn()],
}));

function CaptureOrigin({
  onMount,
}: {
  onMount: (read: () => GameOrigin | null) => void;
}) {
  const { originRectRef } = useActiveGame();
  useEffect(() => {
    onMount(() => originRectRef.current);
  }, [originRectRef, onMount]);
  return null;
}

describe("GameBreadcrumb (rows layout)", () => {
  it("captures the hero + logo rects with direction='backward' on click", () => {
    layoutMock.current = "rows";
    const holder: { read: (() => GameOrigin | null) | null } = { read: null };
    render(
      <ActiveGameProvider>
        {/* Stand-ins for the detail page's hero wrapper + logo img. */}
        <div data-steam-game-hero={730} />
        <img data-steam-game-logo={730} alt="" />
        <GameBreadcrumb appid={730} gameName="Counter-Strike 2" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveGameProvider>
    );
    const link = screen.getByText("Library").closest("a");
    if (!link) throw new Error("expected library link");
    fireEvent.click(link);

    const origin = holder.read?.() ?? null;
    expect(origin?.appid).toBe(730);
    expect(origin?.direction).toBe("backward");
    expect(origin?.heroRect).toBeDefined();
    expect(origin?.logoRect).toBeDefined();
  });

  it("captures a null logoRect when no logo element is mounted (text-fallback case)", () => {
    layoutMock.current = "rows";
    const holder: { read: (() => GameOrigin | null) | null } = { read: null };
    render(
      <ActiveGameProvider>
        <div data-steam-game-hero={440} />
        {/* No logo element — detail page rendered the `<h2>` fallback. */}
        <GameBreadcrumb appid={440} gameName="Team Fortress 2" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveGameProvider>
    );
    const link = screen.getByText("Library").closest("a");
    if (!link) throw new Error("expected library link");
    fireEvent.click(link);

    const origin = holder.read?.() ?? null;
    expect(origin?.appid).toBe(440);
    expect(origin?.logoRect).toBeNull();
  });

  it("is a no-op when no hero element is mounted (defensive)", () => {
    layoutMock.current = "rows";
    const holder: { read: (() => GameOrigin | null) | null } = { read: null };
    render(
      <ActiveGameProvider>
        <GameBreadcrumb appid={570} gameName="Dota 2" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveGameProvider>
    );
    const link = screen.getByText("Library").closest("a");
    if (!link) throw new Error("expected library link");
    fireEvent.click(link);
    expect(holder.read?.() ?? null).toBeNull();
  });
});

describe("GameBreadcrumb (tiles layout)", () => {
  it("skips setting an origin rect — tile layout intentionally has no backward morph", () => {
    layoutMock.current = "tiles";
    const holder: { read: (() => GameOrigin | null) | null } = { read: null };
    render(
      <ActiveGameProvider>
        <div data-steam-game-hero={730} />
        <img data-steam-game-logo={730} alt="" />
        <GameBreadcrumb appid={730} gameName="Counter-Strike 2" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveGameProvider>
    );
    const link = screen.getByText("Library").closest("a");
    if (!link) throw new Error("expected library link");
    fireEvent.click(link);
    expect(holder.read?.() ?? null).toBeNull();
  });
});
