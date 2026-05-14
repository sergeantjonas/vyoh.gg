const MIN_MATCHUP_GAMES = 5;

export interface MatchupRow {
  champion: string;
  games: number;
  wins: number;
}

export interface WeakestMatchup {
  champion: string;
  games: number;
  wr: number;
  baselineWr: number;
  deltaPP: number;
}

export function buildWeakestMatchup(matchups: MatchupRow[]): WeakestMatchup | null {
  const eligible = matchups.filter((m) => m.games >= MIN_MATCHUP_GAMES);
  if (eligible.length === 0) return null;

  const totalGames = matchups.reduce((acc, m) => acc + m.games, 0);
  const totalWins = matchups.reduce((acc, m) => acc + m.wins, 0);
  if (totalGames === 0) return null;
  const baselineWr = totalWins / totalGames;

  let worst: MatchupRow | null = null;
  let worstWr = Number.POSITIVE_INFINITY;
  for (const m of eligible) {
    const wr = m.wins / m.games;
    if (wr < worstWr) {
      worstWr = wr;
      worst = m;
    }
  }
  if (!worst) return null;

  return {
    champion: worst.champion,
    games: worst.games,
    wr: worstWr,
    baselineWr,
    deltaPP: Math.round((baselineWr - worstWr) * 100),
  };
}
