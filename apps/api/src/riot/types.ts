export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotMatchParticipant {
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
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
}

export interface RiotLeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
}

export interface RiotSummoner {
  id: string;
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameStartTimestamp: number;
    gameDuration: number;
    gameEndedInEarlySurrender: boolean;
    queueId: number;
    participants: RiotMatchParticipant[];
  };
}
