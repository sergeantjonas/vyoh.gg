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

export interface RiotActiveGameParticipant {
  teamId: number;
  spell1Id: number;
  spell2Id: number;
  championId: number;
  puuid: string;
  riotId: string; // "GameName#Tag"
  perks: {
    perkIds: number[];
    perkStyle: number;
    perkSubStyle: number;
  };
}

export interface RiotActiveGameBan {
  teamId: number;
  championId: number;
  pickTurn: number;
}

export interface RiotActiveGame {
  gameId: number;
  gameStartTime: number; // epoch ms
  gameLength: number; // seconds elapsed at time of response
  mapId: number;
  gameMode: string;
  gameType: string;
  gameQueueConfigId: number;
  platformId: string;
  participants: RiotActiveGameParticipant[];
  bannedChampions: RiotActiveGameBan[];
}

export interface RiotChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
}

export interface RiotParticipantFrame {
  participantId: number;
  totalGold: number;
  level: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
  position: { x: number; y: number };
}

export interface RiotTimelineEvent {
  timestamp: number;
  type: string;
  // CHAMPION_KILL
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  position?: { x: number; y: number };
  // ITEM_PURCHASED / ITEM_SOLD / ITEM_UNDO / SKILL_LEVEL_UP
  participantId?: number;
  itemId?: number;
  beforeId?: number;
  skillSlot?: number;
  levelUpType?: string;
  // BUILDING_KILL
  teamId?: number;
  buildingType?: string;
  // ELITE_MONSTER_KILL
  killerTeamId?: number;
  monsterType?: string;
  monsterSubType?: string;
}

export interface RiotTimelineFrame {
  timestamp: number;
  participantFrames: Record<string, RiotParticipantFrame>;
  events: RiotTimelineEvent[];
}

export interface RiotMatchTimeline {
  metadata: { matchId: string; participants: string[] };
  info: {
    frameInterval: number;
    // present in production but some older cached responses may omit it
    participants?: { participantId: number; puuid: string }[];
    frames: RiotTimelineFrame[];
  };
}
