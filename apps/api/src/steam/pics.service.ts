import { Injectable, Logger } from "@nestjs/common";
import SteamUser from "steam-user";

export type SteamPicsLogoAsset = {
  appid: number;
  // 40-char SHA1-shaped hash that goes into the
  // `…/store_item_assets/steam/apps/<appid>/<hash>/logo.png` URL. Null when
  // PICS didn't return a logo entry for this app.
  logoHash: string | null;
  // PICS change number for the app. Opaque integer that increments whenever
  // the app's metadata changes; used as a `?t=` cache-buster downstream.
  changeNumber: number | null;
};

const PICS_LOGON_TIMEOUT_MS = 20_000;
const PICS_PRODUCT_INFO_TIMEOUT_MS = 30_000;

@Injectable()
export class SteamPicsService {
  private readonly logger = new Logger(SteamPicsService.name);

  async getLogoAssets(appids: number[]): Promise<SteamPicsLogoAsset[]> {
    if (appids.length === 0) return [];

    const client = this.createClient();
    try {
      await this.logOnAnonymous(client);
      const response = await withTimeout(
        client.getProductInfo(appids, [], false),
        PICS_PRODUCT_INFO_TIMEOUT_MS,
        "PICS getProductInfo"
      );
      return appids.map((appid) =>
        this.extractLogoAsset(appid, response.apps[String(appid)])
      );
    } finally {
      try {
        client.logOff();
      } catch (err) {
        // logOff is best-effort cleanup; never rethrow from finally.
        this.logger.warn(`Steam PICS logOff failed cleanly: ${describeError(err)}`);
      }
    }
  }

  // Test seam: overridden in specs to inject a fake SteamUser without
  // routing through Nest's DI (a constructor-injected factory would
  // confuse Nest into trying to resolve the type at module init).
  protected createClient(): SteamUser {
    return new SteamUser();
  }

  private logOnAnonymous(client: SteamUser): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Steam PICS anonymous logon timed out after ${PICS_LOGON_TIMEOUT_MS}ms`
          )
        );
      }, PICS_LOGON_TIMEOUT_MS);

      const onLoggedOn = () => {
        cleanup();
        resolve();
      };
      const onError = (err: unknown) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(describeError(err)));
      };
      const cleanup = () => {
        clearTimeout(timer);
        client.removeListener("loggedOn", onLoggedOn);
        client.removeListener("error", onError);
      };

      client.once("loggedOn", onLoggedOn);
      client.once("error", onError);
      client.logOn({ anonymous: true });
    });
  }

  private extractLogoAsset(
    appid: number,
    entry: { changenumber: number; appinfo: unknown } | undefined
  ): SteamPicsLogoAsset {
    if (!entry) return { appid, logoHash: null, changeNumber: null };
    const hash = extractLogoHash(entry.appinfo);
    return {
      appid,
      logoHash: hash,
      changeNumber: entry.changenumber ?? null,
    };
  }
}

// Steam ships two shapes for `common.library_assets`. Older apps use the flat
// form where each asset is a bare hash string; newer apps (RE Requiem,
// Pragmata) use `library_assets_full` where each asset is an `{image, image2x}`
// pair. We only need the standard-res `logo` hash — the public CDN serves the
// 2x variant from the same hash directory.
function extractLogoHash(appinfo: unknown): string | null {
  if (!isRecord(appinfo)) return null;
  const common = appinfo.common;
  if (!isRecord(common)) return null;

  const full = common.library_assets_full;
  if (isRecord(full)) {
    const logo = full.library_logo;
    if (isRecord(logo) && typeof logo.image === "string") {
      return normalizeHash(logo.image);
    }
  }

  const flat = common.library_assets;
  if (isRecord(flat) && typeof flat.library_logo === "string") {
    return normalizeHash(flat.library_logo);
  }

  return null;
}

function normalizeHash(value: string): string | null {
  // Steam asset hashes are 40-char lowercase hex. PICS occasionally returns
  // values with a trailing `_2x` suffix or other suffixes for variants;
  // strip back to the canonical hash.
  const match = value.match(/^[0-9a-f]{40}/);
  return match ? match[0] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}
