import { Injectable, Logger } from "@nestjs/common";
import { requireEnv } from "../env";
import type { MethodFamily } from "./method-families";
import { RateLimiterService } from "./rate-limiter.service";
import type { Platform, Regional } from "./regions";
import { platformToRegional } from "./regions";
import { RiotError } from "./riot.error";
import type { RiotAccount, RiotLeagueEntry, RiotMatch, RiotSummoner } from "./types";

const MAX_RETRIES = 2;
const FETCH_TIMEOUT_MS = 10_000;
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class RiotService {
  private readonly logger = new Logger(RiotService.name);
  private readonly apiKey: string;

  constructor(private readonly limiter: RateLimiterService) {
    this.apiKey = requireEnv("RIOT_API_KEY");
  }

  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    host: Regional
  ): Promise<RiotAccount> {
    return this.fetch<RiotAccount>(
      host,
      "account-by-riot-id",
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
  }

  async getMatchIdsByPuuid(
    puuid: string,
    host: Regional,
    options: {
      start?: number;
      count?: number;
      queue?: number;
      endTime?: number;
    } = {}
  ): Promise<string[]> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.set("start", String(options.start));
    if (options.count !== undefined) params.set("count", String(options.count));
    if (options.queue !== undefined) params.set("queue", String(options.queue));
    // Riot's `endTime` is epoch seconds, exclusive: returns matches strictly
    // older than the boundary. The historical worker uses this to walk
    // backwards from the oldest match in the DB without drifting when new
    // games are appended at the head.
    if (options.endTime !== undefined) params.set("endTime", String(options.endTime));
    const query = params.size > 0 ? `?${params}` : "";
    return this.fetch<string[]>(
      host,
      "match-ids-by-puuid",
      `/lol/match/v5/matches/by-puuid/${puuid}/ids${query}`
    );
  }

  async getMatchById(matchId: string, host: Regional): Promise<RiotMatch> {
    return this.fetch<RiotMatch>(host, "match-by-id", `/lol/match/v5/matches/${matchId}`);
  }

  async getLeagueEntriesByPuuid(
    puuid: string,
    platform: Platform
  ): Promise<RiotLeagueEntry[]> {
    const rateKey = platformToRegional(platform);
    return this.limiter.schedule(rateKey, "league-entries-by-puuid", () =>
      this.fetchWithRetry<RiotLeagueEntry[]>(
        platform,
        rateKey,
        "league-entries-by-puuid",
        `/lol/league/v4/entries/by-puuid/${puuid}`,
        0
      )
    );
  }

  async getSummonerByPuuid(puuid: string, platform: Platform): Promise<RiotSummoner> {
    const rateKey = platformToRegional(platform);
    return this.limiter.schedule(rateKey, "summoner-by-puuid", () =>
      this.fetchWithRetry<RiotSummoner>(
        platform,
        rateKey,
        "summoner-by-puuid",
        `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        0
      )
    );
  }

  private async fetch<T>(host: Regional, family: MethodFamily, path: string): Promise<T> {
    return this.limiter.schedule(host, family, () =>
      this.fetchWithRetry<T>(host, host, family, path, 0)
    );
  }

  private async fetchWithRetry<T>(
    host: string,
    rateKey: Regional,
    family: MethodFamily,
    path: string,
    attempt: number
  ): Promise<T> {
    const start = performance.now();
    const url = `https://${host}.api.riotgames.com${path}`;

    // We've observed Node's built-in `fetch` (undici under the hood) ignore
    // both `AbortSignal.timeout` and `AbortController.abort()` when a
    // connection stalls — the signal fires but the underlying fetch promise
    // stays pending forever, leaving a Bottleneck slot wedged in `executing`
    // and the api unresponsive after a few zombie fetches accumulate.
    //
    // Fix: race the fetch against a hard timeout we control. If the timeout
    // wins, our await throws and the caller (and thus the limiter slot)
    // unblocks. The fetch promise itself remains pending in the event loop
    // and the socket leaks until Node's TCP layer reaps it — acceptable
    // worst case, since the alternative is "the api is hung."
    //
    // We also still attach an AbortSignal — if undici *does* honor it, great,
    // we close the socket eagerly. If not, the race still saves us.
    this.logger.log(`${host} ${path} → fetchWithRetry start`);

    let res: Response;
    const ctrl = new AbortController();
    const timeoutErr = new Error(`fetch timeout after ${FETCH_TIMEOUT_MS}ms`);
    timeoutErr.name = "TimeoutError";
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const hardTimeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        this.logger.warn(
          `${host} ${path} → hardTimeout setTimeout fired at ${FETCH_TIMEOUT_MS}ms`
        );
        ctrl.abort(timeoutErr);
        reject(timeoutErr);
      }, FETCH_TIMEOUT_MS);
    });
    const fetchPromise = fetch(url, {
      headers: { "X-Riot-Token": this.apiKey },
      signal: ctrl.signal,
    });

    try {
      res = await Promise.race([fetchPromise, hardTimeout]);
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      this.logger.warn(
        `${host} ${path} → fetch error after ${duration}ms: ${formatError(err)}`
      );
      if (isAbortTimeout(err)) {
        throw new RiotError(
          `Riot API fetch timeout after ${FETCH_TIMEOUT_MS}ms on ${path}`,
          504,
          path
        );
      }
      throw err;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const duration = Math.round(performance.now() - start);
    this.logger.log(`${host} ${path} → ${res.status} (${duration}ms)`);

    await this.limiter.syncFromHeaders(rateKey, family, res.headers);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 1;
      const limitType = res.headers.get("X-Rate-Limit-Type") ?? "unknown";
      this.logger.warn(
        `429 (${limitType}) on ${path} — retrying in ${retryAfter}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(retryAfter * 1000);
      return this.fetchWithRetry(host, rateKey, family, path, attempt + 1);
    }

    if (!res.ok) {
      throw new RiotError(
        `Riot API ${res.status} ${res.statusText} on ${path}`,
        res.status,
        path
      );
    }
    return res.json() as Promise<T>;
  }
}

function isAbortTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError";
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? ` (cause: ${err.cause.name})` : "";
    return `${err.name}: ${err.message}${cause}`;
  }
  return String(err);
}
