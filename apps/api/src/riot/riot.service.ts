import { Injectable, Logger } from "@nestjs/common";
import { requireEnv } from "../env";
import type { MethodFamily } from "./method-families";
import { RateLimiterService } from "./rate-limiter.service";
import type { Regional } from "./regions";
import { RiotError } from "./riot.error";
import type { RiotAccount, RiotMatch } from "./types";

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
    regional: Regional
  ): Promise<RiotAccount> {
    return this.fetch<RiotAccount>(
      regional,
      "account-by-riot-id",
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
  }

  async getMatchIdsByPuuid(
    puuid: string,
    regional: Regional,
    options: { start?: number; count?: number; queue?: number } = {}
  ): Promise<string[]> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.set("start", String(options.start));
    if (options.count !== undefined) params.set("count", String(options.count));
    if (options.queue !== undefined) params.set("queue", String(options.queue));
    const query = params.size > 0 ? `?${params}` : "";
    return this.fetch<string[]>(
      regional,
      "match-ids-by-puuid",
      `/lol/match/v5/matches/by-puuid/${puuid}/ids${query}`
    );
  }

  async getMatchById(matchId: string, regional: Regional): Promise<RiotMatch> {
    return this.fetch<RiotMatch>(
      regional,
      "match-by-id",
      `/lol/match/v5/matches/${matchId}`
    );
  }

  private async fetch<T>(
    regional: Regional,
    family: MethodFamily,
    path: string
  ): Promise<T> {
    return this.limiter.schedule(regional, family, () =>
      this.fetchWithRetry<T>(regional, family, path, 0)
    );
  }

  private async fetchWithRetry<T>(
    regional: Regional,
    family: MethodFamily,
    path: string,
    attempt: number
  ): Promise<T> {
    const start = performance.now();
    const url = `https://${regional}.api.riotgames.com${path}`;

    // Use a manual AbortController + setTimeout instead of AbortSignal.timeout.
    // Reports of `AbortSignal.timeout` failing to interrupt fetches stuck in
    // DNS / TLS handshake on undici (notably under WSL2) made the timeout
    // ineffective in practice — observed 30s+ hangs even with a 10s signal.
    // The manual pattern is what undici's docs recommend when reliability
    // matters, and it gives us a sentinel error we can identify unambiguously.
    let res: Response;
    const ctrl = new AbortController();
    const timeoutErr = new Error(`fetch timeout after ${FETCH_TIMEOUT_MS}ms`);
    timeoutErr.name = "TimeoutError";
    const timeoutHandle = setTimeout(() => ctrl.abort(timeoutErr), FETCH_TIMEOUT_MS);

    try {
      res = await fetch(url, {
        headers: { "X-Riot-Token": this.apiKey },
        signal: ctrl.signal,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      // Always log the raw error so we have a trail when something exotic
      // (DNS stall, TLS bug, dispatcher fault) leaks through.
      this.logger.warn(
        `${regional} ${path} → fetch error after ${duration}ms: ${formatError(err)}`
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
      clearTimeout(timeoutHandle);
    }

    const duration = Math.round(performance.now() - start);
    this.logger.log(`${regional} ${path} → ${res.status} (${duration}ms)`);

    await this.limiter.syncFromHeaders(regional, family, res.headers);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 1;
      const limitType = res.headers.get("X-Rate-Limit-Type") ?? "unknown";
      this.logger.warn(
        `429 (${limitType}) on ${path} — retrying in ${retryAfter}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(retryAfter * 1000);
      return this.fetchWithRetry(regional, family, path, attempt + 1);
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
