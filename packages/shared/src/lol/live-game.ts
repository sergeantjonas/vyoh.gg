export interface LiveRankEntry {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface LiveMastery {
  level: number;
  points: number;
}

export interface LiveGameParticipant {
  puuid: string;
  teamId: number;
  championId: number;
  spell1Id: number;
  spell2Id: number;
  keystone: number;
  riotIdGameName: string;
  riotIdTagLine: string;
  rank: LiveRankEntry | null;
  mastery: LiveMastery | null;
  recentForm: boolean[] | null; // null = non-whitelisted; array = last-5 wins for whitelisted
}

export interface LiveBan {
  teamId: number;
  championId: number;
  pickTurn: number;
}

export interface LiveMatch {
  gameId: number;
  gameStartTime: number; // epoch ms when game started
  gameLength: number; // seconds elapsed when last polled
  polledAt: number; // epoch ms when polled; client uses Date.now()-polledAt to advance the clock
  queueId: number;
  mapId: number;
  gameMode: string; // e.g. "CLASSIC", "ARAM", "CHERRY" (Arena)
  platformId: string;
  participants: LiveGameParticipant[];
  bans: LiveBan[];
}
