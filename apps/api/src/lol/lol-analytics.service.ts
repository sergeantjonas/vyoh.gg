import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  type AramProfile,
  type CarryProfile,
  type ChampionPair,
  type Chronotype,
  type DamageProfile,
  type Duo,
  type MatchSummary,
  type ObjectiveFirsts,
  type ObjectiveParticipation,
  type ObjectiveParticipationTally,
  type PregameCalibrationByQueue,
  type Squad,
  type SquadMember,
  computeCalibrationByQueue,
  excludeRemakes,
  replayHistory,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";

const EMPTY_CALIBRATION: PregameCalibrationByQueue = {};

const DEFAULT_PREGAME_QUEUE_IDS = [420, 440, 400] as const;

// Temporal-clustering gate shared by duo and squad detection. Co-occurrence
// alone can't tell a premade from repeated random matchmaking (same MMR band +
// play window = some teammates recur by chance, worst in high elo / low-pop
// regions). Premades play sessions back-to-back, so a same-session pair is
// strong evidence; random repeats are scattered in time. Match-V5 exposes no
// party id for SR, so this is the best precision lever we have.
const DUO_MIN_GAMES = 3;
const DUO_STRONG_GAMES = 6;
const DUO_SESSION_GAP_MS = 3 * 60 * 60 * 1000; // 3h between two shared games
// Champion pairings surfaced per duo. Capped so the expandable row stays
// scannable and the DTO doesn't ship a long tail of one-off combos.
const DUO_PAIR_TOP_N = 6;

// ARAM dashboard (D.7). 450 is Riot's Match-V5 queueId for ARAM, matched
// directly against Match.queueId.
const ARAM_QUEUE_ID = 450;
// Most-played ARAM champions surfaced on the dashboard.
const ARAM_TOP_CHAMPIONS = 5;

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
): { win: boolean; ownerChampion: string; teammates: CachedParticipant[] } | null {
  const participants = (detail as { info?: { participants?: CachedParticipant[] } })?.info
    ?.participants;
  if (!participants) return null;
  const me = participants.find((p) => p.puuid === ownerPuuid);
  if (!me) return null;
  const teammates = participants.filter(
    (p) => p.teamId === me.teamId && p.puuid !== ownerPuuid
  );
  return { win: me.win, ownerChampion: me.championName, teammates };
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
    private readonly identity: IdentityService
  ) {}

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

    // Per-duo champion pairing: owner's champ + this duo's champ in one match,
    // keyed `${yourChamp}|${teammateChamp}`. Accumulated alongside the duo
    // aggregate so the surface can show what the two actually queue together.
    interface PairAcc {
      yourChamp: string;
      teammateChamp: string;
      games: number;
      wins: number;
    }
    interface DuoAcc {
      puuid: string;
      gameName: string;
      tagLine: string;
      games: number;
      wins: number;
      championCounts: Map<string, number>;
      pairCounts: Map<string, PairAcc>;
      matchIds: string[];
    }
    const map = new Map<string, DuoAcc>();
    const bumpPair = (
      acc: DuoAcc,
      yourChamp: string,
      teammateChamp: string,
      win: boolean
    ) => {
      const key = `${yourChamp}|${teammateChamp}`;
      const prev = acc.pairCounts.get(key);
      if (prev) {
        prev.games += 1;
        if (win) prev.wins += 1;
      } else {
        acc.pairCounts.set(key, {
          yourChamp,
          teammateChamp,
          games: 1,
          wins: win ? 1 : 0,
        });
      }
    };
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
          bumpPair(prev, owner.ownerChampion, t.championName, owner.win);
          prev.matchIds.push(cache.matchId);
        } else {
          // First (= most recent) sighting. Capture latest gameName/tagLine.
          const acc: DuoAcc = {
            puuid: t.puuid,
            gameName: t.riotIdGameName,
            tagLine: t.riotIdTagline,
            games: 1,
            wins: owner.win ? 1 : 0,
            championCounts: new Map([[t.championName, 1]]),
            pairCounts: new Map(),
            matchIds: [cache.matchId],
          };
          bumpPair(acc, owner.ownerChampion, t.championName, owner.win);
          map.set(t.puuid, acc);
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
        const championPairs = [...d.pairCounts.values()]
          .sort((a, b) => b.games - a.games)
          .slice(0, DUO_PAIR_TOP_N);
        return {
          puuid: d.puuid,
          gameName: d.gameName,
          tagLine: d.tagLine,
          games: d.games,
          wins: d.wins,
          topChampion,
          championPairs,
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

  // Objective firsts: across the owner's recent N non-remake matches, how often
  // they personally drew first blood and how often their team took the first
  // tower, each with the win count in those games. Reads MatchDetailCache (the
  // raw Riot payload carries participant `firstBloodKill` + team objectives);
  // remakes are filtered via a Match prelude so the rate isn't diluted.
  async getObjectiveFirsts(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<ObjectiveFirsts> {
    const empty: ObjectiveFirsts = {
      games: 0,
      firstBlood: { count: 0, wins: 0 },
      firstTower: { count: 0, wins: 0 },
    };
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return empty;

    const matches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return empty;

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    const result: ObjectiveFirsts = {
      games: 0,
      firstBlood: { count: 0, wins: 0 },
      firstTower: { count: 0, wins: 0 },
    };
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            win: boolean;
            teamId: number;
            firstBloodKill?: boolean;
          }>;
          teams: Array<{
            teamId: number;
            objectives?: { tower?: { first?: boolean } };
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      result.games += 1;
      if (me.firstBloodKill) {
        result.firstBlood.count += 1;
        if (me.win) result.firstBlood.wins += 1;
      }
      const myTeam = detail.info.teams.find((t) => t.teamId === me.teamId);
      if (myTeam?.objectives?.tower?.first) {
        result.firstTower.count += 1;
        if (me.win) result.firstTower.wins += 1;
      }
    }

    return result;
  }

  // Objective participation: across the owner's recent N non-remake SR games,
  // how many of the team's dragons / barons / rift heralds the owner got
  // kill-or-assist credit on (Riot challenges `dragonTakedowns` etc.) vs how many
  // the team killed — `takedowns / teamKills` is the op.gg "objective
  // participation" rate. Reads MatchDetailCache: the owner's participant is
  // stored full so its `challenges` block survives the lean projection, and team
  // objective kills live in info.teams. SR-only (in-loop teamPosition gate) since
  // ARAM/Arena have no neutral objectives. No timeline / respawn math — the
  // takedown framing was chosen over "alive-during-objective" (roadmap D.6).
  async getObjectiveParticipation(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<ObjectiveParticipation> {
    const emptyTally = (): ObjectiveParticipationTally => ({
      takedowns: 0,
      teamKills: 0,
      games: 0,
    });
    const makeEmpty = (): ObjectiveParticipation => ({
      games: 0,
      dragons: emptyTally(),
      barons: emptyTally(),
      heralds: emptyTally(),
    });
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return makeEmpty();

    const matches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return makeEmpty();

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    const result = makeEmpty();
    // Accrue one objective type's contribution from a game: skip games where the
    // team never killed it (keeps the rate's denominator honest), and clamp
    // takedowns to team kills (a takedown can't exist without a team kill).
    const accrue = (
      tally: ObjectiveParticipationTally,
      takedowns: number | undefined,
      teamKills: number | undefined
    ) => {
      const kills = teamKills ?? 0;
      if (kills <= 0) return;
      tally.teamKills += kills;
      tally.takedowns += Math.min(takedowns ?? 0, kills);
      tally.games += 1;
    };
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            teamId: number;
            teamPosition?: string;
            challenges?: {
              dragonTakedowns?: number;
              baronTakedowns?: number;
              riftHeraldTakedowns?: number;
            };
          }>;
          teams: Array<{
            teamId: number;
            objectives?: {
              dragon?: { kills?: number };
              baron?: { kills?: number };
              riftHerald?: { kills?: number };
            };
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      if (!me.teamPosition) continue; // SR-only; ARAM/Arena have no neutral objectives
      const myTeam = detail.info.teams.find((t) => t.teamId === me.teamId);
      if (!myTeam?.objectives) continue;
      result.games += 1;
      accrue(
        result.dragons,
        me.challenges?.dragonTakedowns,
        myTeam.objectives.dragon?.kills
      );
      accrue(
        result.barons,
        me.challenges?.baronTakedowns,
        myTeam.objectives.baron?.kills
      );
      accrue(
        result.heralds,
        me.challenges?.riftHeraldTakedowns,
        myTeam.objectives.riftHerald?.kills
      );
    }

    return result;
  }

  // ARAM profile: a queue-isolated dashboard for the owner's most-played mode.
  // The profile's serious-queues surfaces exclude ARAM by design (no lanes /
  // ranked LP), so ARAM play is otherwise only visible blended into the
  // all-queue headline. This surfaces it on its own: win rate, KDA, and the
  // ARAM-flavoured sustain/tank signals (effective heal+shield delivered to
  // allies, damage taken, damage self-mitigated) plus the most-played ARAM
  // champions. Reads MatchDetailCache — the owner participant is stored full, so
  // its `challenges.effectiveHealAndShielding` + damage fields survive the lean
  // projection. Sums are returned; the web derives means/rates at the display
  // site. ("healing taken" from the D.7 spec isn't a Match-V5 field — sustain is
  // expressed via heal+shield-delivered + damage-taken instead.)
  async getAramProfile(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<AramProfile> {
    const makeEmpty = (): AramProfile => ({
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      healAndShield: 0,
      damageTaken: 0,
      selfMitigated: 0,
      damageToChampions: 0,
      topChampions: [],
    });
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return makeEmpty();

    const matches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid, queueId: ARAM_QUEUE_ID },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return makeEmpty();

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    const result = makeEmpty();
    const champMap = new Map<string, { games: number; wins: number }>();
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            win: boolean;
            championName: string;
            kills: number;
            deaths: number;
            assists: number;
            totalDamageTaken?: number;
            damageSelfMitigated?: number;
            totalDamageDealtToChampions?: number;
            challenges?: { effectiveHealAndShielding?: number };
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      result.games += 1;
      if (me.win) result.wins += 1;
      result.kills += me.kills;
      result.deaths += me.deaths;
      result.assists += me.assists;
      result.healAndShield += me.challenges?.effectiveHealAndShielding ?? 0;
      result.damageTaken += me.totalDamageTaken ?? 0;
      result.selfMitigated += me.damageSelfMitigated ?? 0;
      result.damageToChampions += me.totalDamageDealtToChampions ?? 0;
      const prev = champMap.get(me.championName) ?? { games: 0, wins: 0 };
      champMap.set(me.championName, {
        games: prev.games + 1,
        wins: prev.wins + (me.win ? 1 : 0),
      });
    }

    result.topChampions = [...champMap.entries()]
      .map(([championName, s]) => ({ championName, games: s.games, wins: s.wins }))
      .sort((a, b) => b.games - a.games)
      .slice(0, ARAM_TOP_CHAMPIONS);

    return result;
  }

  // Carry profile: split the owner's wins/losses by where they ranked in their
  // own team's champion damage — top-3 vs bottom-2. Neutral framing (a support's
  // bottom-2 damage isn't a failing); the split just shows how results track
  // with the owner's damage share. Needs per-teammate damage, so it reads the
  // raw participant list from MatchDetailCache (the Match row only stores the
  // owner's `damageShare`, not teammates' absolute damage). Remake-excluded; only
  // full-roster teams (≥4 teammates → SR/ARAM, not Arena 2-player subteams).
  async getCarryProfile(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<CarryProfile> {
    const empty: CarryProfile = {
      games: 0,
      topThree: { games: 0, wins: 0 },
      bottomTwo: { games: 0, wins: 0 },
    };
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return empty;

    const matches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return empty;

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    const result: CarryProfile = {
      games: 0,
      topThree: { games: 0, wins: 0 },
      bottomTwo: { games: 0, wins: 0 },
    };
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            win: boolean;
            teamId: number;
            totalDamageDealtToChampions?: number;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const team = detail.info.participants.filter((p) => p.teamId === me.teamId);
      if (team.length < 4) continue; // skip Arena subteams / malformed rows
      const myDmg = me.totalDamageDealtToChampions ?? 0;
      // Rank = 1 + teammates with strictly more damage. Top-3 → rank ≤ 3.
      const ahead = team.filter(
        (p) => (p.totalDamageDealtToChampions ?? 0) > myDmg
      ).length;
      const bucket = ahead + 1 <= 3 ? result.topThree : result.bottomTwo;
      result.games += 1;
      bucket.games += 1;
      if (me.win) bucket.wins += 1;
    }

    return result;
  }

  // Damage profile: the owner's mean share of their team's totals for damage
  // dealt to champions, vision score, and CS — across recent non-remake
  // positional games, optionally scoped to one champion. Share-of-team is
  // role-fair without an external baseline (a support reads low-damage /
  // high-vision naturally) and stays meaningful at both champion and profile
  // scope. Needs per-teammate stats for the team totals, read from the lean
  // participant list in MatchDetailCache. NO damage-taken axis: the lean
  // projection (match-projection.ts) strips totalDamageTaken from non-owner
  // participants, so its team-share would always read 100% (owner is the only
  // contributor) — the three metrics here survive the projection for everyone.
  // Positional games only (teamPosition filters out ARAM/Arena, where vision
  // share is degenerate); full-roster teams only (≥4 teammates skips Arena
  // 2-player subteams / malformed rows).
  async getDamageProfile(
    region: string,
    gameName: string,
    tagLine: string,
    championKey?: string,
    count = 100
  ): Promise<DamageProfile> {
    const empty: DamageProfile = {
      sampleSize: 0,
      damageShare: 0,
      visionShare: 0,
      csShare: 0,
    };
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return empty;

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        teamPosition: { not: "" },
        ...(championKey
          ? { champion: { equals: championKey, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return empty;

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    // Accumulate per-game shares, then divide by the count of games that
    // contributed a non-zero team total for each metric (a metric whose team
    // total is 0 can't yield a share, so it doesn't count toward its own mean).
    const sums = { damage: 0, vision: 0, cs: 0 };
    const counts = { damage: 0, vision: 0, cs: 0 };
    let sampleSize = 0;
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            teamId: number;
            totalDamageDealtToChampions?: number;
            visionScore?: number;
            totalMinionsKilled?: number;
            neutralMinionsKilled?: number;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const team = detail.info.participants.filter((p) => p.teamId === me.teamId);
      if (team.length < 4) continue; // skip Arena subteams / malformed rows
      sampleSize += 1;

      const accumulate = (
        key: keyof typeof sums,
        value: (p: (typeof team)[number]) => number
      ) => {
        const total = team.reduce((acc, p) => acc + value(p), 0);
        if (total > 0) {
          sums[key] += value(me) / total;
          counts[key] += 1;
        }
      };
      accumulate("damage", (p) => p.totalDamageDealtToChampions ?? 0);
      accumulate("vision", (p) => p.visionScore ?? 0);
      accumulate(
        "cs",
        (p) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)
      );
    }

    if (sampleSize === 0) return empty;
    const mean = (key: keyof typeof sums) =>
      counts[key] > 0 ? sums[key] / counts[key] : 0;
    return {
      sampleSize,
      damageShare: mean("damage"),
      visionShare: mean("vision"),
      csShare: mean("cs"),
    };
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

    const cacheKey = `${summoner.puuid}:${[...ids].sort((a, b) => a - b).join(",")}`;

    // Cheap staleness probe — one row by ordered index ≈ free vs the full scan.
    const latest = await this.prisma.match.findFirst({
      where: { puuid: summoner.puuid, queueId: { in: ids }, remake: false },
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
      where: { puuid: summoner.puuid, queueId: { in: ids } },
      orderBy: { playedAt: "desc" },
      select: {
        matchId: true,
        playedAt: true,
        queueId: true,
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
      queueId: r.queueId,
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
