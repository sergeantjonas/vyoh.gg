import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  type ChampionBuildFlowEntry,
  type ChampionExtras,
  type ChampionPair,
  type Chronotype,
  type Duo,
  excludeRemakes,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatchTimeline } from "../riot/types";
import { LolService } from "./lol.service";
import { queueTypeName } from "./queue-types";

@Injectable()
export class LolAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly lol: LolService
  ) {}

  async getChampionExtras(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    queue?: number
  ): Promise<ChampionExtras> {
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        items: { isEmpty: false },
        ...(queue !== undefined && { queueType: queueTypeName(queue) }),
      },
      select: { items: true, laneOpponent: true, win: true },
    });

    // Item frequency across all games on this champion
    const itemMap = new Map<number, { games: number; wins: number }>();
    for (const m of matches) {
      for (const itemId of m.items) {
        const s = itemMap.get(itemId) ?? { games: 0, wins: 0 };
        itemMap.set(itemId, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
      }
    }
    const topItems = [...itemMap.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 6)
      .map(([itemId, s]) => ({ itemId, games: s.games, wins: s.wins }));

    const matchupMap = new Map<string, { games: number; wins: number }>();
    for (const m of matches) {
      const oppName = (m.laneOpponent as { championName: string } | null)?.championName;
      if (oppName) {
        const s = matchupMap.get(oppName) ?? { games: 0, wins: 0 };
        matchupMap.set(oppName, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
      }
    }
    const matchups = [...matchupMap.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .map(([champion, s]) => ({ champion, games: s.games, wins: s.wins }));

    return { topItems, matchups };
  }

  // Duo / squad detection. Pure read against the existing MatchDetailCache —
  // no Riot calls. We read up to `count` of the user's most recent matches
  // (any queue), join the cached raw match JSON, and bucket teammates by
  // puuid. Filtered to recurring puuids only (≥ MIN_GAMES_TOGETHER) so a
  // one-off random duo queue doesn't surface.
  async getDuos(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<Duo[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const userMatches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, playedAt: true },
    });
    if (userMatches.length === 0) return [];

    const matchIds = userMatches.map((m) => m.matchId);
    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: matchIds } },
    });
    // Sort cache rows newest-first so the gameName/tagLine we keep per puuid
    // is the most recent observation (Riot IDs can change).
    const playedAtByMatchId = new Map(
      userMatches.map((m) => [m.matchId, m.playedAt.getTime()])
    );
    const sortedCaches = [...caches].sort(
      (a, b) =>
        (playedAtByMatchId.get(b.matchId) ?? 0) - (playedAtByMatchId.get(a.matchId) ?? 0)
    );

    interface DuoAcc {
      puuid: string;
      gameName: string;
      tagLine: string;
      games: number;
      wins: number;
      championCounts: Map<string, number>;
    }
    const map = new Map<string, DuoAcc>();
    for (const cache of sortedCaches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            riotIdGameName: string;
            riotIdTagline: string;
            championName: string;
            teamId: number;
            win: boolean;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const teammates = detail.info.participants.filter(
        (p) => p.teamId === me.teamId && p.puuid !== me.puuid
      );
      for (const t of teammates) {
        const prev = map.get(t.puuid);
        if (prev) {
          prev.games += 1;
          if (me.win) prev.wins += 1;
          prev.championCounts.set(
            t.championName,
            (prev.championCounts.get(t.championName) ?? 0) + 1
          );
        } else {
          // First (= most recent) sighting. Capture latest gameName/tagLine.
          map.set(t.puuid, {
            puuid: t.puuid,
            gameName: t.riotIdGameName,
            tagLine: t.riotIdTagline,
            games: 1,
            wins: me.win ? 1 : 0,
            championCounts: new Map([[t.championName, 1]]),
          });
        }
      }
    }

    const MIN_GAMES_TOGETHER = 3;
    const TOP_N = 10;
    return [...map.values()]
      .filter((d) => d.games >= MIN_GAMES_TOGETHER)
      .sort((a, b) => b.games - a.games)
      .slice(0, TOP_N)
      .map((d) => {
        const topChampion =
          [...d.championCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        return {
          puuid: d.puuid,
          gameName: d.gameName,
          tagLine: d.tagLine,
          games: d.games,
          wins: d.wins,
          topChampion,
        };
      });
  }

  // Hour-of-day distribution bucketed in `Europe/Brussels` (owner local time).
  // Reads from the indexed Match table; no Riot calls. Remakes excluded so
  // they don't dilute win rate. Returns a 24-bucket array even when the
  // summoner is unknown or has zero matches, so the heatmap tile can render
  // an empty grid without branching on shape.
  async getChronotype(
    region: string,
    gameName: string,
    tagLine: string,
    count = 500
  ): Promise<Chronotype> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const timezone = "Europe/Brussels";
    const emptyHours = () =>
      Array.from({ length: 24 }, (_, hour) => ({ hour, games: 0, wins: 0 }));
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) {
      return { hours: emptyHours(), totalGames: 0, totalWins: 0, timezone };
    }

    const matches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid, remake: false },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { playedAt: true, win: true },
    });

    const hours = emptyHours();
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    });
    let totalGames = 0;
    let totalWins = 0;
    for (const m of matches) {
      const hour = Number.parseInt(fmt.format(m.playedAt), 10);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const bucket = hours[hour];
      if (!bucket) continue;
      bucket.games += 1;
      if (m.win) bucket.wins += 1;
      totalGames += 1;
      if (m.win) totalWins += 1;
    }
    return { hours, totalGames, totalWins, timezone };
  }

  // Champion-pair synergy. For the user's most recent `count` matches, walk
  // teammates and bucket by (yourChamp, teammateChamp). The chord viz on the
  // Profile renders the bipartite flow: your champion pool on one side,
  // teammates' picks on the other, ribbon weight = games played together.
  // Win counted from the user's team perspective (me.win).
  async getChampionPairs(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<ChampionPair[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const userMatches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true },
    });
    if (userMatches.length === 0) return [];

    const matchIds = userMatches.map((m) => m.matchId);
    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: matchIds } },
    });

    interface PairAcc {
      yourChamp: string;
      teammateChamp: string;
      games: number;
      wins: number;
    }
    const map = new Map<string, PairAcc>();
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            championName: string;
            teamId: number;
            win: boolean;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const teammates = detail.info.participants.filter(
        (p) => p.teamId === me.teamId && p.puuid !== me.puuid
      );
      for (const t of teammates) {
        const key = `${me.championName}|${t.championName}`;
        const prev = map.get(key);
        if (prev) {
          prev.games += 1;
          if (me.win) prev.wins += 1;
        } else {
          map.set(key, {
            yourChamp: me.championName,
            teammateChamp: t.championName,
            games: 1,
            wins: me.win ? 1 : 0,
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => b.games - a.games);
  }

  // Champion build-flow: for the user's recent N matches on `championKey`,
  // return the ordered list of item completions kept until end of game. We
  // intersect timeline PURCHASED events with the participant's final inventory
  // (Match.items) so intermediate components / sold items drop out and only
  // items that actually survived to the final inventory appear in the order.
  async getChampionBuildFlow(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    count = 100
  ): Promise<ChampionBuildFlowEntry[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
      },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, items: true, win: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return [];

    const timelineRows = await this.prisma.matchTimelineCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });
    const timelineByMatchId = new Map(timelineRows.map((t) => [t.matchId, t.timeline]));

    const result: ChampionBuildFlowEntry[] = [];
    for (const m of playable) {
      const timelineRaw = timelineByMatchId.get(m.matchId);
      if (!timelineRaw) continue;
      const timeline = timelineRaw as unknown as RiotMatchTimeline;

      const participantIdFromInfo = timeline.info.participants?.find(
        (p) => p.puuid === summoner.puuid
      )?.participantId;
      const participantId =
        participantIdFromInfo ??
        (() => {
          const idx = timeline.metadata.participants.indexOf(summoner.puuid);
          return idx === -1 ? null : idx + 1;
        })();
      if (participantId === null) continue;

      const finalItems = new Set(m.items.filter((id) => id > 0));
      if (finalItems.size === 0) continue;

      const purchaseOrder: number[] = [];
      const usedSlots = new Set<number>();
      for (const frame of timeline.info.frames) {
        for (const ev of frame.events) {
          if (ev.type !== "ITEM_PURCHASED") continue;
          if (ev.participantId !== participantId) continue;
          if (typeof ev.itemId !== "number") continue;
          if (!finalItems.has(ev.itemId)) continue;
          // The same itemId may be purchased multiple times when the user
          // restocks a slot — keep each purchase event as a separate step so
          // the Sankey reflects what actually happened, but cap how many
          // copies of the same item appear across the run.
          const occurrences = purchaseOrder.filter((x) => x === ev.itemId).length;
          const slotKey = ev.itemId * 10 + occurrences;
          if (usedSlots.has(slotKey)) continue;
          usedSlots.add(slotKey);
          purchaseOrder.push(ev.itemId);
        }
      }

      if (purchaseOrder.length === 0) continue;
      result.push({ matchId: m.matchId, win: m.win, items: purchaseOrder });
    }

    return result;
  }
}
