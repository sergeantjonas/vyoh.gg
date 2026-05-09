export interface ItemStats {
  itemId: number;
  games: number;
  wins: number;
}

export interface MatchupStats {
  champion: string;
  games: number;
  wins: number;
}

export interface ChampionExtras {
  topItems: ItemStats[];
  matchups: MatchupStats[];
}
