import { Injectable, Logger } from "@nestjs/common";
import { requireEnv } from "../env";
import { RateLimiterService } from "./rate-limiter.service";
import type { Regional } from "./regions";
import { RiotError } from "./riot.error";
import type { RiotAccount, RiotMatch } from "./types";

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
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
  }

  async getMatchIdsByPuuid(
    puuid: string,
    regional: Regional,
    options: { start?: number; count?: number } = {}
  ): Promise<string[]> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.set("start", String(options.start));
    if (options.count !== undefined) params.set("count", String(options.count));
    const query = params.size > 0 ? `?${params}` : "";
    return this.fetch<string[]>(
      regional,
      `/lol/match/v5/matches/by-puuid/${puuid}/ids${query}`
    );
  }

  async getMatchById(matchId: string, regional: Regional): Promise<RiotMatch> {
    return this.fetch<RiotMatch>(regional, `/lol/match/v5/matches/${matchId}`);
  }

  private async fetch<T>(regional: Regional, path: string): Promise<T> {
    return this.limiter.schedule(regional, async () => {
      const start = Date.now();
      const url = `https://${regional}.api.riotgames.com${path}`;
      const res = await fetch(url, {
        headers: { "X-Riot-Token": this.apiKey },
      });
      const duration = Date.now() - start;
      this.logger.log(`${regional} ${path} → ${res.status} (${duration}ms)`);

      if (!res.ok) {
        throw new RiotError(
          `Riot API ${res.status} ${res.statusText} on ${path}`,
          res.status,
          path
        );
      }
      return res.json() as Promise<T>;
    });
  }
}
