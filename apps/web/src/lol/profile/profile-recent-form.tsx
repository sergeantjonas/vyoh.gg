import { MatchRecord } from "@/lol/_shared/match-record";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeStreak } from "@/lol/trends/trend-stats";
import { TrendStreak } from "@/lol/trends/trend-streak";

const FORM_LENGTH = 20;

export function ProfileRecentForm({ accountSlug }: { accountSlug: string }) {
  const { matches } = useMatchWindow();
  const recent = matches?.filter((m) => !m.remake).slice(0, FORM_LENGTH) ?? [];

  if (recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Recent Form
        </div>
        <TrendStreak streak={computeStreak(recent)} />
      </div>
      <MatchRecord matches={recent} accountSlug={accountSlug} />
    </div>
  );
}
