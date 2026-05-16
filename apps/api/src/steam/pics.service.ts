import { Injectable, Logger } from "@nestjs/common";
import SteamUser from "steam-user";

export type SteamPicsLogoAsset = {
  appid: number;
  // `<hash>/<filename>` fragment that slots into the
  // `…/store_item_assets/steam/apps/<appid>/<path>` URL. Same shape as the
  // other enrichment asset paths (`library_capsule: "1eebc7e0/library_capsule.jpg"`)
  // so the frontend can share `composeSrc`. Null when PICS didn't return a
  // logo entry for this app.
  logoPath: string | null;
  // PICS change number for the app. Opaque integer that increments whenever
  // the app's metadata changes; used for observability, not URL composition.
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
    if (!entry) return { appid, logoPath: null, changeNumber: null };
    const logoPath = extractLogoPath(entry.appinfo);
    return {
      appid,
      logoPath,
      changeNumber: entry.changenumber ?? null,
    };
  }
}

// PICS shape (confirmed against live anonymous logon, 2026-05-16):
//   common.library_assets_full.library_logo.image = {
//     english: "<hash>/logo.png", japanese: "<hash>/logo_japanese.png", ...
//   }
//   common.library_assets.library_logo = "en,ja,ko"   (just a marker, no hash)
//
// We persist the English variant as the canonical path — Steam serves it from
// the same hashed CDN directory as the other assets. Falls through to the
// first available locale if English is missing (rare), and to null when no
// `library_assets_full` block exists (older titles where PICS doesn't carry
// the full asset manifest).
function extractLogoPath(appinfo: unknown): string | null {
  if (!isRecord(appinfo)) return null;
  const common = appinfo.common;
  if (!isRecord(common)) return null;

  const full = common.library_assets_full;
  if (!isRecord(full)) return null;
  const logo = full.library_logo;
  if (!isRecord(logo)) return null;
  const image = logo.image;
  if (!isRecord(image)) {
    // Defensive fallback for an older shape where `image` is a bare string.
    return typeof image === "string" ? image : null;
  }
  if (typeof image.english === "string") return image.english;
  for (const value of Object.values(image)) {
    if (typeof value === "string") return value;
  }
  return null;
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
