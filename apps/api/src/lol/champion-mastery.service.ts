import { Injectable } from "@nestjs/common";
import type { ChampionMasteryList, ChampionMasteryResponse } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { Platform } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import type { RiotChampionMasteryEntry } from "../riot/types";
import { LolService } from "./lol.service";

// Mastery moves once per game, and the champion page reads it once per visit,
// so one Riot call per account per window is plenty. The window is what keeps
// the route cheap to hit: the api is public, and every miss spends Riot budget.
export const MASTERY_CACHE_MS = 15 * 60_000;

interface CachedMasteries {
  at: number;
  byChampionId: Promise<Map<number, RiotChampionMasteryEntry>>;
}

@Injectable()
export class ChampionMasteryService {
  // Keyed by puuid, which is bounded by the owner allowlist `resolveSummoner`
  // enforces, so the map cannot grow with what a caller asks for.
  private readonly cache = new Map<string, CachedMasteries>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService,
    private readonly lol: LolService
  ) {}

  async getChampionMastery(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string
  ): Promise<ChampionMasteryResponse> {
    const { puuid } = await this.lol.resolveSummoner(region, gameName, tagLine);
    const [champion, masteries] = await Promise.all([
      this.prisma.lolChampion.findFirst({
        where: { alias: { equals: championKey, mode: "insensitive" } },
        select: { id: true },
      }),
      this.masteriesFor(puuid, region.toLowerCase() as Platform),
    ]);
    const entry = champion ? masteries.get(champion.id) : undefined;
    if (!entry) return { mastery: null };
    return {
      mastery: {
        level: entry.championLevel,
        points: entry.championPoints,
        lastPlayedAt: new Date(entry.lastPlayTime).toISOString(),
      },
    };
  }

  // The same cached answer as the per-champion read, so opening the landing page
  // and then a champion costs one Riot call between them. A champion the static
  // sync has not stored yet has no alias to link to, so it is left out.
  async getMasteryList(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<ChampionMasteryList> {
    const { puuid } = await this.lol.resolveSummoner(region, gameName, tagLine);
    const masteries = await this.masteriesFor(puuid, region.toLowerCase() as Platform);
    const aliases = await this.prisma.lolChampion.findMany({
      where: { id: { in: [...masteries.keys()] } },
      select: { id: true, alias: true },
    });
    const aliasById = new Map(aliases.map((c) => [c.id, c.alias]));
    const champions = [...masteries.values()]
      .flatMap((e) => {
        const alias = aliasById.get(e.championId);
        return alias
          ? [
              {
                alias,
                level: e.championLevel,
                points: e.championPoints,
                lastPlayedAt: new Date(e.lastPlayTime).toISOString(),
              },
            ]
          : [];
      })
      .sort((a, b) => b.points - a.points || a.alias.localeCompare(b.alias));
    return { champions };
  }

  // The promise is what gets cached, so two panels opened at once share one
  // Riot call. A rejection is dropped rather than kept, so the next visit
  // retries instead of replaying the failure for the rest of the window.
  private masteriesFor(
    puuid: string,
    platform: Platform
  ): Promise<Map<number, RiotChampionMasteryEntry>> {
    const cached = this.cache.get(puuid);
    if (cached && Date.now() - cached.at < MASTERY_CACHE_MS) return cached.byChampionId;
    const byChampionId = this.riot
      .getChampionMasteries(puuid, platform)
      .then((entries) => new Map(entries.map((e) => [e.championId, e])));
    this.cache.set(puuid, { at: Date.now(), byChampionId });
    byChampionId.catch(() => {
      if (this.cache.get(puuid)?.byChampionId === byChampionId) this.cache.delete(puuid);
    });
    return byChampionId;
  }
}
