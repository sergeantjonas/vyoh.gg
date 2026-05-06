import type { MatchSummary } from "@vyoh/shared";
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
  };
}
