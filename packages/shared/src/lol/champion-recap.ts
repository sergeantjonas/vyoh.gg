import { excludeRemakes } from "./exclude-remakes.ts";
import type { MatchSummary } from "./match.ts";

/**
 * Single-game summary surfaced when the chapter needs a "receipt" — the one
 * Ahri night, the one Lee Sin game — that proves the verdict. Picked as the
 * highest-kills game, with KDA and recency as tie-breakers (so a 12/8/6
 * stomp doesn't beat a 12/2/9 carry).
 */
export interface ChampionSignatureGame {
  matchId: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  playedAt: string;
  opponentChampion: string | null;
  damageShare: number;
  daysAgo: number;
}

/**
 * Slim projection of the N most-recent matches on this champion. Kept narrow
 * (no timeline arrays, no challenges) but still wide enough to render an
 * editorial row: opponent matchup, position, duration give each row a story
 * beyond the bare KDA box score. The full MatchSummary remains the
 * authoritative shape for match-detail surfaces.
 */
export interface ChampionRecentMatch {
  matchId: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  playedAt: string;
  /** Game length in seconds; formatted to whole minutes at the render site. */
  durationSec: number;
  /** Raw teamPosition from Riot (TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY). */
  position: string;
  /** Lane-opposing champion display name, or null when not solved. */
  opponentChampion: string | null;
}

/** Max length of `recentMatches` returned by the deriver. */
export const CHAMPION_RECAP_RECENT_LIMIT = 5;

export interface ChampionRecap {
  alias: string;
  totalGames: number;
  wins: number;
  losses: number;
  /** null when totalGames === 0 */
  winRate: number | null;
  /** null when totalGames === 0; deaths floored to 1 per Riot convention */
  avgKda: number | null;
  signatureGame: ChampionSignatureGame | null;
  /**
   * Up to CHAMPION_RECAP_RECENT_LIMIT most-recent non-remake matches on this
   * champion, newest first. Empty when totalGames === 0.
   */
  recentMatches: ChampionRecentMatch[];
  peaks: {
    /** Best single-game kill count, 0 when no games. */
    highestKills: number;
    /** Best damageShare (0..1), 0 when no games. */
    highestDamageShare: number;
    /** Games with 0 deaths. */
    perfectKdaCount: number;
    /** Mean kills, 0 when no games. */
    avgKills: number;
    /** Share of games with strictly more than 5 kills (0..1). */
    aboveFiveKillsRate: number;
    /** Share of games where the owner got first blood (0..1). */
    firstBloodRate: number;
    /**
     * Mean team gold differential at 15 (positive = ahead). Excludes games
     * with no timeline data so it isn't biased by zeros.
     */
    avgGoldDiffAt15: number;
  };
  /** Current win/loss streak, or null when the most recent state is a single
   *  result (count < 2). */
  streak: { type: "win" | "loss"; count: number } | null;
  /** Whole days since the most recent non-remake game on this champion. */
  daysSinceLastGame: number | null;
  /** Most-common hour-of-day bucket (0–23). Null when no games. */
  hourMode: number | null;
}

/**
 * Pure deriver — applies the standard remake exclusion and a champion-alias
 * filter, then computes the recap. `now` is injectable so tests don't drift
 * with wall-clock time.
 */
export function deriveChampionRecap(
  alias: string,
  matches: readonly MatchSummary[],
  now: Date = new Date()
): ChampionRecap {
  const filtered = excludeRemakes(matches).filter((m) => m.champion === alias);
  const total = filtered.length;

  if (total === 0) {
    return {
      alias,
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      avgKda: null,
      signatureGame: null,
      recentMatches: [],
      peaks: {
        highestKills: 0,
        highestDamageShare: 0,
        perfectKdaCount: 0,
        avgKills: 0,
        aboveFiveKillsRate: 0,
        firstBloodRate: 0,
        avgGoldDiffAt15: 0,
      },
      streak: null,
      daysSinceLastGame: null,
      hourMode: null,
    };
  }

  let wins = 0;
  let kSum = 0;
  let dSum = 0;
  let aSum = 0;
  let highestKills = 0;
  let highestDamageShare = 0;
  let perfectKda = 0;
  let aboveFive = 0;
  let firstBloods = 0;
  let goldDiffSum = 0;
  let goldDiffCount = 0;

  const hourBuckets = new Array<number>(24).fill(0);

  for (const m of filtered) {
    if (m.win) wins++;
    kSum += m.kills;
    dSum += m.deaths;
    aSum += m.assists;
    if (m.kills > highestKills) highestKills = m.kills;
    if (m.damageShare > highestDamageShare) highestDamageShare = m.damageShare;
    if (m.deaths === 0) perfectKda++;
    if (m.kills > 5) aboveFive++;
    if (m.firstBloodKill) firstBloods++;
    if (m.hasTimeline) {
      goldDiffSum += m.teamGoldDiffAt15;
      goldDiffCount++;
    }
    const hour = new Date(m.playedAt).getHours();
    if (hour >= 0 && hour < 24) hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;
  }

  const losses = total - wins;
  const winRate = wins / total;
  const avgKda = (kSum + aSum) / Math.max(1, dSum);
  const avgKills = kSum / total;

  // Signature pick: highest kills first, then KDA, then most recent.
  const signatureGame = pickSignature(filtered, now);

  // Current streak: scan from most-recent backwards while the result is
  // consistent. Streak only "exists" once it reaches 2.
  const newestFirst = [...filtered].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const latest = newestFirst[0];
  let streak: ChampionRecap["streak"] = null;
  if (latest) {
    let count = 1;
    for (let i = 1; i < newestFirst.length; i++) {
      const next = newestFirst[i];
      if (!next) break;
      if (next.win === latest.win) count++;
      else break;
    }
    if (count >= 2) streak = { type: latest.win ? "win" : "loss", count };
  }

  const daysSinceLastGame = latest
    ? Math.floor(
        (now.getTime() - new Date(latest.playedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  let hourMode = 0;
  let hourPeak = -1;
  for (let h = 0; h < 24; h++) {
    const v = hourBuckets[h] ?? 0;
    if (v > hourPeak) {
      hourPeak = v;
      hourMode = h;
    }
  }

  const recentMatches: ChampionRecentMatch[] = newestFirst
    .slice(0, CHAMPION_RECAP_RECENT_LIMIT)
    .map((m) => ({
      matchId: m.matchId,
      win: m.win,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      playedAt: m.playedAt,
      durationSec: m.durationSec,
      position: m.teamPosition,
      opponentChampion: m.laneOpponent?.championName ?? null,
    }));

  return {
    alias,
    totalGames: total,
    wins,
    losses,
    winRate,
    avgKda,
    signatureGame,
    recentMatches,
    peaks: {
      highestKills,
      highestDamageShare,
      perfectKdaCount: perfectKda,
      avgKills,
      aboveFiveKillsRate: aboveFive / total,
      firstBloodRate: firstBloods / total,
      avgGoldDiffAt15: goldDiffCount > 0 ? goldDiffSum / goldDiffCount : 0,
    },
    streak,
    daysSinceLastGame,
    hourMode,
  };
}

function pickSignature(
  matches: readonly MatchSummary[],
  now: Date
): ChampionSignatureGame | null {
  if (matches.length === 0) return null;
  // Sort by kills DESC, then KDA DESC, then playedAt DESC. Pick the head.
  const ordered = [...matches].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    const kdaA = (a.kills + a.assists) / Math.max(1, a.deaths);
    const kdaB = (b.kills + b.assists) / Math.max(1, b.deaths);
    if (kdaB !== kdaA) return kdaB - kdaA;
    return b.playedAt.localeCompare(a.playedAt);
  });
  const pick = ordered[0];
  if (!pick) return null;
  return {
    matchId: pick.matchId,
    kills: pick.kills,
    deaths: pick.deaths,
    assists: pick.assists,
    win: pick.win,
    durationSec: pick.durationSec,
    playedAt: pick.playedAt,
    opponentChampion: pick.laneOpponent?.championName ?? null,
    damageShare: pick.damageShare,
    daysAgo: Math.floor(
      (now.getTime() - new Date(pick.playedAt).getTime()) / (1000 * 60 * 60 * 24)
    ),
  };
}

/**
 * Structured paragraph segment. The JSX layer renders each kind with its own
 * animation: `text` types in as prose, `number` count-ups, `subject`/`opponent`
 * slide in from below, `emphasis` blooms.
 */
export type VerdictSegment =
  | { kind: "text"; value: string }
  | { kind: "number"; value: string; raw: number }
  | { kind: "subject"; value: string }
  | { kind: "opponent"; value: string }
  | { kind: "emphasis"; value: string };

/**
 * One clause of the verdict paragraph. Clauses are joined with a space between
 * the period and the next clause's first segment so the JSX can mount them as
 * separate animated blocks while the text reads as a single sentence.
 */
export type VerdictClause = VerdictSegment[];

/**
 * Compose the verdict paragraph from a recap. Voice is third-person
 * observational — the page narrates the subject, not the visitor. Returns an
 * array of clauses; the JSX layer cascades reveals across them.
 *
 * Selection rules:
 *  - Clause 1 (verdict): 1–2 adjectives picked from signal strength.
 *  - Clause 2 (volume):  always "{Champion} is the signature pick — N games, X% won."
 *  - Clause 3 (receipt): the signature game, if one exists, framed as
 *                        "The {opponent} game ({K}/{D}/{A}) is the high-water mark."
 *  - Clause 4 (context): streak / aggression / recency — whichever signal is
 *                        strongest. Skipped when nothing distinct stands out.
 */
export function verdictParagraph(recap: ChampionRecap): VerdictClause[] {
  if (recap.totalGames === 0) {
    return [
      [
        { kind: "text", value: "No tracked " },
        { kind: "subject", value: recap.alias },
        { kind: "text", value: " games yet." },
      ],
    ];
  }

  const primary = pickPrimaryVerdict(recap);
  const clauses: VerdictClause[] = [];

  // Clause 1 — verdict
  clauses.push(verdictAdjectives(recap, primary));

  // Clause 2 — volume
  clauses.push(volumeClause(recap));

  // Clause 3 — receipt (signature game), skipped for struggling verdicts.
  const receipt = receiptClause(recap, primary);
  if (receipt) clauses.push(receipt);

  // Clause 4 — context (must not restate the signal in the verdict).
  const context = contextClause(recap, primary);
  if (context) clauses.push(context);

  return clauses;
}

/**
 * Tag for the primary verdict so the context clause can avoid double-counting
 * a signal that's already been used as an adjective.
 */
type PrimaryVerdict =
  | "aggressive"
  | "surgical"
  | "lane-dominant"
  | "struggling"
  | "measured";

function pickPrimaryVerdict(recap: ChampionRecap): PrimaryVerdict {
  const { peaks, winRate, avgKda } = recap;
  if (peaks.aboveFiveKillsRate > 0.45) return "aggressive";
  if (peaks.perfectKdaCount >= 3) return "surgical";
  if (peaks.avgGoldDiffAt15 > 500) return "lane-dominant";
  // "Struggling" — honest negative verdict when KDA is poor and win-rate is
  // low. Prevents the "Measured" fallback from praising a player who is just
  // having a rough stretch.
  if (avgKda !== null && avgKda < 1.5 && winRate !== null && winRate < 0.4)
    return "struggling";
  return "measured";
}

const VERDICT_LABEL: Record<PrimaryVerdict, string> = {
  aggressive: "Aggressive",
  surgical: "Surgical",
  "lane-dominant": "Lane-dominant",
  struggling: "Struggling",
  measured: "Measured",
};

function verdictAdjectives(recap: ChampionRecap, primary: PrimaryVerdict): VerdictClause {
  const adjectives: string[] = [VERDICT_LABEL[primary]];
  const { winRate, streak } = recap;

  // Secondary axis — outcome consistency
  if (streak?.type === "win" && streak.count >= 3) adjectives.push("on form");
  else if (winRate !== null && winRate < 0.45) adjectives.push("inconsistent");
  else if (winRate !== null && winRate > 0.6) adjectives.push("reliable");

  const head = adjectives[0];
  const tail = adjectives[1];
  if (!head) return [{ kind: "text", value: "" }];
  if (!tail) {
    return [
      { kind: "emphasis", value: head },
      { kind: "text", value: "." },
    ];
  }
  return [
    { kind: "emphasis", value: head },
    { kind: "text", value: ", " },
    { kind: "emphasis", value: tail },
    { kind: "text", value: "." },
  ];
}

function volumeClause(recap: ChampionRecap): VerdictClause {
  const pct = recap.winRate !== null ? Math.round(recap.winRate * 100) : 0;
  return [
    { kind: "subject", value: recap.alias },
    { kind: "text", value: " took " },
    {
      kind: "number",
      value: String(recap.totalGames),
      raw: recap.totalGames,
    },
    { kind: "text", value: " games this season; " },
    { kind: "number", value: `${pct}%`, raw: pct },
    { kind: "text", value: " closed out." },
  ];
}

function receiptClause(
  recap: ChampionRecap,
  primary: PrimaryVerdict
): VerdictClause | null {
  const sig = recap.signatureGame;
  if (!sig) return null;
  // Struggling players don't have a "high-water mark" — that framing would
  // be melodramatic when the best game is still rough. Skip the receipt and
  // let the context clause carry the closing line.
  if (primary === "struggling") return null;
  const score = `${sig.kills}/${sig.deaths}/${sig.assists}`;
  const opponent = sig.opponentChampion;
  if (opponent) {
    return [
      { kind: "text", value: "Best night so far: " },
      { kind: "number", value: score, raw: sig.kills },
      { kind: "text", value: " against " },
      { kind: "opponent", value: opponent },
      { kind: "text", value: "." },
    ];
  }
  return [
    { kind: "text", value: "Best night so far: " },
    { kind: "number", value: score, raw: sig.kills },
    { kind: "text", value: "." },
  ];
}

function contextClause(
  recap: ChampionRecap,
  primary: PrimaryVerdict
): VerdictClause | null {
  const { streak, peaks, daysSinceLastGame, totalGames } = recap;

  // Streak first — recency beats aggregate detail.
  if (streak?.type === "win" && streak.count >= 3) {
    return [
      { kind: "text", value: "On a " },
      { kind: "number", value: String(streak.count), raw: streak.count },
      { kind: "text", value: "-game win streak." },
    ];
  }
  if (streak?.type === "loss" && streak.count >= 3) {
    return [
      { kind: "text", value: "Cold lately — " },
      { kind: "number", value: String(streak.count), raw: streak.count },
      { kind: "text", value: " losses in a row." },
    ];
  }
  // Avoid restating the signal the adjective already covered: skip the
  // aggression context-line when the primary verdict is already "aggressive"
  // (same for surgical / lane-dominant).
  //
  // Each context threshold sits BELOW its pickPrimaryVerdict counterpart, so
  // the clause fires for signals that are notable but didn't win the verdict:
  //   surgical      primary >= 3    context >= 2
  //   lane-dominant primary > 500   context >= 400
  //   aggressive    primary > 0.45  context >= 0.35
  // This one read `>= 0.5` until 2026-07-25 — above its own primary bar, which
  // made the branch unreachable: any rate clearing 0.5 also clears 0.45, so
  // `primary` was always "aggressive" and the guard never passed.
  if (primary !== "aggressive" && peaks.aboveFiveKillsRate >= 0.35) {
    const pct = Math.round(peaks.aboveFiveKillsRate * 100);
    return [
      { kind: "text", value: "Over five kills in " },
      { kind: "number", value: `${pct}%`, raw: pct },
      { kind: "text", value: " of games." },
    ];
  }
  if (primary !== "surgical" && peaks.perfectKdaCount >= 2) {
    return [
      {
        kind: "number",
        value: String(peaks.perfectKdaCount),
        raw: peaks.perfectKdaCount,
      },
      { kind: "text", value: " perfect-KDA games on the board." },
    ];
  }
  if (primary !== "lane-dominant" && peaks.avgGoldDiffAt15 >= 400 && totalGames >= 5) {
    return [
      { kind: "text", value: "Lane usually closes ahead — " },
      {
        kind: "number",
        value: `+${Math.round(peaks.avgGoldDiffAt15)}g`,
        raw: peaks.avgGoldDiffAt15,
      },
      { kind: "text", value: " at 15." },
    ];
  }
  if (daysSinceLastGame !== null && daysSinceLastGame >= 14 && totalGames >= 3) {
    return [
      { kind: "text", value: "Quiet for " },
      { kind: "number", value: String(daysSinceLastGame), raw: daysSinceLastGame },
      { kind: "text", value: " days." },
    ];
  }
  return null;
}

/**
 * Flat-text preview of the paragraph — used by tests and the dry-run sample.
 * The JSX layer never calls this; it walks the structured segments directly.
 */
export function verdictPreview(clauses: VerdictClause[]): string {
  return clauses.map((clause) => clause.map((seg) => seg.value).join("")).join(" ");
}
