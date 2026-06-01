import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import {
  type AtmosphereClaim,
  AtmosphereContext,
  __resetAtmosphereOwnerSeqForTests,
} from "@/home/atmosphere/use-atmosphere-claim";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetClaim } from "./use-asset-claim";

const palette: AtmosphereClaim["palette"] = {
  timeOfDay: "day",
  layers: [{ cx: 0.5, cy: 0.5, radius: 800, lch: [0.7, 0.1, 200], alpha: 0.3, phase: 0 }],
};

function ProbeBand({
  image,
  blurPx,
  intensity,
}: {
  image: string;
  blurPx?: number;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useAssetClaim(ref, {
    image,
    palette,
    ...(blurPx !== undefined ? { blurPx } : {}),
    ...(intensity !== undefined ? { intensity } : {}),
  });
  return <div ref={ref} data-testid="band" />;
}

describe("useAssetClaim", () => {
  beforeEach(() => {
    __resetAtmosphereOwnerSeqForTests();
  });

  it("registers an asset claim with the provided image and palette", () => {
    const setClaim = vi.fn();
    const clearClaim = vi.fn();
    render(
      <AtmosphereContext.Provider value={{ setClaim, clearClaim }}>
        <ProbeBand image="https://example.test/splash.jpg" />
      </AtmosphereContext.Provider>
    );
    expect(setClaim).toHaveBeenCalledTimes(1);
    const lastCall = setClaim.mock.calls[0];
    expect(lastCall).toBeDefined();
    const [owner, _ref, claim] = lastCall as [number, unknown, AtmosphereClaim];
    expect(owner).toBeGreaterThan(0);
    expect(claim.image).toBe("https://example.test/splash.jpg");
    expect(claim.palette).toBe(palette);
  });

  it("defaults to light blur (~recognizable asset target) when caller omits blurPx", () => {
    const setClaim = vi.fn();
    const clearClaim = vi.fn();
    render(
      <AtmosphereContext.Provider value={{ setClaim, clearClaim }}>
        <ProbeBand image="https://example.test/x.jpg" />
      </AtmosphereContext.Provider>
    );
    const [, , claim] = setClaim.mock.calls[0] as [number, unknown, AtmosphereClaim];
    // 2px is barely-there blur — the splash reads as recognizable; per-band
    // dark scrims (bg-background/55 + backdrop-blur-sm cards) handle text
    // readability locally rather than blurring the whole image.
    expect(claim.blurPx).toBe(2);
  });

  it("respects an explicit blurPx override", () => {
    const setClaim = vi.fn();
    const clearClaim = vi.fn();
    render(
      <AtmosphereContext.Provider value={{ setClaim, clearClaim }}>
        <ProbeBand image="https://example.test/x.jpg" blurPx={16} />
      </AtmosphereContext.Provider>
    );
    const [, , claim] = setClaim.mock.calls[0] as [number, unknown, AtmosphereClaim];
    expect(claim.blurPx).toBe(16);
  });

  it("clears the claim when the band unmounts", () => {
    const setClaim = vi.fn();
    const clearClaim = vi.fn();
    const { unmount } = render(
      <AtmosphereContext.Provider value={{ setClaim, clearClaim }}>
        <ProbeBand image="https://example.test/x.jpg" />
      </AtmosphereContext.Provider>
    );
    unmount();
    expect(clearClaim).toHaveBeenCalledTimes(1);
  });

  it("mounts cleanly under a real AtmosphereProvider", () => {
    // Sanity: the wrapper composes with the real provider, not just a mocked
    // context. Catches regressions where the claim shape drifts away from
    // the provider's equality check.
    const { getByTestId, unmount } = render(
      <AtmosphereProvider>
        <ProbeBand image="https://example.test/x.jpg" />
      </AtmosphereProvider>
    );
    expect(getByTestId("band")).toBeTruthy();
    unmount();
  });
});
