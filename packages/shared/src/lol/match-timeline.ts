export interface MatchTimelineFrame {
  ts: number;
  perParticipant: Record<
    number,
    { gold: number; level: number; cs: number; position: { x: number; y: number } }
  >;
}

export interface MatchTimelineKill {
  ts: number;
  killerId: number;
  victimId: number;
  assistIds: number[];
  position: { x: number; y: number } | null;
}

export interface MatchTimelineObjective {
  ts: number;
  type: string;
  teamId: number;
  position: { x: number; y: number } | null;
}

export type MatchTimelineBuildEventType = "PURCHASED" | "SOLD" | "UNDO";

export interface MatchTimelineBuildEvent {
  ts: number;
  type: MatchTimelineBuildEventType;
  itemId: number;
}

export interface MatchTimelineSkillEvent {
  ts: number;
  slot: 1 | 2 | 3 | 4;
}

export interface MatchTimelineProjection {
  matchId: string;
  frameIntervalMs: number;
  participants: { participantId: number; puuid: string }[];
  frames: MatchTimelineFrame[];
  kills: MatchTimelineKill[];
  objectives: MatchTimelineObjective[];
  buildOrders: { participantId: number; events: MatchTimelineBuildEvent[] }[];
  skillOrders: { participantId: number; slots: MatchTimelineSkillEvent[] }[];
}
