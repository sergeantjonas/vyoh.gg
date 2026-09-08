import { type ParticipantDetail, SCORE_METRICS, type ScoreMetric } from "@vyoh/shared";

// Badges crown the leader of each metric the score-of-game grade averages,
// read from the same definitions so the two can never disagree.
type BadgeKey = ScoreMetric;

const BADGE_DEFS: Record<BadgeKey, { label: string; tip: string }> = {
  damage: { label: "Top DMG", tip: "Most damage dealt to champions" },
  kda: { label: "Top KDA", tip: "Highest KDA ratio" },
  vision: { label: "Top Vision", tip: "Highest vision score" },
  kp: { label: "Top KP", tip: "Highest kill participation" },
  cs: { label: "Top CS", tip: "Most creep score" },
  deaths: { label: "Low Deaths", tip: "Fewest deaths in this game" },
};

export function computeBadges(
  participants: ParticipantDetail[]
): Map<string, { label: string; tip: string }> {
  type Candidate = { puuid: string; key: BadgeKey; margin: number };
  const candidates: Candidate[] = [];

  function maxWinner(key: BadgeKey, getValue: (p: ParticipantDetail) => number) {
    const sorted = [...participants].sort((a, b) => getValue(b) - getValue(a));
    const best = sorted[0];
    const second = sorted[1];
    if (!best || !second) return;
    const bv = getValue(best);
    const sv = getValue(second);
    if (bv === sv) return;
    candidates.push({ puuid: best.puuid, key, margin: (bv - sv) / Math.max(bv, 1) });
  }

  function minWinner(key: BadgeKey, getValue: (p: ParticipantDetail) => number) {
    const sorted = [...participants].sort((a, b) => getValue(a) - getValue(b));
    const best = sorted[0];
    const second = sorted[1];
    if (!best || !second) return;
    const bv = getValue(best);
    const sv = getValue(second);
    if (bv === sv) return;
    const maxVal = Math.max(...participants.map(getValue), 1);
    candidates.push({ puuid: best.puuid, key, margin: (sv - bv) / maxVal });
  }

  for (const key of Object.keys(BADGE_DEFS) as BadgeKey[]) {
    const metric = SCORE_METRICS[key];
    (metric.higherIsBetter ? maxWinner : minWinner)(key, metric.value);
  }

  // Most distinctive first — greedily assign one badge per participant
  candidates.sort((a, b) => b.margin - a.margin);

  const result = new Map<string, { label: string; tip: string }>();
  for (const c of candidates) {
    if (!result.has(c.puuid)) {
      result.set(c.puuid, BADGE_DEFS[c.key]);
    }
  }
  return result;
}
