import type { LiveGameParticipant } from "@vyoh/shared";

// Spectator-V5 doesn't expose teamPosition, so we infer lane from Smite,
// summoner spells, and champion role tags. The five slots are filled by
// optimal assignment over a cost matrix (brute-forced over 5! = 120
// permutations) rather than per-participant classification, so two champs
// that both look "mid" can't both end up there — the algorithm pins each
// lane to exactly one player. Pairs whose swap barely changes total cost
// are surfaced as `uncertain` in the UI.

export const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export type Lane = (typeof LANE_ORDER)[number];

const SMITE_SPELL_ID = 11;
const SPELL_CLEANSE = 1;
const SPELL_EXHAUST = 3;
const SPELL_GHOST = 6;
const SPELL_HEAL = 7;
const SPELL_TELEPORT = 12;
const SPELL_IGNITE = 14;
const SPELL_BARRIER = 21;

// "How surprising is it to see this role play this lane?" 0 = canonical,
// higher = more off-meta. Each champion takes the min across its role tags,
// so a fighter/assassin scores low on both TOP and MID.
const ROLE_LANE_COSTS: Record<string, Partial<Record<Lane, number>>> = {
  marksman: { BOTTOM: 0, SUPPORT: 2, MID: 3, TOP: 4, JUNGLE: 4 },
  support: { SUPPORT: 0, MID: 3, BOTTOM: 3, TOP: 3, JUNGLE: 4 },
  tank: { TOP: 1, SUPPORT: 1, JUNGLE: 2, MID: 3, BOTTOM: 4 },
  fighter: { TOP: 1, JUNGLE: 1, MID: 3, BOTTOM: 3, SUPPORT: 3 },
  assassin: { MID: 1, JUNGLE: 2, TOP: 3, BOTTOM: 3, SUPPORT: 4 },
  mage: { MID: 1, SUPPORT: 2, TOP: 2, JUNGLE: 3, BOTTOM: 4 },
};

// Additive nudges from summoner spells. Small magnitudes so they only break
// ties, never override strong role signals.
const SPELL_LANE_BIAS: Record<number, Partial<Record<Lane, number>>> = {
  [SPELL_TELEPORT]: { TOP: -1.5, MID: -0.5 },
  [SPELL_HEAL]: { BOTTOM: -2 },
  [SPELL_IGNITE]: { MID: -1, TOP: -0.5 },
  [SPELL_EXHAUST]: { SUPPORT: -1, MID: -0.5 },
  [SPELL_CLEANSE]: { MID: -0.5, BOTTOM: -0.5 },
  [SPELL_BARRIER]: { MID: -0.5 },
  [SPELL_GHOST]: { TOP: -0.5 },
};

export function laneCostsFor(
  p: LiveGameParticipant,
  roles: string[]
): Record<Lane, number> {
  const costs: Record<Lane, number> = {
    TOP: 5,
    JUNGLE: 5,
    MID: 5,
    BOTTOM: 5,
    SUPPORT: 5,
  };
  for (const role of roles) {
    const rc = ROLE_LANE_COSTS[role];
    if (!rc) continue;
    for (const lane of LANE_ORDER) {
      const c = rc[lane];
      if (c !== undefined && c < costs[lane]) costs[lane] = c;
    }
  }
  // Smite locks JUNGLE hard but not absolutely — leaves room for the rare
  // off-meta smite-top read if the algorithm finds a better global fit.
  const hasSmite = p.spell1Id === SMITE_SPELL_ID || p.spell2Id === SMITE_SPELL_ID;
  if (hasSmite) {
    costs.JUNGLE = 0;
    for (const lane of LANE_ORDER) {
      if (lane !== "JUNGLE") costs[lane] += 5;
    }
  } else {
    costs.JUNGLE += 5;
  }
  for (const spellId of [p.spell1Id, p.spell2Id]) {
    const bias = SPELL_LANE_BIAS[spellId];
    if (!bias) continue;
    for (const lane of LANE_ORDER) {
      const b = bias[lane];
      if (b !== undefined) costs[lane] += b;
    }
  }
  return costs;
}

export function* permutations(n: number): Generator<number[]> {
  const used = new Array(n).fill(false);
  const current: number[] = [];
  function* rec(): Generator<number[]> {
    if (current.length === n) {
      yield [...current];
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      yield* rec();
      current.pop();
      used[i] = false;
    }
  }
  yield* rec();
}

export interface LaneAssignment {
  participant: LiveGameParticipant;
  lane: Lane | null;
  uncertain: boolean;
}

// Two participants are "uncertain" when swapping their assigned lanes raises
// the total cost by less than this — i.e., the algorithm has near-equal
// evidence for both orderings. Tuned against typical summoner-spell deltas
// (±0.5–2.0) so flex-vs-flex pairs surface but clear assignments don't.
const UNCERTAINTY_THRESHOLD = 1.0;

export function assignLanes(
  team: LiveGameParticipant[],
  rolesByChampion: Record<number, string[]>
): LaneAssignment[] {
  if (team.length !== 5) {
    return team.map((p) => ({ participant: p, lane: null, uncertain: false }));
  }
  const costs = team.map((p) => laneCostsFor(p, rolesByChampion[p.championId] ?? []));
  let bestTotal = Number.POSITIVE_INFINITY;
  let bestLanes: Lane[] = [...LANE_ORDER];
  for (const perm of permutations(5)) {
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const c = costs[i];
      const laneIdx = perm[i];
      const lane = laneIdx === undefined ? undefined : LANE_ORDER[laneIdx];
      if (c && lane) total += c[lane];
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestLanes = perm.map((idx) => LANE_ORDER[idx] as Lane);
    }
  }
  const uncertain = new Set<number>();
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const ci = costs[i];
      const cj = costs[j];
      const li = bestLanes[i];
      const lj = bestLanes[j];
      if (!ci || !cj || !li || !lj) continue;
      const swapDelta = ci[lj] + cj[li] - ci[li] - cj[lj];
      if (swapDelta < UNCERTAINTY_THRESHOLD) {
        uncertain.add(i);
        uncertain.add(j);
      }
    }
  }
  return team
    .map((p, i) => ({
      participant: p,
      lane: bestLanes[i] ?? null,
      uncertain: uncertain.has(i),
    }))
    .sort((a, b) => {
      const ai = a.lane ? LANE_ORDER.indexOf(a.lane) : -1;
      const bi = b.lane ? LANE_ORDER.indexOf(b.lane) : -1;
      return ai - bi;
    });
}
