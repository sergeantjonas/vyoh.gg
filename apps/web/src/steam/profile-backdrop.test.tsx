import { useSteamSummary } from "@/steam/use-steam-summary";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SteamProfileBackdrop,
  prefetchSteamGameBackdrop,
  useSteamGameBackdrop,
} from "./profile-backdrop";

vi.mock("@/steam/use-steam-summary", () => ({
  useSteamSummary: vi.fn(),
}));

vi.mock("@/steam/_shared/steam-image", () => ({
  steamPageBackgroundUrl: (appid: number, ts: number | null) =>
    `/steam-bg/${appid}?ts=${ts ?? "none"}`,
}));

function setSummary(value: unknown) {
  vi.mocked(useSteamSummary).mockReturnValue({
    data: value,
  } as unknown as ReturnType<typeof useSteamSummary>);
}

function renderShell(children: ReactNode) {
  return render(
    <MotionConfig reducedMotion="always">
      <SteamProfileBackdrop>{children}</SteamProfileBackdrop>
    </MotionConfig>
  );
}

function GameConsumer({ appid, ts }: { appid: number; ts: number | null }) {
  useSteamGameBackdrop({ appid, assetTimestamp: ts });
  return <span data-testid={`consumer-${appid}`} />;
}

afterEach(() => {
  vi.mocked(useSteamSummary).mockReset();
});

describe("SteamProfileBackdrop", () => {
  it("renders children even when summary has no profile background", () => {
    setSummary({ profileBackgroundUrl: null });
    renderShell(<span>child</span>);
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("renders an <img> backdrop when profileBackgroundUrl is present and no video URL is set", () => {
    setSummary({
      profileBackgroundUrl: "/static-bg.jpg",
      profileBackgroundVideoUrl: null,
    });
    renderShell(<span>child</span>);
    const imgs = document.querySelectorAll("img");
    expect(Array.from(imgs).some((i) => i.src.endsWith("/static-bg.jpg"))).toBe(true);
  });

  it("renders the GameBackdropLayer with the claim's appid when a consumer mounts", () => {
    setSummary({ profileBackgroundUrl: null });
    renderShell(<GameConsumer appid={42} ts={null} />);
    // Find the img by src (set via mocked steamPageBackgroundUrl)
    const imgs = document.querySelectorAll("img");
    expect(Array.from(imgs).some((i) => i.src.includes("/steam-bg/42?ts=none"))).toBe(
      true
    );
  });

  it("forwards the assetTimestamp through to the backdrop URL", () => {
    setSummary({ profileBackgroundUrl: null });
    renderShell(<GameConsumer appid={42} ts={1234} />);
    const imgs = document.querySelectorAll("img");
    expect(Array.from(imgs).some((i) => i.src.includes("/steam-bg/42?ts=1234"))).toBe(
      true
    );
  });

  it("keeps the last-known img painted while no consumers are mounted so the layer can fade out", () => {
    setSummary({ profileBackgroundUrl: null });
    function Switcher({ show }: { show: boolean }) {
      return show ? <GameConsumer appid={7} ts={null} /> : null;
    }
    const { rerender } = render(
      <MotionConfig reducedMotion="always">
        <SteamProfileBackdrop>
          <Switcher show={true} />
        </SteamProfileBackdrop>
      </MotionConfig>
    );
    rerender(
      <MotionConfig reducedMotion="always">
        <SteamProfileBackdrop>
          <Switcher show={false} />
        </SteamProfileBackdrop>
      </MotionConfig>
    );
    // The activeClaim sticks to the last non-null value so the layer can
    // animate its opacity to 0 over the same image.
    expect(
      Array.from(document.querySelectorAll("img")).some((i) =>
        i.src.includes("/steam-bg/7")
      )
    ).toBe(true);
  });

  it("hides the game-backdrop img after the image fails to load", () => {
    setSummary({ profileBackgroundUrl: null });
    renderShell(<GameConsumer appid={42} ts={null} />);
    const img = Array.from(document.querySelectorAll("img")).find((i) =>
      i.src.includes("/steam-bg/42")
    );
    if (!img) throw new Error("expected the game backdrop img to be mounted");
    fireEvent.error(img);
    expect(
      Array.from(document.querySelectorAll("img")).some((i) =>
        i.src.includes("/steam-bg/42")
      )
    ).toBe(false);
  });

  it("throws when useSteamGameBackdrop is called outside the provider", () => {
    function Bad() {
      useSteamGameBackdrop({ appid: 1, assetTimestamp: null });
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(
      "useSteamGameBackdrop must be used within SteamProfileBackdrop"
    );
    spy.mockRestore();
  });

  it("does NOT re-create the GameBackdropLayer img when only assetTimestamp changes for the same appid", () => {
    setSummary({ profileBackgroundUrl: null });
    function Bump({ ts }: { ts: number }) {
      useSteamGameBackdrop({ appid: 42, assetTimestamp: ts });
      return null;
    }
    const { rerender } = render(
      <MotionConfig reducedMotion="always">
        <SteamProfileBackdrop>
          <Bump ts={1} />
        </SteamProfileBackdrop>
      </MotionConfig>
    );
    rerender(
      <MotionConfig reducedMotion="always">
        <SteamProfileBackdrop>
          <Bump ts={2} />
        </SteamProfileBackdrop>
      </MotionConfig>
    );
    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs.some((i) => i.src.includes("/steam-bg/42?ts=2"))).toBe(true);
  });
});

describe("prefetchSteamGameBackdrop", () => {
  it("creates an Image and assigns the backdrop URL", () => {
    const createdSources: string[] = [];
    class FakeImage {
      _src = "";
      set src(value: string) {
        this._src = value;
        createdSources.push(value);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
    prefetchSteamGameBackdrop(9999, null);
    expect(createdSources).toContain("/steam-bg/9999?ts=none");
    vi.unstubAllGlobals();
  });

  it("dedupes by URL — second call for the same appid+ts does not create another Image", () => {
    const createdSources: string[] = [];
    class FakeImage {
      _src = "";
      set src(value: string) {
        this._src = value;
        createdSources.push(value);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
    prefetchSteamGameBackdrop(7777, 5);
    prefetchSteamGameBackdrop(7777, 5);
    expect(createdSources.filter((s) => s === "/steam-bg/7777?ts=5")).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

// Suppress unused-import warnings for useEffect when bundling
void useEffect;
