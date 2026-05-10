import type { MatchDetail, MatchSummary, TeamSummary } from "@vyoh/shared";
import type { RiotMatch } from "../riot/types";
import { queueTypeName } from "./queue-types";

export function riotMatchToSummary(match: RiotMatch, puuid: string): MatchSummary {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    throw new Error(`PUUID ${puuid} not found in match ${match.metadata.matchId}`);
  }

  // Damage share is computed against the user's team total — sum just that
  // side instead of using the (heavier) per-team-totals map riotMatchToDetail
  // builds for all participants.
  let teamTotalDamage = 0;
  for (const p of match.info.participants) {
    if (p.teamId === participant.teamId) {
      teamTotalDamage += p.totalDamageDealtToChampions;
    }
  }
  const damageShare =
    teamTotalDamage > 0 ? participant.totalDamageDealtToChampions / teamTotalDamage : 0;

  let laneOpponent: MatchSummary["laneOpponent"] = null;
  if (participant.teamPosition) {
    const opp = match.info.participants.find(
      (p) =>
        p.teamId !== participant.teamId && p.teamPosition === participant.teamPosition
    );
    if (opp) {
      laneOpponent = {
        puuid: opp.puuid,
        championName: opp.championName,
        gameName: opp.riotIdGameName,
        tagLine: opp.riotIdTagline,
      };
    }
  }

  return {
    matchId: match.metadata.matchId,
    queueType: queueTypeName(match.info.queueId),
    champion: participant.championName,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    win: participant.win,
    durationSec: match.info.gameDuration,
    playedAt: new Date(match.info.gameStartTimestamp).toISOString(),
    // Remakes: gameEndedInEarlySurrender is set for the early-surrender mechanic;
    // combined with a duration under 3.5 min it reliably identifies remakes
    // (as distinct from mid-game surrenders or the new inting-surrender system).
    // Remakes are stored but flagged so stats computations can exclude them.
    remake: match.info.gameEndedInEarlySurrender && match.info.gameDuration < 210,
    teamPosition: participant.teamPosition,
    gameVersion: match.info.gameVersion,
    visionScore: participant.visionScore,
    damageShare,
    firstBloodKill: participant.firstBloodKill,
    laneOpponent,
  };
}

export function extractItems(match: RiotMatch, puuid: string): { items: number[] } {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return { items: [] };

  const items = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((id) => id > 0);

  return { items };
}

export function riotMatchToDetail(match: RiotMatch): MatchDetail {
  const durationMin = match.info.gameDuration / 60;

  // Per-team totals needed for share computations
  const teamTotals = new Map<number, { damage: number; gold: number }>();
  for (const p of match.info.participants) {
    const t = teamTotals.get(p.teamId) ?? { damage: 0, gold: 0 };
    t.damage += p.totalDamageDealtToChampions;
    t.gold += p.goldEarned;
    teamTotals.set(p.teamId, t);
  }

  const teams: TeamSummary[] = match.info.teams.map((t) => {
    const teamParticipants = match.info.participants.filter((p) => p.teamId === t.teamId);
    const totalKills = teamParticipants.reduce((sum, p) => sum + p.kills, 0);
    const totalGold = teamTotals.get(t.teamId)?.gold ?? 0;
    return {
      teamId: t.teamId,
      win: t.win,
      totalKills,
      totalGold,
      objectives: {
        baron: t.objectives.baron,
        champion: t.objectives.champion,
        dragon: t.objectives.dragon,
        inhibitor: t.objectives.inhibitor,
        riftHerald: t.objectives.riftHerald,
        tower: t.objectives.tower,
      },
    };
  });

  const participants = match.info.participants.map((p) => {
    const totals = teamTotals.get(p.teamId) ?? { damage: 1, gold: 1 };
    const keystone = p.perks.styles[0]?.selections[0]?.perk ?? 0;

    return {
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      championName: p.championName,
      teamId: p.teamId,
      teamPosition: p.teamPosition,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      win: p.win,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      goldEarned: p.goldEarned,
      totalDamage: p.totalDamageDealtToChampions,
      csTotal: p.totalMinionsKilled + p.neutralMinionsKilled,
      csPerMin:
        Math.round(((p.totalMinionsKilled + p.neutralMinionsKilled) / durationMin) * 10) /
        10,
      visionScore: p.visionScore,
      wardsPlaced: p.wardsPlaced,
      wardsKilled: p.wardsKilled,
      controlWardsPurchased: p.detectorWardsPlaced,
      kp: p.challenges?.killParticipation ?? 0,
      damageShare: totals.damage > 0 ? p.totalDamageDealtToChampions / totals.damage : 0,
      goldShare: totals.gold > 0 ? p.goldEarned / totals.gold : 0,
      damageDealtPhysical: p.physicalDamageDealtToChampions,
      damageDealtMagic: p.magicDamageDealtToChampions,
      damageDealtTrue: p.trueDamageDealtToChampions,
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      keystone,
      championLevel: p.champLevel,
    };
  });

  return {
    matchId: match.metadata.matchId,
    queueType: queueTypeName(match.info.queueId),
    durationSec: match.info.gameDuration,
    playedAt: new Date(match.info.gameStartTimestamp).toISOString(),
    teams,
    participants,
  };
}
