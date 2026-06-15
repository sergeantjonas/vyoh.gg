import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  type ChampionBuildFlowEntry,
  type ChampionExtras,
  type ChampionPair,
  type ChampionRecap,
  type Chronotype,
  type Duo,
  type MatchSummary,
  type PregameCalibrationByQueue,
  type Squad,
  type SquadMember,
  computeCalibrationByQueue,
  deriveChampionRecap,
  excludeRemakes,
  replayHistory,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatchTimeline } from "../riot/types";
import { LolService } from "./lol.service";
import { queueTypeName } from "./queue-types";

const EMPTY_CALIBRATION: PregameCalibrationByQueue = {};

const DEFAULT_PREGAME_QUEUE_IDS = [420, 440, 400] as const;

// Trailing window for the per-champion landing-chapter recap. 365 days
// dodges the moving season-split boundary while staying "yearly at least"
// per owner direction.
const RECAP_WINDOW_DAYS = 365;

// Temporal-clustering gate shared by duo and squad detection. Co-occurrence
// alone can't tell a premade from repeated random matchmaking (same MMR band +
// play window = some teammates recur by chance, worst in high elo / low-pop
// regions). Premades play sessions back-to-back, so a same-session pair is
// strong evidence; random repeats are scattered in time. Match-V5 exposes no
// party id for SR, so this is the best precision lever we have.
const DUO_MIN_GAMES = 3;
const DUO_STRONG_GAMES = 6;
const DUO_SESSION_GAP_MS = 3 * 60 * 60 * 1000; // 3h between two shared games

// True when any two of the given timestamps fall within one session window.
function hasSameSessionPair(timestamps: number[]): boolean {
  const ts = [...timestamps].sort((a, b) => a - b);
  for (let i = 1; i < ts.length; i++) {
    const prev = ts[i - 1];
    const cur = ts[i];
    if (prev !== undefined && cur !== undefined && cur - prev <= DUO_SESSION_GAP_MS) {
      return true;
    }
  }
  return false;
}

// A group recurs (premade, not matchmaking chance) when it clears the game
// floor AND either clusters in a session or piles up enough sheer volume to be
// convincing on its own.
function qualifiesAsRecurring(games: number, timestamps: number[]): boolean {
  return (
    games >= DUO_MIN_GAMES &&
    (games >= DUO_STRONG_GAMES || hasSameSessionPair(timestamps))
  );
}

// Every subset of size ≥2 from `items`. Bounded for squad detection: a team has
// ≤4 teammates, so this yields ≤11 subsets per match.
function subsetsOfAtLeast2<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) {
        const item = items[i];
        if (item !== undefined) subset.push(item);
      }
    }
    if (subset.length >= 2) result.push(subset);
  }
  return result;
}

interface CachedParticipant {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championName: string;
  teamId: number;
  win: boolean;
}

// Pull the owner's same-team teammates (and the owner's win flag) out of one
// cached raw match. Returns null for rows that don't contain the owner — a
// corrupt or key-collided cache row — so callers skip them rather than crash on
// a missing `me`.
function ownerTeammates(
  detail: unknown,
  ownerPuuid: string
): { win: boolean; teammates: CachedParticipant[] } | null {
  const participants = (detail as { info?: { participants?: CachedParticipant[] } })?.info
    ?.participants;
  if (!participants) return null;
  const me = participants.find((p) => p.puuid === ownerPuuid);
  if (!me) return null;
  const teammates = participants.filter(
    (p) => p.teamId === me.teamId && p.puuid !== ownerPuuid
  );
  return { win: me.win, teammates };
}

@Injectable()
export class LolAnalyticsService {
  // Calibration is expensive (replay over full ranked history). Cache per
  // account+queue-set; bust when a new match lands by comparing latest
  // playedAt against the cached key.
  private readonly calibrationCache = new Map<
    string,
    { latestPlayedAt: string; byQueue: PregameCalibrationByQueue }
  >();

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
    queues?: readonly number[]
  ): Promise<ChampionExtras> {
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const queueNames = queues && queues.length > 0 ? queues.map(queueTypeName) : null;
    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        items: { isEmpty: false },
        ...(queueNames && { queueType: { in: queueNames } }),
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

  /**
   * Champion recap — aggregate "your X" verdict feeding the per-champion
   * landing chapter. Reads the trailing 365-day window of stored matches on
   * this champion and derives the recap server-side via the shared deriver.
   *
   * Window: rolling 365 days. The current LoL competitive season has split
   * boundaries that move between years; a fixed-day window dodges that
   * coupling and keeps the recap "yearly at least" as the owner asked.
   */
  async getChampionRecap(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string
  ): Promise<ChampionRecap> {
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const cutoff = new Date(Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        playedAt: { gte: cutoff },
      },
      orderBy: { playedAt: "desc" },
      select: {
        matchId: true,
        queueType: true,
        champion: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        playedAt: true,
        remake: true,
        teamPosition: true,
        gameVersion: true,
        visionScore: true,
        damageShare: true,
        firstBloodKill: true,
        hasTimeline: true,
        csAt10: true,
        csAt15: true,
        goldAt10: true,
        goldAt15: true,
        teamGoldDiffAt15: true,
        teamGoldDiffSeries: true,
        deathTimings: true,
        deathXs: true,
        deathYs: true,
        killTimings: true,
        killXs: true,
        killYs: true,
        laneOpponent: true,
      },
    });

    const matches: MatchSummary[] = rows.map(({ playedAt, laneOpponent, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
      laneOpponent: laneOpponent as MatchSummary["laneOpponent"],
    }));

    return deriveChampionRecap(championKey, matches);
  }

  // Duo detection. Pure read against the existing MatchDetailCache — no Riot
  // calls. Reads up to `count` of the owner's most recent matches (any queue),
  // buckets same-team teammates by puuid, and keeps only recurring teammates
  // (the temporal-clustering gate) so a one-off random duo queue doesn't surface.
  async getDuos(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<Duo[]> {
    const ctx = await this.loadOwnerMatchCache(region, gameName, tagLine, count);
    if (!ctx) return [];
    const { ownerPuuid, sortedCaches, playedAtByMatchId } = ctx;

    interface DuoAcc {
      puuid: string;
      gameName: string;
      tagLine: string;
      games: number;
      wins: number;
      championCounts: Map<string, number>;
      matchIds: string[];
    }
    const map = new Map<string, DuoAcc>();
    for (const cache of sortedCaches) {
      const owner = ownerTeammates(cache.detail, ownerPuuid);
      if (!owner) continue;
      for (const t of owner.teammates) {
        const prev = map.get(t.puuid);
        if (prev) {
          prev.games += 1;
          if (owner.win) prev.wins += 1;
          prev.championCounts.set(
            t.championName,
            (prev.championCounts.get(t.championName) ?? 0) + 1
          );
          prev.matchIds.push(cache.matchId);
        } else {
          // First (= most recent) sighting. Capture latest gameName/tagLine.
          map.set(t.puuid, {
            puuid: t.puuid,
            gameName: t.riotIdGameName,
            tagLine: t.riotIdTagline,
            games: 1,
            wins: owner.win ? 1 : 0,
            championCounts: new Map([[t.championName, 1]]),
            matchIds: [cache.matchId],
          });
        }
      }
    }

    const TOP_N = 10;
    const timestampsOf = (matchIds: string[]): number[] =>
      matchIds
        .map((id) => playedAtByMatchId.get(id))
        .filter((t): t is number => t !== undefined);
    return [...map.values()]
      .filter((d) => qualifiesAsRecurring(d.games, timestampsOf(d.matchIds)))
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
          matchIds: d.matchIds,
        };
      });
  }

  // Shared prelude for duo + squad detection: whitelist-check the account, load
  // the owner's most recent `count` matches and their cached raw detail, and
  // sort the cache rows newest-first (so the gameName/tagLine we keep per puuid
  // is the most recent observation — Riot IDs can change). Returns null for the
  // not-whitelisted-throws / no-summoner / no-matches cases so callers short to
  // an empty result without a redundant `matchId IN ()` query.
  private async loadOwnerMatchCache(
    region: string,
    gameName: string,
    tagLine: string,
    count: number
  ): Promise<{
    ownerPuuid: string;
    sortedCaches: { matchId: string; detail: unknown }[];
    playedAtByMatchId: Map<string, number>;
  } | null> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return null;

    const userMatches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, playedAt: true },
    });
    if (userMatches.length === 0) return null;

    const matchIds = userMatches.map((m) => m.matchId);
    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: matchIds } },
    });
    const playedAtByMatchId = new Map(
      userMatches.map((m) => [m.matchId, m.playedAt.getTime()])
    );
    const sortedCaches = [...caches].sort(
      (a, b) =>
        (playedAtByMatchId.get(b.matchId) ?? 0) - (playedAtByMatchId.get(a.matchId) ?? 0)
    );
    return { ownerPuuid: summoner.puuid, sortedCaches, playedAtByMatchId };
  }

  // Squad detection — the 3+-stack sibling of getDuos. Instead of bucketing
  // single teammates, it buckets recurring teammate *sets* (every size-≥2 subset
  // of a match's teammates, ≤11 per match since a team has ≤4 teammates) and
  // reuses the same temporal-clustering gate. A subgroup whose games are fully
  // explained by a larger qualifying group is dropped, so the result is the real
  // stacks (the trio, the 4-stack) rather than every sub-combination of them.
  async getSquads(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<Squad[]> {
    const ctx = await this.loadOwnerMatchCache(region, gameName, tagLine, count);
    if (!ctx) return [];
    const { ownerPuuid, sortedCaches, playedAtByMatchId } = ctx;

    interface MemberAcc {
      puuid: string;
      gameName: string;
      tagLine: string;
      championCounts: Map<string, number>;
    }
    interface SquadAcc {
      puuids: string[]; // sorted, == the bucket key split on "|"
      members: Map<string, MemberAcc>;
      games: number;
      wins: number;
      matchIds: string[];
    }
    const map = new Map<string, SquadAcc>();
    for (const cache of sortedCaches) {
      const owner = ownerTeammates(cache.detail, ownerPuuid);
      if (!owner || owner.teammates.length < 2) continue; // need ≥2 for a 3-stack
      for (const subset of subsetsOfAtLeast2(owner.teammates)) {
        const puuids = subset.map((t) => t.puuid).sort();
        const key = puuids.join("|");
        let acc = map.get(key);
        if (!acc) {
          acc = { puuids, members: new Map(), games: 0, wins: 0, matchIds: [] };
          map.set(key, acc);
        }
        acc.games += 1;
        if (owner.win) acc.wins += 1;
        acc.matchIds.push(cache.matchId);
        for (const t of subset) {
          let member = acc.members.get(t.puuid);
          if (!member) {
            // First (= most recent) sighting captures latest gameName/tagLine.
            member = {
              puuid: t.puuid,
              gameName: t.riotIdGameName,
              tagLine: t.riotIdTagline,
              championCounts: new Map(),
            };
            acc.members.set(t.puuid, member);
          }
          member.championCounts.set(
            t.championName,
            (member.championCounts.get(t.championName) ?? 0) + 1
          );
        }
      }
    }

    const timestampsOf = (matchIds: string[]): number[] =>
      matchIds
        .map((id) => playedAtByMatchId.get(id))
        .filter((t): t is number => t !== undefined);

    // Qualify by the same temporal-clustering gate as duos, then order largest-
    // and most-played-first so the dedup below keeps the bigger group when a
    // smaller one is fully contained in it.
    const qualifying = [...map.values()]
      .filter((s) => qualifiesAsRecurring(s.games, timestampsOf(s.matchIds)))
      .sort((a, b) => b.puuids.length - a.puuids.length || b.games - a.games);

    // Drop a subgroup whose co-occurrence is fully explained by an already-kept
    // larger group. A subset always has games ≥ its superset; if a kept superset
    // recurs nearly as often (within one stray game), the subgroup almost never
    // played without it and adds no information. A subgroup that recurs notably
    // more often is a distinct stack and is kept.
    const SUBSET_TOLERANCE = 1;
    const kept: SquadAcc[] = [];
    for (const candidate of qualifying) {
      const redundant = kept.some((k) => {
        if (k.puuids.length <= candidate.puuids.length) return false;
        const keptSet = new Set(k.puuids);
        return (
          candidate.puuids.every((p) => keptSet.has(p)) &&
          k.games >= candidate.games - SUBSET_TOLERANCE
        );
      });
      if (!redundant) kept.push(candidate);
    }

    const TOP_N = 5;
    return kept
      .sort((a, b) => b.games - a.games || b.puuids.length - a.puuids.length)
      .slice(0, TOP_N)
      .map((s) => {
        const members: SquadMember[] = [...s.members.values()]
          .map((m) => ({
            puuid: m.puuid,
            gameName: m.gameName,
            tagLine: m.tagLine,
            topChampion:
              [...m.championCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
          }))
          .sort((a, b) => a.gameName.localeCompare(b.gameName));
        return {
          members,
          size: members.length + 1,
          games: s.games,
          wins: s.wins,
          matchIds: s.matchIds,
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

  async getPregameCalibration(
    region: string,
    gameName: string,
    tagLine: string,
    queueIds?: readonly number[]
  ): Promise<PregameCalibrationByQueue> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const ids = queueIds?.length ? [...queueIds] : [...DEFAULT_PREGAME_QUEUE_IDS];
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return EMPTY_CALIBRATION;

    const queueNames = ids.map((id) => queueTypeName(id));
    const cacheKey = `${summoner.puuid}:${[...ids].sort((a, b) => a - b).join(",")}`;

    // Cheap staleness probe — one row by ordered index ≈ free vs the full scan.
    const latest = await this.prisma.match.findFirst({
      where: { puuid: summoner.puuid, queueType: { in: queueNames }, remake: false },
      orderBy: { playedAt: "desc" },
      select: { playedAt: true },
    });
    if (!latest) return EMPTY_CALIBRATION;
    const latestKey = latest.playedAt.toISOString();

    const cached = this.calibrationCache.get(cacheKey);
    if (cached && cached.latestPlayedAt === latestKey) return cached.byQueue;

    // Replay only reads matchId/playedAt/queueType/win/remake/champion + LP
    // snapshots; we select that subset and cast at the boundary rather than
    // rehydrating the full MatchSummary shape.
    const rows = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid, queueType: { in: queueNames } },
      orderBy: { playedAt: "desc" },
      select: {
        matchId: true,
        playedAt: true,
        queueType: true,
        win: true,
        remake: true,
        champion: true,
        snapshotLp: true,
        snapshotLpBefore: true,
      },
    });
    const matches = rows.map((r) => ({
      matchId: r.matchId,
      playedAt: r.playedAt.toISOString(),
      queueType: r.queueType,
      win: r.win,
      remake: r.remake,
      champion: r.champion,
      ...(r.snapshotLp != null ? { snapshotLp: r.snapshotLp } : {}),
      ...(r.snapshotLpBefore != null ? { snapshotLpBefore: r.snapshotLpBefore } : {}),
    })) as unknown as MatchSummary[];

    const byQueue = computeCalibrationByQueue(replayHistory(matches));
    this.calibrationCache.set(cacheKey, { latestPlayedAt: latestKey, byQueue });
    return byQueue;
  }
}
