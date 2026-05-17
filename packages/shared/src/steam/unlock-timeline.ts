export interface GameUnlockTimelineMonth {
  year: number;
  month: number; // 1–12
  count: number;
}

export interface GameUnlockTimeline {
  months: GameUnlockTimelineMonth[];
  total: number;
}
