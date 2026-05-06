import { Injectable } from "@nestjs/common";
import { requireEnv } from "../env";
import type { Regional } from "./regions";
import type { RiotAccount, RiotMatch } from "./types";

@Injectable()
export class RiotService {
  private readonly apiKey: string;

  constructor() {
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
    const url = `https://${regional}.api.riotgames.com${path}`;
    const res = await fetch(url, {
      headers: { "X-Riot-Token": this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Riot API ${res.status} ${res.statusText} on ${path}`);
    }
    return res.json() as Promise<T>;
  }
}
