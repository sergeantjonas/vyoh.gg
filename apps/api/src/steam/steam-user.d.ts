declare module "steam-user" {
  import type { EventEmitter } from "node:events";

  type LogonOptions = { anonymous?: boolean };

  type AppInfoEntry = {
    changenumber: number;
    missingToken: boolean;
    appinfo: unknown;
  };

  type ProductInfoResponse = {
    apps: Record<string, AppInfoEntry>;
    packages: Record<string, unknown>;
    unknownApps: number[];
    unknownPackages: number[];
  };

  class SteamUser extends EventEmitter {
    logOn(options?: LogonOptions): void;
    logOff(): void;
    getProductInfo(
      appids: number[],
      packageids: number[],
      inclTokens?: boolean
    ): Promise<ProductInfoResponse>;
  }

  export = SteamUser;
}
