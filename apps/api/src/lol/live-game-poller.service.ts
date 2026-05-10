import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { LolAccount } from "@vyoh/shared";
import type { LiveBan, LiveGameParticipant, LiveMatch } from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type { Platform } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import type { RiotActiveGame, RiotActiveGameParticipant } from "../riot/types";
import { MatchEventsService } from "./match-events.service";

const POLL_INTERVAL_MS = 60_000;

type PlayerEnrichment = {
  rank: LiveGameParticipant["rank"];
  mastery: LiveGameParticipant["mastery"];
  recentForm: boolean[] | null;
};

type PuuidEntry = {
  game: RiotActiveGame | null;
  gameId: number | null;
  enrichment: Map<string, PlayerEnrichment>; // keyed by participant puuid
  polledAt: number;
};

function parsePuuidPlatform(account: LolAccount): Platform {
  return account.region.toLowerCase() as Platform;
}

function parseRiotId(riotId: string): { gameName: string; tagLine: string } {
  const idx = riotId.lastIndexOf("#");
  if (idx === -1) return { gameName: riotId, tagLine: "" };
  return { gameName: riotId.slice(0, idx), tagLine: riotId.slice(idx + 1) };
}

function keystoneFromPerks(perks: RiotActiveGameParticipant["perks"]): number {
  return perks.perkIds[0] ?? 0;
}

@Injectable()
export class LiveGamePollerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LiveGamePollerService.name);
  private readonly cache = new Map<string, PuuidEntry>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService,
    private readonly identity: IdentityService,
    private readonly events: MatchEventsService
  ) {}

  onApplicationBootstrap(): void {
    void this.poll();
    this.interval = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  getForPuuid(puuid: string): LiveMatch | null {
    const entry = this.cache.get(puuid);
    if (!entry?.game) return null;
    return this.projectLiveMatch(entry.game, entry.enrichment, entry.polledAt);
  }

  private async poll(): Promise<void> {
    const accounts = this.identity.getLolAccounts();
    for (const account of accounts) {
      try {
        await this.pollAccount(account);
      } catch (err) {
        this.logger.warn(
          `poll failed for ${account.gameName}#${account.tagLine}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  private async pollAccount(account: LolAccount): Promise<void> {
    const summoner = await this.prisma.summoner.findUnique({
      where: {
        gameName_tagLine_region: {
          gameName: account.gameName,
          tagLine: account.tagLine,
          region: account.region,
        },
      },
      select: { puuid: true },
    });
    if (!summoner) return; // not yet synced

    const { puuid } = summoner;
    const platform = parsePuuidPlatform(account);
    const prev = this.cache.get(puuid);
    const polledAt = Date.now();

    const game = await this.riot.getActiveGameByPuuid(puuid, platform);

    const isNewGame = game !== null && game.gameId !== prev?.gameId;
    const isEnded = game === null && prev?.game !== null && prev?.game !== undefined;

    let enrichment: Map<string, PlayerEnrichment> = prev?.enrichment ?? new Map();

    if (isNewGame) {
      enrichment = new Map();
      this.cache.set(puuid, { game, gameId: game.gameId, enrichment, polledAt });
      this.events.emitLiveGame({ type: "game-started", puuid });
      // Kick off enrichment fire-and-forget; updates cache as results arrive
      void this.enrichGame(game, platform, puuid);
    } else if (isEnded) {
      this.cache.set(puuid, { game: null, gameId: null, enrichment, polledAt });
      this.events.emitLiveGame({ type: "game-ended", puuid });
    } else {
      // Same game or still no game — update polledAt so the timer stays accurate
      this.cache.set(puuid, { game, gameId: game?.gameId ?? null, enrichment, polledAt });
    }
  }

  private async enrichGame(
    game: RiotActiveGame,
    platform: Platform,
    ownerPuuid: string
  ): Promise<void> {
    const entry = this.cache.get(ownerPuuid);
    if (!entry || entry.gameId !== game.gameId) return;

    // Resolve which participant puuids are whitelisted accounts (have match history in DB)
    const whitelistedSet = new Set<string>();
    for (const a of this.identity.getLolAccounts()) {
      const s = await this.prisma.summoner.findUnique({
        where: {
          gameName_tagLine_region: {
            gameName: a.gameName,
            tagLine: a.tagLine,
            region: a.region,
          },
        },
        select: { puuid: true },
      });
      if (s) whitelistedSet.add(s.puuid);
    }

    await Promise.allSettled(
      game.participants.map(async (p) => {
        const [rankEntries, mastery, recentFormRows] = await Promise.allSettled([
          this.riot.getLeagueEntriesByPuuid(p.puuid, platform),
          this.riot.getChampionMasteryByChampion(p.puuid, platform, p.championId),
          whitelistedSet.has(p.puuid)
            ? this.prisma.match.findMany({
                where: { puuid: p.puuid, remake: false },
                orderBy: { playedAt: "desc" },
                take: 5,
                select: { win: true },
              })
            : Promise.resolve(null),
        ]);

        // Re-check the entry is still for the same game before writing
        const currentEntry = this.cache.get(ownerPuuid);
        if (!currentEntry || currentEntry.gameId !== game.gameId) return;

        const soloEntry =
          rankEntries.status === "fulfilled"
            ? (rankEntries.value.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null)
            : null;

        const rank = soloEntry
          ? {
              tier: soloEntry.tier,
              rank: soloEntry.rank,
              lp: soloEntry.leaguePoints,
              wins: soloEntry.wins,
              losses: soloEntry.losses,
            }
          : null;

        const masteryData = mastery.status === "fulfilled" ? mastery.value : null;

        const recentForm =
          recentFormRows.status === "fulfilled" && recentFormRows.value !== null
            ? (recentFormRows.value as { win: boolean }[]).map((r) => r.win)
            : null;

        currentEntry.enrichment.set(p.puuid, {
          rank,
          mastery: masteryData
            ? { level: masteryData.championLevel, points: masteryData.championPoints }
            : null,
          recentForm,
        });
      })
    );
  }

  private projectLiveMatch(
    game: RiotActiveGame,
    enrichment: Map<string, PlayerEnrichment>,
    polledAt: number
  ): LiveMatch {
    const participants: LiveGameParticipant[] = game.participants.map((p) => {
      const { gameName, tagLine } = parseRiotId(p.riotId);
      const e = enrichment.get(p.puuid);
      return {
        puuid: p.puuid,
        teamId: p.teamId,
        championId: p.championId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        keystone: keystoneFromPerks(p.perks),
        riotIdGameName: gameName,
        riotIdTagLine: tagLine,
        rank: e?.rank ?? null,
        mastery: e?.mastery ?? null,
        recentForm: e?.recentForm ?? null,
      };
    });

    const bans: LiveBan[] = game.bannedChampions.map((b) => ({
      teamId: b.teamId,
      championId: b.championId,
      pickTurn: b.pickTurn,
    }));

    return {
      gameId: game.gameId,
      gameStartTime: game.gameStartTime,
      gameLength: game.gameLength,
      polledAt,
      queueId: game.gameQueueConfigId,
      mapId: game.mapId,
      gameMode: game.gameMode,
      platformId: game.platformId,
      participants,
      bans,
    };
  }
}
