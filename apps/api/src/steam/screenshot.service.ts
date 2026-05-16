import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SteamGameMedia, SteamScreenshot } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamRateLimiterService } from "./rate-limiter.service";

// store.steampowered.com/api/appdetails is a separate host from
// api.steampowered.com — different rate budget (~200 req / 5 min per IP) and
// no API key required. Routed through the existing limiter under a distinct
// family name so concurrency + retry telemetry stays consistent across Steam
// endpoints; the reservoir over-charges by routing it through the api-key
// budget but the volume is so low (lazy hover only) the bookkeeping mismatch
// is negligible.
const APPDETAILS_BASE = "https://store.steampowered.com/api/appdetails";
const APPDETAILS_FETCH_TIMEOUT_MS = 10_000;
const SCREENSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
// Steam returns 10–30 screenshots per game; the hovercard rotates through 3–5.
// Cap at 6 so the persisted JSON stays small while leaving room for variety.
const MAX_SCREENSHOTS = 6;

interface AppdetailsScreenshotRaw {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

interface AppdetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: {
      screenshots?: AppdetailsScreenshotRaw[];
    };
  };
}

export function projectScreenshots(raw: AppdetailsScreenshotRaw[]): SteamScreenshot[] {
  return raw.slice(0, MAX_SCREENSHOTS).map((s) => ({
    thumbUrl: s.path_thumbnail,
    fullUrl: s.path_full,
  }));
}

@Injectable()
export class SteamScreenshotService {
  private readonly logger = new Logger(SteamScreenshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: SteamRateLimiterService
  ) {}

  // Read endpoint with stale-while-revalidate semantics. First hover blocks on
  // the live fetch (so the popover renders with screenshots immediately rather
  // than an empty frame followed by a refresh tick). Subsequent hovers within
  // the TTL serve cached and skip the network entirely. Past the TTL we return
  // cached now and fire a background refresh; the next hover sees the fresh
  // payload. Persists `screenshots: []` for known-empty upstream responses so
  // private/demo/region-blocked appids don't re-fetch on every hover.
  async getGameMedia(appid: number): Promise<SteamGameMedia> {
    const owned = await this.prisma.steamOwnedGame.findUnique({
      where: { appid },
      select: { appid: true },
    });
    if (owned === null) {
      throw new NotFoundException(`Steam game ${appid} is not owned.`);
    }

    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { screenshots: true, screenshotsFetchedAt: true },
    });

    if (row === null || row.screenshotsFetchedAt === null) {
      return this.refreshScreenshots(appid);
    }

    const age = Date.now() - row.screenshotsFetchedAt.getTime();
    if (age > SCREENSHOT_TTL_MS) {
      // Stale-while-revalidate: serve cached, refresh in background. Promise
      // is intentionally unawaited; failures log and don't disturb the hover.
      this.refreshScreenshots(appid).catch((err) => {
        this.logger.warn(`screenshot refresh ${appid} failed: ${err}`);
      });
    }

    return {
      appid,
      screenshots: row.screenshots as unknown as SteamScreenshot[],
      fetchedAt: row.screenshotsFetchedAt.toISOString(),
    };
  }

  // Fetches appdetails, normalizes, persists, returns the row. Upserts into
  // SteamGameEnrichment so a game added today (before the enrichment cron
  // bootstraps its row) can still record screenshots — the next enrichment
  // tick's `update` branch fills in the rest without clobbering screenshots.
  private async refreshScreenshots(appid: number): Promise<SteamGameMedia> {
    const raw = await this.limiter.schedule("appdetails-screenshots", async () => {
      return this.fetchScreenshots(appid);
    });
    const screenshots = projectScreenshots(raw);
    const fetchedAt = new Date();

    await this.prisma.steamGameEnrichment.upsert({
      where: { appid },
      create: {
        appid,
        screenshots: screenshots as unknown as object,
        screenshotsFetchedAt: fetchedAt,
        tagIds: [],
        featureCategoryIds: [],
      },
      update: {
        screenshots: screenshots as unknown as object,
        screenshotsFetchedAt: fetchedAt,
      },
    });

    return { appid, screenshots, fetchedAt: fetchedAt.toISOString() };
  }

  private async fetchScreenshots(appid: number): Promise<AppdetailsScreenshotRaw[]> {
    const url = `${APPDETAILS_BASE}?appids=${appid}&filters=screenshots&l=english`;
    const ctrl = new AbortController();
    const timeoutErr = new Error(
      `appdetails fetch timeout after ${APPDETAILS_FETCH_TIMEOUT_MS}ms`
    );
    timeoutErr.name = "TimeoutError";
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const hardTimeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        ctrl.abort(timeoutErr);
        reject(timeoutErr);
      }, APPDETAILS_FETCH_TIMEOUT_MS);
    });
    const fetchPromise = fetch(url, { signal: ctrl.signal });

    let res: Response;
    try {
      res = await Promise.race([fetchPromise, hardTimeout]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    if (!res.ok) {
      this.logger.warn(`appdetails ${appid} → ${res.status} ${res.statusText}`);
      return [];
    }

    // appdetails returns the appid as the top-level key, regardless of how it
    // was passed. Steam also returns `success: false` for delisted / hidden /
    // region-blocked apps — treat as a known-empty result.
    const data = (await res.json()) as AppdetailsResponse;
    const entry = data[String(appid)];
    if (!entry?.success || !entry.data?.screenshots) return [];
    return entry.data.screenshots;
  }
}
