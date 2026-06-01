import { describe, expect, it } from "vitest";
import {
  type LolAccount,
  assertAccountOwnerInvariants,
  getOwnerAccounts,
  getPrimaryAccount,
  isOwnerAccount,
} from "./account";

const stub = (overrides: Partial<LolAccount>): LolAccount => ({
  slug: overrides.slug ?? "x",
  gameName: overrides.gameName ?? "X",
  tagLine: overrides.tagLine ?? "EUW",
  region: overrides.region ?? "euw1",
  ...overrides,
});

describe("isOwnerAccount", () => {
  it("returns true only when isOwner is explicitly true", () => {
    expect(isOwnerAccount(stub({ slug: "a", isOwner: true }))).toBe(true);
    expect(isOwnerAccount(stub({ slug: "b", isOwner: false }))).toBe(false);
    // Default-deny: omitting the flag is treated as not-an-owner.
    expect(isOwnerAccount(stub({ slug: "c" }))).toBe(false);
  });
});

describe("getOwnerAccounts", () => {
  it("filters out non-owner entries while preserving order", () => {
    const accounts = [
      stub({ slug: "main", isOwner: true, isPrimary: true }),
      stub({ slug: "test" }),
      stub({ slug: "alt", isOwner: true }),
      stub({ slug: "test2", isOwner: false }),
    ];
    const owners = getOwnerAccounts(accounts);
    expect(owners.map((a) => a.slug)).toEqual(["main", "alt"]);
  });

  it("returns an empty array when no accounts are owners", () => {
    expect(getOwnerAccounts([stub({ slug: "a" }), stub({ slug: "b" })])).toEqual([]);
  });

  it("preserves extended account shapes through the generic param", () => {
    type Rich = LolAccount & { profileIconId: number | null };
    const accounts: Rich[] = [
      { ...stub({ slug: "a", isOwner: true }), profileIconId: 42 },
      { ...stub({ slug: "b" }), profileIconId: null },
    ];
    const owners = getOwnerAccounts(accounts);
    expect(owners).toHaveLength(1);
    expect(owners[0]?.profileIconId).toBe(42);
  });
});

describe("getPrimaryAccount", () => {
  it("returns the single isPrimary account", () => {
    const primary = stub({ slug: "main", isOwner: true, isPrimary: true });
    const accounts = [stub({ slug: "alt", isOwner: true }), primary];
    expect(getPrimaryAccount(accounts)?.slug).toBe("main");
  });

  it("returns null when no account is flagged primary", () => {
    expect(
      getPrimaryAccount([
        stub({ slug: "a", isOwner: true }),
        stub({ slug: "b", isOwner: true }),
      ])
    ).toBeNull();
  });
});

describe("assertAccountOwnerInvariants", () => {
  it("passes when no accounts carry owner flags", () => {
    expect(() =>
      assertAccountOwnerInvariants([stub({ slug: "a" }), stub({ slug: "b" })])
    ).not.toThrow();
  });

  it("passes for exactly one owner+primary alongside non-owner test data", () => {
    expect(() =>
      assertAccountOwnerInvariants([
        stub({ slug: "main", isOwner: true, isPrimary: true }),
        stub({ slug: "alt", isOwner: true }),
        stub({ slug: "test" }),
      ])
    ).not.toThrow();
  });

  it("throws when multiple accounts are flagged isPrimary", () => {
    expect(() =>
      assertAccountOwnerInvariants([
        stub({ slug: "a", isOwner: true, isPrimary: true }),
        stub({ slug: "b", isOwner: true, isPrimary: true }),
      ])
    ).toThrow(/Multiple accounts flagged isPrimary: a, b/);
  });

  it("throws when owners exist but none is primary — the recap would have no main subject", () => {
    expect(() =>
      assertAccountOwnerInvariants([
        stub({ slug: "a", isOwner: true }),
        stub({ slug: "b", isOwner: true }),
      ])
    ).toThrow(/At least one owner account exists but none is flagged isPrimary/);
  });

  it("throws when isPrimary is set on a non-owner account", () => {
    // Semantically broken — "primary among nothing" — and would slip past the
    // owners.length === 0 branch unless we check explicitly.
    expect(() =>
      assertAccountOwnerInvariants([
        stub({ slug: "a", isPrimary: true }),
        stub({ slug: "b", isOwner: true }),
      ])
    ).toThrow(/"a" is flagged isPrimary without isOwner/);
  });
});
