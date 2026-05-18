import { render, renderHook } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SplashProvider, useSplashChampion } from "./splash-backdrop";

vi.mock("blurhash", () => ({
  decode: (_hash: string, w: number, h: number) => new Uint8ClampedArray(w * h * 4),
}));

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "14.20",
}));

vi.mock("@/lol/_shared/assets/champion-theme", () => ({
  championTheme: () => ({ blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", primary: "#1a3a5c" }),
}));

vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  // Use inline data URL so happy-dom doesn't trigger a network fetch
  championBackdropSplashUrl: () =>
    "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
}));

// happy-dom returns null for canvas 2D context — stub it
beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => ({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    value: () => "data:image/png;base64,test",
    configurable: true,
    writable: true,
  });
});

function Wrap({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="always">
      <SplashProvider>{children}</SplashProvider>
    </MotionConfig>
  );
}

function ChampionClaim({ champion }: { champion: string | null }) {
  useSplashChampion(champion);
  return null;
}

describe("useSplashChampion", () => {
  it("throws when rendered outside SplashProvider", () => {
    expect(() => renderHook(() => useSplashChampion("Ahri"))).toThrow(
      "useSplashChampion must be used within SplashProvider"
    );
  });
});

describe("SplashProvider", () => {
  it("renders backdrop portal when a champion is claimed", () => {
    render(
      <Wrap>
        <ChampionClaim champion="Ahri" />
      </Wrap>
    );
    expect(document.querySelector(".pointer-events-none")).not.toBeNull();
  });

  it("does not render backdrop when no champion is claimed", () => {
    render(
      <Wrap>
        <ChampionClaim champion={null} />
      </Wrap>
    );
    expect(document.querySelector(".pointer-events-none")).toBeNull();
  });
});
