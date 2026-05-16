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

// Riot's spectator-v5 type says riotId is `string`, but in practice it can be
// null/empty (streamer mode hides opponents' Riot IDs until post-game).
export function parseRiotId(riotId: string | null | undefined): {
  gameName: string;
  tagLine: string;
} {
  if (!riotId) return { gameName: "", tagLine: "" };
  const idx = riotId.lastIndexOf("#");
  if (idx === -1) return { gameName: riotId, tagLine: "" };
  return { gameName: riotId.slice(0, idx), tagLine: riotId.slice(idx + 1) };
}

export function keystoneFromPerks(perks: RiotActiveGameParticipant["perks"]): number {
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

    const rawGame = await this.riot.getActiveGameByPuuid(puuid, platform);
    const game = rawGame ? this.cleanActiveGame(rawGame, account) : null;

    const isNewGame = game !== null && game.gameId !== prev?.gameId;
    const isEnded = game === null && prev?.game !== null && prev?.game !== undefined;

    let enrichment: Map<string, PlayerEnrichment> = prev?.enrichment ?? new Map();

    if (isNewGame) {
      enrichment = new Map();
      this.cache.set(puuid, { game, gameId: game.gameId, enrichment, polledAt });
      this.logger.log(
        `game-started ${account.gameName}#${account.tagLine} gameId=${game.gameId} queueId=${game.gameQueueConfigId}`
      );
      this.events.emitLiveGame({ type: "game-started", puuid });
      // Kick off enrichment fire-and-forget; updates cache as results arrive
      void this.enrichGame(game, platform, puuid);
    } else if (isEnded) {
      this.cache.set(puuid, { game: null, gameId: null, enrichment, polledAt });
      this.logger.log(
        `game-ended ${account.gameName}#${account.tagLine} gameId=${prev?.gameId ?? "?"}`
      );
      this.events.emitLiveGame({ type: "game-ended", puuid });
    } else {
      // Same game or still no game — update polledAt so the timer stays accurate
      this.cache.set(puuid, { game, gameId: game?.gameId ?? null, enrichment, polledAt });
    }
  }

  // Two distinct quirks in Riot's spectator-v5 response:
  //   1. Streamer mode: opponents come back with puuid=null and riotId set
  //      to the champion's name. These are real participant slots, not ghosts.
  //   2. Loading-screen ghosts: duplicate rows occasionally appear with the
  //      same (teamId, championId), all with puuid=null.
  // We dedupe on `puuid || anon-<teamId>-<championId>` so legitimate anonymous
  // players survive but ghost duplicates collapse. The synthetic key also
  // doubles as the stable React key downstream when puuid is missing.
  private cleanActiveGame(game: RiotActiveGame, account: LolAccount): RiotActiveGame {
    const seen = new Set<string>();
    const cleaned: RiotActiveGameParticipant[] = [];
    for (const p of game.participants) {
      const key = p.puuid || `anon-${p.teamId}-${p.championId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(p);
    }
    const dropped = game.participants.length - cleaned.length;
    if (dropped > 0) {
      this.logger.warn(
        `dropped ${dropped} duplicate participant row(s) from gameId=${game.gameId} for ${account.gameName}#${account.tagLine}`
      );
    }
    return dropped > 0 ? { ...game, participants: cleaned } : game;
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
        // Streamer-mode opponents have no puuid — skip enrichment for them.
        if (!p.puuid) return;
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
      const anonymous = !p.puuid;
      // For anonymous opponents Riot puts the champion name in riotId as a
      // placeholder — discard it so the frontend can render "Hidden" instead
      // of leaking the champion name into the player-name field.
      const { gameName, tagLine } = anonymous
        ? { gameName: "", tagLine: "" }
        : parseRiotId(p.riotId);
      const e = anonymous ? undefined : enrichment.get(p.puuid);
      return {
        puuid: p.puuid || `anon-${p.teamId}-${p.championId}`,
        anonymous,
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
