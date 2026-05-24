import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRefCountedClaim } from "./use-ref-counted-claim";

interface TestClaim {
  id: number;
  ts: number | null;
}

const eqByIdTs = (a: TestClaim, b: TestClaim) => a.id === b.id && a.ts === b.ts;

describe("useRefCountedClaim", () => {
  it("starts with a null claim", () => {
    const { result } = renderHook(() => useRefCountedClaim<TestClaim>(eqByIdTs));
    expect(result.current.claim).toBeNull();
  });

  it("setClaim replaces the slot when the shape differs", () => {
    const { result } = renderHook(() => useRefCountedClaim<TestClaim>(eqByIdTs));
    act(() => result.current.setClaim({ id: 1, ts: null }));
    expect(result.current.claim).toEqual({ id: 1, ts: null });
    act(() => result.current.setClaim({ id: 2, ts: null }));
    expect(result.current.claim).toEqual({ id: 2, ts: null });
  });

  it("setClaim bails out when isEqual returns true", () => {
    const { result } = renderHook(() => useRefCountedClaim<TestClaim>(eqByIdTs));
    act(() => result.current.setClaim({ id: 1, ts: 100 }));
    const first = result.current.claim;
    act(() => result.current.setClaim({ id: 1, ts: 100 }));
    expect(result.current.claim).toBe(first);
  });

  it("acquire/release pair keeps the claim until the last release fires", () => {
    const { result } = renderHook(() => useRefCountedClaim<TestClaim>(eqByIdTs));
    let releaseA = () => {};
    let releaseB = () => {};
    act(() => {
      releaseA = result.current.acquire();
      result.current.setClaim({ id: 7, ts: null });
    });
    expect(result.current.claim).toEqual({ id: 7, ts: null });

    act(() => {
      releaseB = result.current.acquire();
    });
    expect(result.current.claim).toEqual({ id: 7, ts: null });

    // Stale instance unmounts first — surviving instance still alive, slot
    // must stay non-null. This is the exact AnimatePresence-around-Outlet
    // hazard the hook defends against.
    act(() => releaseA());
    expect(result.current.claim).toEqual({ id: 7, ts: null });

    act(() => releaseB());
    expect(result.current.claim).toBeNull();
  });

  it("setClaim and acquire have stable identity across renders", () => {
    const { result, rerender } = renderHook(() =>
      useRefCountedClaim<TestClaim>(eqByIdTs)
    );
    const firstSet = result.current.setClaim;
    const firstAcquire = result.current.acquire;
    rerender();
    expect(result.current.setClaim).toBe(firstSet);
    expect(result.current.acquire).toBe(firstAcquire);
  });
});
