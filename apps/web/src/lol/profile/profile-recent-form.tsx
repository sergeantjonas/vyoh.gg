import { queueColor } from "@/lol/_shared/queue-color";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeStreak } from "@/lol/trends/trend-stats";
import { TrendStreak } from "@/lol/trends/trend-streak";
import { useNavigate } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";

const FORM_LENGTH = 20;

function pipTitle(m: MatchSummary): string {
  const kda =
    m.deaths === 0
      ? `${m.kills + m.assists} KDA`
      : `${((m.kills + m.assists) / m.deaths).toFixed(2)} KDA`;
  return `${m.champion} · ${m.queueType} · ${m.kills}/${m.deaths}/${m.assists} (${kda})`;
}

export function ProfileRecentForm({ accountSlug }: { accountSlug: string }) {
  const { matches } = useMatchWindow();
  const navigate = useNavigate();
  const recent = matches?.slice(0, FORM_LENGTH) ?? [];

  if (recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Recent Form
        </div>
        <TrendStreak streak={computeStreak(recent)} />
      </div>
      <m.div
        className="flex flex-wrap gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {recent.map((match) => (
          <button
            key={match.matchId}
            type="button"
            title={pipTitle(match)}
            onClick={() =>
              navigate({
                to: "/lol/$accountSlug/matches/$matchId",
                params: { accountSlug, matchId: match.matchId },
              })
            }
            className="size-5 rounded-sm transition-transform hover:scale-125 hover:z-10 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              backgroundColor: queueColor(match.queueType),
              opacity: match.win ? 1 : 0.3,
              outline: match.win ? undefined : `1px solid ${queueColor(match.queueType)}`,
              outlineOffset: "-1px",
            }}
          />
        ))}
      </m.div>
    </div>
  );
}
