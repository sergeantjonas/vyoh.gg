export interface ChampionBuildFlowEntry {
  matchId: string;
  win: boolean;
  /** Item IDs in purchase order, filtered to items present in the final inventory. */
  items: number[];
}
