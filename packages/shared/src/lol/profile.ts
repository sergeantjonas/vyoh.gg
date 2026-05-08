export interface RankEntry {
  queueId: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number | null;
  losses: number | null;
  hotStreak: boolean | null;
}

export interface SummonerProfile {
  profileIconId: number | null;
  summonerLevel: number | null;
  rankEntries: RankEntry[];
}
