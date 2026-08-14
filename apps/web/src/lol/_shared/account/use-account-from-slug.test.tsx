import { useMe } from "@/identity/use-me";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { renderHook } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/identity/use-me", () => ({ useMe: vi.fn() }));

const ahri: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

const vyoh: LolAccount = {
  slug: "vyoh",
  region: "euw1",
  gameName: "Ahri",
  tagLine: "Vyoh",
};

function mockMe(lol: LolAccount[] | undefined) {
  vi.mocked(useMe).mockReturnValue({
    data: lol === undefined ? undefined : { lol },
  } as ReturnType<typeof useMe>);
}

afterEach(() => {
  vi.mocked(useMe).mockReset();
});

// Nearly every LoL surface resolves its account through this hook, so ~20 test
// files mock it out — which left the real implementation uncovered.
describe("useAccountFromSlug", () => {
  it("returns undefined while the identity query is still pending", () => {
    mockMe(undefined);
    const { result } = renderHook(() => useAccountFromSlug("ahri"));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when no account matches the slug", () => {
    mockMe([ahri, vyoh]);
    const { result } = renderHook(() => useAccountFromSlug("nobody"));
    expect(result.current).toBeUndefined();
  });

  it("resolves the account whose slug matches", () => {
    mockMe([ahri, vyoh]);
    const { result } = renderHook(() => useAccountFromSlug("vyoh"));
    expect(result.current).toBe(vyoh);
  });

  // The other half of what "hidden" means. The nav filters these out, and this
  // hook must not: hiding removes the link, not the page, and `/me` carries a
  // flag rather than omitting the row precisely so `/lol/<hidden-slug>/*` keeps
  // resolving for anyone holding the URL.
  it("resolves a hidden account — hiding drops the nav link, not the route", () => {
    const hidden: LolAccount = { ...vyoh, hidden: true };
    mockMe([ahri, hidden]);
    const { result } = renderHook(() => useAccountFromSlug("vyoh"));
    expect(result.current).toBe(hidden);
  });

  // Slugs arrive from the URL, so a capitalised path segment must still match.
  it("matches case-insensitively in both directions", () => {
    mockMe([ahri, vyoh]);
    expect(renderHook(() => useAccountFromSlug("AHRI")).result.current).toBe(ahri);
    expect(renderHook(() => useAccountFromSlug("Vyoh")).result.current).toBe(vyoh);
  });

  it("returns undefined when the roster is empty", () => {
    mockMe([]);
    const { result } = renderHook(() => useAccountFromSlug("ahri"));
    expect(result.current).toBeUndefined();
  });
});
