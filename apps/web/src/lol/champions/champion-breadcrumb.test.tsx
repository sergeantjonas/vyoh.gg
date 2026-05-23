import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ActiveChampionProvider,
  type ChampionOrigin,
  useActiveChampion,
} from "./active-champion-context";
import { ChampionBreadcrumb } from "./champion-breadcrumb";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

// Expose the originRectRef out to the test via a callback. Refs don't trigger
// re-renders, so a passive Probe component would miss the click's effect.
function CaptureOrigin({
  onMount,
}: {
  onMount: (read: () => ChampionOrigin | null) => void;
}) {
  const { originRectRef } = useActiveChampion();
  useEffect(() => {
    onMount(() => originRectRef.current);
  }, [originRectRef, onMount]);
  return null;
}

// Seeds activePosition (set in production by the row's pointerDown) so the
// breadcrumb knows which (alias, position) pair to morph back to.
function SeedActivePosition({ position }: { position: "MIDDLE" | "TOP" | null }) {
  const { setActivePosition } = useActiveChampion();
  useEffect(() => {
    setActivePosition(position);
  }, [setActivePosition, position]);
  return null;
}

describe("ChampionBreadcrumb", () => {
  it("captures the detail-hero rect with direction='backward' on click", () => {
    const holder: { read: (() => ChampionOrigin | null) | null } = { read: null };
    render(
      <ActiveChampionProvider>
        <SeedActivePosition position="MIDDLE" />
        {/* Hero stand-in matching the `data-champion-card` contract from the detail page. */}
        <div data-champion-card="Ahri" />
        <ChampionBreadcrumb accountSlug="ahri" championAlias="Ahri" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveChampionProvider>
    );

    const link = screen.getByText("Champions").closest("a");
    if (!link) throw new Error("expected a link wrapping the breadcrumb label");
    fireEvent.click(link);

    const origin = holder.read?.() ?? null;
    expect(origin?.championAlias).toBe("Ahri");
    expect(origin?.position).toBe("MIDDLE");
    expect(origin?.direction).toBe("backward");
  });

  it("is a no-op when no hero element is mounted (defensive)", () => {
    const holder: { read: (() => ChampionOrigin | null) | null } = { read: null };
    render(
      <ActiveChampionProvider>
        <SeedActivePosition position="MIDDLE" />
        <ChampionBreadcrumb accountSlug="ahri" championAlias="Ahri" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveChampionProvider>
    );

    const link = screen.getByText("Champions").closest("a");
    if (!link) throw new Error("expected a link wrapping the breadcrumb label");
    fireEvent.click(link);

    expect(holder.read?.() ?? null).toBeNull();
  });

  it("is a no-op when no activePosition is set (direct URL visit)", () => {
    const holder: { read: (() => ChampionOrigin | null) | null } = { read: null };
    render(
      <ActiveChampionProvider>
        <div data-champion-card="Ahri" />
        <ChampionBreadcrumb accountSlug="ahri" championAlias="Ahri" />
        <CaptureOrigin
          onMount={(r) => {
            holder.read = r;
          }}
        />
      </ActiveChampionProvider>
    );

    const link = screen.getByText("Champions").closest("a");
    if (!link) throw new Error("expected a link wrapping the breadcrumb label");
    fireEvent.click(link);

    expect(holder.read?.() ?? null).toBeNull();
  });
});
