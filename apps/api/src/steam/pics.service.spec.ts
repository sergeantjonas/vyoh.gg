import { EventEmitter } from "node:events";
import type SteamUser from "steam-user";
import { describe, expect, it, vi } from "vitest";
import { SteamPicsService } from "./pics.service";

type FakeAppinfo = {
  common?: {
    library_assets?: { library_logo?: string };
    library_assets_full?: {
      library_logo?: {
        image?: Record<string, string> | string;
        image2x?: Record<string, string>;
      };
    };
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

  it("picks the english locale variant when library_assets_full carries multi-locale images", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "3764200": {
            changenumber: 12345,
            appinfo: {
              common: {
                library_assets_full: {
                  library_logo: {
                    image: {
                      english: "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png",
                      japanese:
                        "eb72437e3189209b84923e7b53f4fdec1b79fc72/logo_japanese.png",
                    },
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
        logoPath: "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png",
        changeNumber: 12345,
      },
    ]);
  });

  it("falls back to the first available locale when english is missing", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "440": {
            changenumber: 99,
            appinfo: {
              common: {
                library_assets_full: {
                  library_logo: {
                    image: {
                      japanese: "eb72437e/logo_japanese.png",
                      koreana: "deadbeef/logo_koreana.png",
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([440]);
    expect(result[0]?.logoPath).toBe("eb72437e/logo_japanese.png");
  });

  it("handles the older bare-string `image` shape defensively", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "1": {
            changenumber: 1,
            appinfo: {
              common: {
                library_assets_full: {
                  library_logo: {
                    image: "abcdef01/logo.png",
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
    expect(result[0]?.logoPath).toBe("abcdef01/logo.png");
  });

  it("returns null logoPath when library_assets_full is absent", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "111": { changenumber: 1, appinfo: { common: {} } },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([111]);
    expect(result[0]?.logoPath).toBeNull();
    expect(result[0]?.changeNumber).toBe(1);
  });

  it("ignores the flat `library_assets.library_logo` marker (no hash there)", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {
          "222": {
            changenumber: 2,
            appinfo: {
              common: {
                library_assets: { library_logo: "en,ja,ko" },
              },
            },
          },
        },
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([222]);
    expect(result[0]?.logoPath).toBeNull();
  });

  it("returns null logoPath for appids missing from the PICS response", async () => {
    FakeSteamUser.next = {
      productInfo: {
        apps: {},
      },
    };
    const service = new TestableSteamPicsService();
    const result = await service.getLogoAssets([3764200]);
    expect(result).toEqual([{ appid: 3764200, logoPath: null, changeNumber: null }]);
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
});
