import { EventEmitter } from "node:events";
import type SteamUser from "steam-user";
import { describe, expect, it, vi } from "vitest";
import { SteamPicsService } from "./pics.service";

type FakeAppinfo = {
  common?: {
    library_assets?: { library_logo?: string };
    library_assets_full?: { library_logo?: { image?: string; image2x?: string } };
  };
};

class FakeSteamUser extends EventEmitter {
  logOn = vi.fn(() => {
    setImmediate(() => this.emit("loggedOn"));
  });
  logOff = vi.fn();
  getProductInfo = vi.fn();

  // Helper to script the per-test response.
  static next: {
    logOnError?: unknown;
    productInfo?: {
      apps: Record<string, { changenumber: number; appinfo: FakeAppinfo }>;
    };
    productInfoDelay?: number;
  } = {};

  constructor() {
    super();
    this.logOn = vi.fn(() => {
      const scripted = FakeSteamUser.next;
      setImmediate(() => {
        if (scripted.logOnError) {
          this.emit("error", scripted.logOnError);
        } else {
          this.emit("loggedOn");
        }
      });
    });
    this.getProductInfo = vi.fn(
      () =>
        new Promise((resolve) => {
          const scripted = FakeSteamUser.next;
          setTimeout(
            () =>
              resolve(
                scripted.productInfo ?? {
                  apps: {},
                  packages: {},
                  unknownApps: [],
                  unknownPackages: [],
                }
              ),
            scripted.productInfoDelay ?? 0
          );
        })
    );
  }
}

// Subclass that swaps the SteamUser client for a controllable fake. The base
// service uses a protected `createClient()` test seam precisely because Nest
// can't resolve a constructor-injected factory at module init.
class TestableSteamPicsService extends SteamPicsService {
  protected override createClient(): SteamUser {
    return new FakeSteamUser() as unknown as SteamUser;
  }
}

describe("SteamPicsService.getLogoAssets", () => {
  it("returns an empty array without touching steam-user when no appids", async () => {
    const service = new TestableSteamPicsService();
    expect(await service.getLogoAssets([])).toEqual([]);
  });

  it("extracts the logo hash from `library_assets_full` (newer shape)", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "3764200": {
            changenumber: 12345,
            appinfo: {
              common: {
                library_assets_full: {
                  library_logo: {
                    image: "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47",
                  },
                },
              },
            },
          },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([3764200]);
    expect(result).toEqual([
      {
        appid: 3764200,
        logoHash: "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47",
        changeNumber: 12345,
      },
    ]);
  });

  it("extracts the logo hash from the flat `library_assets` (older shape)", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "440": {
            changenumber: 99,
            appinfo: {
              common: {
                library_assets: {
                  library_logo: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                },
              },
            },
          },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([440]);
    expect(result[0]?.logoHash).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(result[0]?.changeNumber).toBe(99);
  });

  it("returns null hash for appids missing from the PICS response", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {},
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([3764200]);
    expect(result).toEqual([{ appid: 3764200, logoHash: null, changeNumber: null }]);
  });

  it("returns null hash when `common.library_assets*` is absent", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "111": { changenumber: 1, appinfo: { common: {} } },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([111]);
    expect(result[0]?.logoHash).toBeNull();
    expect(result[0]?.changeNumber).toBe(1);
  });

  it("preserves caller-supplied appid order even when PICS reorders", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "222": { changenumber: 2, appinfo: { common: {} } },
          "111": { changenumber: 1, appinfo: { common: {} } },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([111, 222]);
    expect(result.map((r) => r.appid)).toEqual([111, 222]);
  });

  it("rejects when steam-user emits `error` during logon", async () => {
    FakeSteamUser.next = { logOnError: new Error("CM unreachable") };
    const service = new TestableSteamPicsService();
    await expect(service.getLogoAssets([3764200])).rejects.toThrow("CM unreachable");
  });

  it("strips trailing variant suffixes from non-canonical hashes", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "1": {
            changenumber: 1,
            appinfo: {
              common: {
                library_assets_full: {
                  library_logo: {
                    image: "abcdef0123456789abcdef0123456789abcdef01_2x",
                  },
                },
              },
            },
          },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([1]);
    expect(result[0]?.logoHash).toBe("abcdef0123456789abcdef0123456789abcdef01");
  });
});
