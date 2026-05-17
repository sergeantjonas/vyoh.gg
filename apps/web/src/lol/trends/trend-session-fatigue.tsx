// Baseline: personal — your WR by game-position-within-session.
import { cn } from "@/lib/utils";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { useMemo } from "react";

const SESSION_GAP_MS = 30 * 60 * 1000;
const MIN_LONG_SESSIONS = 5;
const PRESCRIPTION_THRESHOLD_PP = 10;

const SVG_W = 200;
const SVG_H = 48;

interface PositionBucket {
  label: string;
  wins: number;
  games: number;
}

function clusterSessions(matches: MatchSummary[]): MatchSummary[][] {
  const chrono = [...matches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );

  const sessions: MatchSummary[][] = [];
  let current: MatchSummary[] = [];

  for (const m of chrono) {
    if (current.length === 0) {
      current.push(m);
      continue;
    }
    const prev = current.at(-1);
    if (!prev) {
      current.push(m);
      continue;
    }
    const prevEnd = new Date(prev.playedAt).getTime() + prev.durationSec * 1000;
    const gap = new Date(m.playedAt).getTime() - prevEnd;
    if (gap < SESSION_GAP_MS) {
      current.push(m);
    } else {
      sessions.push(current);
      current = [m];
    }
  }
  if (current.length > 0) sessions.push(current);
  return sessions;
}

function FatigueLine({ buckets }: { buckets: PositionBucket[] }) {
  const points = buckets.map((b) => (b.games > 0 ? b.wins / b.games : null));
  const defined = points.filter((p) => p !== null);
  if (defined.length < 2) return null;

  const n = buckets.length;
  const xs = buckets.map((_, i) => (i / (n - 1)) * SVG_W);
  const ys = points.map((p) => (p !== null ? SVG_H - p * SVG_H : null));

  // Build polyline segments, splitting on null (no-data) points
  const segments: string[] = [];
  let seg = "";
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    if (y === null) {
      if (seg) segments.push(seg);
      seg = "";
    } else {
      seg += `${seg ? " " : ""}${xs[i]},${y}`;
    }
  }
  if (seg) segments.push(seg);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 48 }}
        role="img"
        aria-label="Win rate by game number in session"
      >
        <line
          x1={0}
          y1={SVG_H / 2}
          x2={SVG_W}
          y2={SVG_H / 2}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-muted-foreground/20"
        />
        {segments.map((pts) => (
          <polyline
            key={pts}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pts}
            className="text-amber-400/80"
          />
        ))}
        {buckets.map((b, i) => {
          const y = ys[i];
          if (y === null || b.games === 0) return null;
          return (
            <circle
              key={b.label}
              cx={xs[i]}
              cy={y}
              r={2.5}
              fill="currentColor"
              className="text-amber-400/80"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        {buckets.map((b) => (
          <span key={b.label} className={cn(b.games === 0 && "opacity-30")}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrendSessionFatigue({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const stats = useMemo(() => {
    const played = excludeRemakes(current);
    const sessions = clusterSessions(played);
    const longSessions = sessions.filter((s) => s.length >= 4);
    if (longSessions.length < MIN_LONG_SESSIONS) return null;

    const buckets: PositionBucket[] = [
      { label: "G1", wins: 0, games: 0 },
      { label: "G2", wins: 0, games: 0 },
      { label: "G3", wins: 0, games: 0 },
      { label: "G4+", wins: 0, games: 0 },
    ];

    for (const session of sessions) {
      for (let pos = 0; pos < session.length; pos++) {
        const m = session[pos];
        if (!m) continue;
        const idx = Math.min(pos, 3);
        const b = buckets[idx];
        if (!b) continue;
        b.games++;
        if (m.win) b.wins++;
      }
    }

    const g1 = buckets[0];
    const g4 = buckets[3];
    if (!g1 || !g4 || g1.games === 0 || g4.games === 0) return null;

    const g1Wr = g1.wins / g1.games;
    const g4Wr = g4.wins / g4.games;
    const dropPp = Math.round((g1Wr - g4Wr) * 100);

    return { buckets, g1Wr, g4Wr, dropPp, sampleSize: played.length };
  }, [current]);

  const playedCount = useMemo(() => excludeRemakes(current).length, [current]);

  if (!stats) {
    return (
      <ConclusionCard
        title="Session fatigue"
        sampleSize={playedCount}
        verdict="Need 5+ sessions of 4 games or more to detect fatigue patterns."
        empty
      />
    );
  }

  const { buckets, g1Wr, g4Wr, dropPp, sampleSize } = stats;
  const g1Pct = Math.round(g1Wr * 100);
  const g4Pct = Math.round(g4Wr * 100);

  const hasFatigue = dropPp >= PRESCRIPTION_THRESHOLD_PP;

  const verdict = hasFatigue
    ? `Win rate drops to ${g4Pct}% from game 4 onward — down from ${g1Pct}% at game 1.`
    : `Win rate holds at ${g4Pct}% in game 4+ — no clear fatigue pattern.`;

  const prescription = hasFatigue ? "Three-game cap?" : undefined;

  return (
    <ConclusionCard
      title="Session fatigue"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<FatigueLine buckets={buckets} />}
    />
  );
}
