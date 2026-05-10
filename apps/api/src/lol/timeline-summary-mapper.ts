import type { RiotMatchTimeline } from "../riot/types";

export interface TimelineSummaryMetrics {
  csAt10: number;
  csAt15: number;
  goldAt10: number;
  goldAt15: number;
  teamGoldDiffAt15: number;
  deathTimings: number[];
}

const ZERO: TimelineSummaryMetrics = {
  csAt10: 0,
  csAt15: 0,
  goldAt10: 0,
  goldAt15: 0,
  teamGoldDiffAt15: 0,
  deathTimings: [],
};

// Resolve the user's participantId (1-10) from either info.participants
// (when present) or the metadata participants order (always present).
function resolveParticipantId(timeline: RiotMatchTimeline, puuid: string): number | null {
  const fromInfo = timeline.info.participants?.find((p) => p.puuid === puuid);
  if (fromInfo) return fromInfo.participantId;
  const idx = timeline.metadata.participants.indexOf(puuid);
  if (idx === -1) return null;
  return idx + 1;
}

// Riot frames are emitted at frameInterval (typically 60_000ms). Find the
// frame whose timestamp first reaches the requested minute mark — that's the
// "frame at or just past minute N" for our purposes. Returns null when the
// match ended before that minute (remakes, fast surrenders).
function frameAtMinute(
  timeline: RiotMatchTimeline,
  minute: number
): RiotMatchTimeline["info"]["frames"][number] | null {
  const targetMs = minute * 60_000;
  for (const frame of timeline.info.frames) {
    if (frame.timestamp >= targetMs) return frame;
  }
  return null;
}

export function riotTimelineToSummaryMetrics(
  timeline: RiotMatchTimeline,
  puuid: string
): TimelineSummaryMetrics {
  const participantId = resolveParticipantId(timeline, puuid);
  if (participantId === null) return ZERO;

  const idStr = String(participantId);

  const f10 = frameAtMinute(timeline, 10);
  const f15 = frameAtMinute(timeline, 15);

  const me10 = f10?.participantFrames[idStr];
  const me15 = f15?.participantFrames[idStr];

  const csOf = (
    pf: { minionsKilled?: number; jungleMinionsKilled?: number } | undefined
  ) => (pf ? (pf.minionsKilled ?? 0) + (pf.jungleMinionsKilled ?? 0) : 0);

  const csAt10 = csOf(me10);
  const csAt15 = csOf(me15);
  const goldAt10 = me10?.totalGold ?? 0;
  const goldAt15 = me15?.totalGold ?? 0;

  let teamGoldDiffAt15 = 0;
  if (f15) {
    // Team 100 = participants 1-5, team 200 = 6-10. The user's team is
    // determined by their participantId. Sum each side's totalGold at the
    // 15-min frame and take user-team minus enemy-team so a positive number
    // always means "we were ahead."
    const userTeam = participantId <= 5 ? 100 : 200;
    let userTeamGold = 0;
    let enemyTeamGold = 0;
    for (const pf of Object.values(f15.participantFrames)) {
      const team = pf.participantId <= 5 ? 100 : 200;
      if (team === userTeam) userTeamGold += pf.totalGold;
      else enemyTeamGold += pf.totalGold;
    }
    teamGoldDiffAt15 = userTeamGold - enemyTeamGold;
  }

  const deathTimings: number[] = [];
  for (const frame of timeline.info.frames) {
    for (const event of frame.events) {
      if (event.type === "CHAMPION_KILL" && event.victimId === participantId) {
        deathTimings.push(Math.round(event.timestamp / 1000));
      }
    }
  }

  return {
    csAt10,
    csAt15,
    goldAt10,
    goldAt15,
    teamGoldDiffAt15,
    deathTimings,
  };
}
