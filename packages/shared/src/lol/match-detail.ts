export interface ParticipantDetail {
  puuid: string;
  championName: string;
  teamId: number;
  teamPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  items: number[];
  goldEarned: number;
  totalDamage: number;
}

export interface MatchDetail {
  matchId: string;
  queueType: string;
  durationSec: number;
  playedAt: string;
  participants: ParticipantDetail[];
}
