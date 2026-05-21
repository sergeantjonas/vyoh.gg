export interface ParticipantOwnerExtras {
  spellCasts: {
    q: number;
    w: number;
    e: number;
    r: number;
    summoner1: number;
    summoner2: number;
  };
  multikills: {
    double: number;
    triple: number;
    quadra: number;
    penta: number;
    killingSprees: number;
    largestKillingSpree: number;
  };
  survival: {
    totalDamageTaken: number;
    damageSelfMitigated: number;
    totalHeal: number;
    totalTimeCCDealt: number;
    totalTimeSpentDead: number;
    longestTimeSpentLiving: number;
  };
  challenges: {
    soloKills?: number;
    outnumberedKills?: number;
    survivedSingleDigitHpCount?: number;
    effectiveHealAndShielding?: number;
    enemyChampionImmobilizations?: number;
    damagePerMinute?: number;
    laneMinionsFirst10Minutes?: number;
    skillshotsHit?: number;
    skillshotsDodged?: number;
    maxCsAdvantageOnLaneOpponent?: number;
    maxLevelLeadLaneOpponent?: number;
    visionScoreAdvantageLaneOpponent?: number;
    dragonTakedowns?: number;
    baronTakedowns?: number;
    riftHeraldTakedowns?: number;
    timeCCingOthers?: number;
  };
}

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
  owner?: ParticipantOwnerExtras;
}

export interface TeamSummary {
  teamId: number;
  win: boolean;
  totalKills: number;
  totalGold: number;
  objectives: {
    baron: { first: boolean; kills: number };
    champion: { first: boolean; kills: number };
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
