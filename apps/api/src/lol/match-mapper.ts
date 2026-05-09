import type { MatchDetail, MatchSummary } from "@vyoh/shared";
import type { RiotMatch } from "../riot/types";
import { queueTypeName } from "./queue-types";

export function riotMatchToSummary(match: RiotMatch, puuid: string): MatchSummary {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    throw new Error(`PUUID ${puuid} not found in match ${match.metadata.matchId}`);
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
  };
}

export function extractItemsAndOpponents(
  match: RiotMatch,
  puuid: string
): { items: number[]; opponents: string[] } {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return { items: [], opponents: [] };

  const items = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((id) => id > 0);

  // teamPosition is empty in ARAM/Arena — skip those games for matchup tracking
  const opponents: string[] = [];
  if (participant.teamPosition) {
    const laneOpponent = match.info.participants.find(
      (p) =>
        p.teamId !== participant.teamId && p.teamPosition === participant.teamPosition
    );
    if (laneOpponent) opponents.push(laneOpponent.championName);
  }

  return { items, opponents };
}

export function riotMatchToDetail(match: RiotMatch): MatchDetail {
  return {
    matchId: match.metadata.matchId,
    queueType: queueTypeName(match.info.queueId),
    durationSec: match.info.gameDuration,
    playedAt: new Date(match.info.gameStartTimestamp).toISOString(),
    participants: match.info.participants.map((p) => ({
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
    })),
  };
}
