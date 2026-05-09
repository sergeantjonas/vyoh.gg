export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotChallenges {
  killParticipation?: number;
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
  physicalDamageDealtToChampions: number;
  magicDamageDealtToChampions: number;
  trueDamageDealtToChampions: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  detectorWardsPlaced: number;
  summoner1Id: number;
  summoner2Id: number;
  champLevel: number;
  perks: {
    styles: {
      selections: { perk: number }[];
    }[];
  };
  challenges?: RiotChallenges;
}

export interface RiotMatchTeam {
  teamId: number;
  win: boolean;
  objectives: {
    baron: { first: boolean; kills: number };
    champion: { first: boolean; kills: number };
    dragon: { first: boolean; kills: number };
    inhibitor: { first: boolean; kills: number };
    riftHerald: { first: boolean; kills: number };
    tower: { first: boolean; kills: number };
  };
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
    teams: RiotMatchTeam[];
    participants: RiotMatchParticipant[];
  };
}
