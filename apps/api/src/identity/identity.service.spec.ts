import { describe, expect, it } from "vitest";
import type { AccountsConfig } from "./identity.service";
import { IdentityService } from "./identity.service";

const config: AccountsConfig = {
  lol: [{ gameName: "Vyoh", tagLine: "Ahri", region: "euw1" }],
  steam: [],
};

describe("IdentityService", () => {
  it("returns the configured lol accounts", () => {
    const service = new IdentityService(config);
    expect(service.getLolAccounts()).toEqual(config.lol);
  });

  it("returns the configured steam ids", () => {
    const service = new IdentityService(config);
    expect(service.getSteamIds()).toEqual([]);
  });

  it("recognizes a whitelisted account case-insensitively", () => {
    const service = new IdentityService(config);
    expect(service.isLolAccountAllowed("vyoh", "ahri", "EUW1")).toBe(true);
    expect(service.isLolAccountAllowed("Vyoh", "Ahri", "euw1")).toBe(true);
  });

  it("rejects an account that is not in the whitelist", () => {
    const service = new IdentityService(config);
    expect(service.isLolAccountAllowed("Foo", "Bar", "euw1")).toBe(false);
    expect(service.isLolAccountAllowed("Vyoh", "Ahri", "na1")).toBe(false);
  });
});
