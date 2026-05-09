export interface ParticipantDetail {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
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
  csTotal: number;
  csPerMin: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  controlWardsPurchased: number;
  kp: number;
  damageShare: number;
  goldShare: number;
  damageDealtPhysical: number;
  damageDealtMagic: number;
  damageDealtTrue: number;
  summoner1Id: number;
  summoner2Id: number;
  keystone: number;
  championLevel: number;
}

export interface TeamSummary {
  teamId: number;
  win: boolean;
  totalKills: number;
  totalGold: number;
  objectives: {
    baron: { first: boolean; kills: number };
    dragon: { first: boolean; kills: number };
    inhibitor: { first: boolean; kills: number };
    riftHerald: { first: boolean; kills: number };
    tower: { first: boolean; kills: number };
  };
}

export interface MatchDetail {
  matchId: string;
  queueType: string;
  durationSec: number;
  playedAt: string;
  teams: TeamSummary[];
  participants: ParticipantDetail[];
}
