import { SHADOW_BODY, SHADOW_LABEL } from "@/home/recap/chapter-shadows";
import { useHomeToday } from "@/home/use-home-today";
import { formatHoursMinutes } from "@vyoh/shared";

function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-28 flex-col items-center gap-1">
      <span
        className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
        style={{ textShadow: SHADOW_BODY }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.2em] text-foreground/70"
        style={{ textShadow: SHADOW_LABEL }}
      >
        {label}
      </span>
    </div>
  );
}

function ChipPlaceholder({ label }: { label: string }) {
  return (
    <Chip label={label} value={<span className="text-muted-foreground/70">—</span>} />
  );
}

function Dash() {
  return <span className="text-muted-foreground/70">—</span>;
}

function formatMatches(count: number, wins: number, losses: number): React.ReactNode {
  if (count === 0) return <Dash />;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{count}</span>
      <span className="text-[11px] font-normal text-foreground/60">
        {wins}W {losses}L
      </span>
    </span>
  );
}

function formatKda(
  matches: number,
  kills: number,
  deaths: number,
  assists: number
): React.ReactNode {
  if (matches === 0) return <Dash />;
  return `${kills} / ${deaths} / ${assists}`;
}

function formatMinutes(minutes: number): React.ReactNode {
  if (minutes === 0) return <Dash />;
  return formatHoursMinutes(minutes);
}

function formatUnlocks(count: number): React.ReactNode {
  if (count === 0) return <Dash />;
  return count.toLocaleString("en-GB");
}

/**
 * Conclusion "today" pulse — rolling-24h LoL matches, total KDA, Steam
 * minutes today, and Steam achievement unlocks. Owner-filtered server-side
 * so test accounts can't pollute the pulse. Polls every 5 minutes so the
 * chip stays warm during a session without hammering the API.
 */
export function TodayStrip() {
  const query = useHomeToday();
  const data = query.data;
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <span
        className="text-[10px] uppercase tracking-[0.2em] text-foreground/70"
        style={{ textShadow: SHADOW_LABEL }}
      >
        Last 24 hours
      </span>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        {data ? (
          <>
            <Chip
              label="Matches"
              value={formatMatches(data.lolMatches, data.lolWins, data.lolLosses)}
            />
            <Chip
              label="K / D / A"
              value={formatKda(data.lolMatches, data.kills, data.deaths, data.assists)}
            />
            <Chip label="Steam" value={formatMinutes(data.steamMinutes)} />
            <Chip label="Unlocks" value={formatUnlocks(data.achievementUnlocks)} />
          </>
        ) : (
          <>
            <ChipPlaceholder label="Matches" />
            <ChipPlaceholder label="K / D / A" />
            <ChipPlaceholder label="Steam" />
            <ChipPlaceholder label="Unlocks" />
          </>
        )}
      </div>
    </section>
  );
}
