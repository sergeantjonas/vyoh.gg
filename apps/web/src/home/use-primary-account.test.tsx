import { useMe } from "@/identity/use-me";
import { renderHook } from "@testing-library/react";
import type { LolAccount, Me } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrimaryAccount } from "./use-primary-account";

vi.mock("@/identity/use-me", () => ({ useMe: vi.fn() }));

function mockMe(value: { data: Me | undefined; isPending: boolean }): void {
  vi.mocked(useMe).mockReturnValue(value as unknown as ReturnType<typeof useMe>);
}

afterEach(() => {
  vi.mocked(useMe).mockReset();
});

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

describe("usePrimaryAccount", () => {
  it("returns the first lol account when /me has resolved", () => {
    mockMe({ data: { lol: [account], steam: [] }, isPending: false });
    const { result } = renderHook(() => usePrimaryAccount());
    expect(result.current.account).toEqual(account);
    expect(result.current.isPending).toBe(false);
  });

  it("returns undefined account while /me is pending", () => {
    mockMe({ data: undefined, isPending: true });
    const { result } = renderHook(() => usePrimaryAccount());
    expect(result.current.account).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("returns undefined account when /me has no lol accounts", () => {
    mockMe({ data: { lol: [], steam: [] }, isPending: false });
    const { result } = renderHook(() => usePrimaryAccount());
    expect(result.current.account).toBeUndefined();
  });
});
