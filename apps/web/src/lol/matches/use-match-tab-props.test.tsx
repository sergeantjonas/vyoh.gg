import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useMatchDetail } from "@/lol/matches/use-match-detail";
import { renderHook } from "@testing-library/react";
import type { LolAccount, MatchDetail } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMatchTabProps } from "./use-match-tab-props";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/matches/use-match-detail", () => ({
  useMatchDetail: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setDetail(data: MatchDetail | undefined) {
  vi.mocked(useMatchDetail).mockReturnValue({ data } as unknown as ReturnType<
    typeof useMatchDetail
  >);
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useMatchDetail).mockReset();
});

describe("useMatchTabProps", () => {
  it("returns null while the detail query has no data yet", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    setDetail(undefined);
    const { result } = renderHook(() => useMatchTabProps("jonas-euw", "EUW1_1"));
    expect(result.current).toBeNull();
  });

  it("returns the detail with the owner's puuid resolved case-insensitively", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    setDetail({
      participants: [
        { puuid: "P_OTHER", riotIdGameName: "Bob", riotIdTagline: "EUW" },
        { puuid: "P_OWNER", riotIdGameName: "jonas", riotIdTagline: "euw" },
      ],
    } as unknown as MatchDetail);
    const { result } = renderHook(() => useMatchTabProps("jonas-euw", "EUW1_1"));
    expect(result.current?.myPuuid).toBe("P_OWNER");
  });

  it("returns myPuuid=undefined when no participant matches the account", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    setDetail({
      participants: [{ puuid: "P1", riotIdGameName: "Bob", riotIdTagline: "EUW" }],
    } as unknown as MatchDetail);
    const { result } = renderHook(() => useMatchTabProps("jonas-euw", "EUW1_1"));
    expect(result.current?.myPuuid).toBeUndefined();
  });

  it("returns myPuuid=undefined when no account is resolvable from the slug", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(undefined);
    setDetail({
      participants: [{ puuid: "P1", riotIdGameName: "Jonas", riotIdTagline: "EUW" }],
    } as unknown as MatchDetail);
    const { result } = renderHook(() => useMatchTabProps("jonas-euw", "EUW1_1"));
    expect(result.current?.myPuuid).toBeUndefined();
  });
});
