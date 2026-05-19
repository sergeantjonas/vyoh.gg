import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionShellProvider, useSectionShellState } from "./section-shell-context";

describe("useSectionShellState", () => {
  it("returns the provided state when wrapped in <SectionShellProvider>", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SectionShellProvider value={{ compact: true }}>{children}</SectionShellProvider>
    );
    const { result } = renderHook(() => useSectionShellState(), { wrapper });
    expect(result.current).toEqual({ compact: true });
  });

  it("returns false-compact when the provider explicitly sets compact false", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SectionShellProvider value={{ compact: false }}>{children}</SectionShellProvider>
    );
    const { result } = renderHook(() => useSectionShellState(), { wrapper });
    expect(result.current.compact).toBe(false);
  });

  it("throws when used outside a <SectionShell>", () => {
    function Probe() {
      useSectionShellState();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(
      /useSectionShellState must be used inside a <SectionShell>/
    );
  });
});
