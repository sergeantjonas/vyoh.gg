import { Injectable, Logger } from "@nestjs/common";

const SGDB_BASE = "https://www.steamgriddb.com/api/v2";
const FETCH_TIMEOUT_MS = 5_000;

// Minimum width we'll accept from SGDB. Steam's own 1x hero is 1920×620, so
// anything narrower than that is no improvement over the fallback we already
// have. Most SGDB heroes are 1920×620 or 3840×1240 — the bimodal native sizes
// match Steam's library asset spec.
const MIN_HERO_WIDTH = 1920;

export interface SgdbHero {
  url: string;
  width: number;
  height: number;
}

interface SgdbHeroRow {
  id: number;
  score: number;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  epilepsy: boolean;
  url: string;
  mime?: string;
}

interface SgdbHeroResponse {
  success: boolean;
  data?: SgdbHeroRow[];
  // SGDB returns `errors: string[]` on failures.
  errors?: string[];
}

/**
 * Client for SteamGridDB's community-uploaded hero assets, used as a fallback
 * when a Steam publisher hasn't shipped `library_hero_2x.jpg` themselves (e.g.
 * RE3). Single method — given a Steam appid, returns the highest-scored hero
 * the community has uploaded at ≥1920w, or null when nothing usable exists.
 *
 * Optional integration: API key is read at construction; if missing the
 * service stays operational but every call short-circuits to null + a single
 * boot warning. This keeps enrichment runs working on hosts/CI without the
 * key configured.
 */
@Injectable()
export class SteamGridDbService {
  private readonly logger = new Logger(SteamGridDbService.name);
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.STEAM_GRIDDB_API_KEY;
    if (!this.apiKey) {
      this.logger.warn(
        "STEAM_GRIDDB_API_KEY missing — SteamGridDb fallback disabled, heroes for publishers without library_hero_2x.jpg will use 1x"
      );
    }
  }

  async findHero(appid: number): Promise<SgdbHero | null> {
    if (!this.apiKey) return null;

    // Hero rows can be tagged with `style=alternate|blurred|material|no_logo|
    // white_logo`; we don't constrain because the highest-scored row is
    // typically the canonical art regardless of style label. `types=static`
    // excludes animated heroes (we want a still backdrop). NSFW/humor/
    // epilepsy filters belt-and-suspender — also re-filtered client-side
    // since the API filter is documented as "all|true|false" and some
    // mirror nodes ignore it.
    const params = new URLSearchParams({
      types: "static",
      nsfw: "false",
      humor: "false",
      epilepsy: "false",
    });
    const url = `${SGDB_BASE}/heroes/steam/${appid}?${params.toString()}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: ac.signal,
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    } catch (err) {
      this.logger.warn(`SteamGridDb fetch failed for appid=${appid}: ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }

    // 404 — SGDB doesn't know the appid (rare but possible for delisted /
    // very-new titles). Treat as "no hero", not an error.
    if (res.status === 404) return null;
    if (!res.ok) {
      this.logger.warn(`SteamGridDb HTTP ${res.status} for appid=${appid}`);
      return null;
    }

    let body: SgdbHeroResponse;
    try {
      body = (await res.json()) as SgdbHeroResponse;
    } catch (err) {
      this.logger.warn(
        `SteamGridDb JSON parse failed for appid=${appid}: ${String(err)}`
      );
      return null;
    }

    if (!body.success || !body.data || body.data.length === 0) return null;

    // Defensive client-side filter — see comment above on the URL params.
    const usable = body.data.filter(
      (row) =>
        !row.nsfw &&
        !row.humor &&
        !row.epilepsy &&
        row.width >= MIN_HERO_WIDTH &&
        !!row.url
    );
    if (usable.length === 0) return null;

    // Highest score wins; tiebreak by width desc so a 3840×1240 beats a
    // 1920×620 at the same score (the larger source survives downscale
    // sampling better at 2560w consumer width).
    usable.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.width - a.width;
    });

    const top = usable[0];
    if (!top) return null;
    return { url: top.url, width: top.width, height: top.height };
  }
}
