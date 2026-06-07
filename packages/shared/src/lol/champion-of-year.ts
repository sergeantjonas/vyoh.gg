import type { MatchSummary } from "./match.ts";

// Per-champion aggregate used by the "signature champion" selector. Total
// stats over the input window; the selector picks the row with the highest
// `games` count as the year's headline champion.
export interface ChampionAggregate {
  champion: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

// Single source of truth for the recap's "champion of the year" pick. Used by
// the profile page's signature splash backdrop AND by the profile OG card —
// keeping the selection rule here means the shareable OG and the destination
// page always agree on which champion the viewer sees. Remakes excluded per
// the standing LoL domain invariant.
export function selectChampionOfYear(matches: MatchSummary[]): ChampionAggregate | null {
  const map = new Map<string, ChampionAggregate>();
  for (const m of matches) {
    if (m.remake) continue;
    const prev = map.get(m.champion) ?? {
      champion: m.champion,
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    map.set(m.champion, {
      ...prev,
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
      kills: prev.kills + m.kills,
      deaths: prev.deaths + m.deaths,
      assists: prev.assists + m.assists,
    });
  }
  const list = [...map.values()];
  if (list.length === 0) return null;
  list.sort((a, b) => b.games - a.games);
  return list[0] ?? null;
}
