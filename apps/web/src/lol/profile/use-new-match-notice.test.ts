import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNewMatchNotice } from "./use-new-match-notice";

describe("useNewMatchNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses the initial undefined → matchId transition (mount-time existing state)", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useNewMatchNotice(id),
      { initialProps: { id: undefined as string | undefined } }
    );
    expect(result.current).toBe(false);

    rerender({ id: "M_1" });
    expect(result.current).toBe(false);
  });

  it("fires true when the matchId changes after mount", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useNewMatchNotice(id),
      { initialProps: { id: "M_1" as string | undefined } }
    );
    expect(result.current).toBe(false);

    rerender({ id: "M_2" });
    expect(result.current).toBe(true);
  });

  it("resets to false after the 6s TTL", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useNewMatchNotice(id),
      { initialProps: { id: "M_1" as string | undefined } }
    );
    rerender({ id: "M_2" });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current).toBe(false);
  });

  it("stays false when the same matchId is observed repeatedly", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useNewMatchNotice(id),
      { initialProps: { id: "M_1" as string | undefined } }
    );
    rerender({ id: "M_1" });
    rerender({ id: "M_1" });
    expect(result.current).toBe(false);
  });

  it("stays false when the matchId resets to undefined", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useNewMatchNotice(id),
      { initialProps: { id: "M_1" as string | undefined } }
    );
    rerender({ id: undefined });
    expect(result.current).toBe(false);
  });
});
