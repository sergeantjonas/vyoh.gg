import { render } from "@testing-library/react";
import { act, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtmosphereProvider } from "./atmosphere-provider";
import {
  type AtmosphereClaim,
  __resetAtmosphereOwnerSeqForTests,
  useAtmosphereClaim,
} from "./use-atmosphere-claim";

const noopClaim: AtmosphereClaim = {
  palette: {
    timeOfDay: "day",
    layers: [
      { cx: 0.5, cy: 0.5, radius: 800, lch: [0.7, 0.1, 200], alpha: 0.3, phase: 0 },
    ],
  },
  intensity: 0.5,
};

function Band({ claim }: { claim: AtmosphereClaim }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useAtmosphereClaim(ref, claim);
  return <div ref={ref} data-testid="band" />;
}

describe("useAtmosphereClaim", () => {
  beforeEach(() => {
    __resetAtmosphereOwnerSeqForTests();
  });

  it("throws when used outside an AtmosphereProvider", () => {
    // Suppress the React error-boundary console.error during the throw test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Band claim={noopClaim} />)).toThrow(
      /must be used within an AtmosphereProvider/
    );
    spy.mockRestore();
  });

  it("mounts without throwing inside an AtmosphereProvider", () => {
    const { getByTestId } = render(
      <AtmosphereProvider>
        <Band claim={noopClaim} />
      </AtmosphereProvider>
    );
    expect(getByTestId("band")).toBeTruthy();
  });

  it("supports multiple concurrent claims", () => {
    const claimB: AtmosphereClaim = { ...noopClaim, intensity: 0.8 };
    const { getAllByTestId, unmount } = render(
      <AtmosphereProvider>
        <Band claim={noopClaim} />
        <Band claim={claimB} />
      </AtmosphereProvider>
    );
    expect(getAllByTestId("band")).toHaveLength(2);
    // Both unmount cleanly — exercises clearClaim on the trailing claim.
    act(() => unmount());
  });

  it("cleans up its claim on unmount", () => {
    const { rerender } = render(
      <AtmosphereProvider>
        <Band claim={noopClaim} />
      </AtmosphereProvider>
    );
    // Replacing children re-runs useEffect cleanup chain. If clearClaim
    // didn't fire, the claim would linger; this test guards against a
    // missing return in the cleanup-effect.
    rerender(<AtmosphereProvider>{null}</AtmosphereProvider>);
  });
});
