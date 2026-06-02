import { useHomeWeeklyTotals } from "@/home/use-home-weekly-totals";
import { formatHoursMinutes } from "@vyoh/shared";

function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border bg-card/40 px-4 py-3 min-w-32">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums text-foreground/90">
        {value}
      </span>
    </div>
  );
}

function ChipPlaceholder({ label }: { label: string }) {
  return (
    <Chip label={label} value={<span className="text-muted-foreground/70">—</span>} />
  );
}

/**
 * Conclusion lifetime totals strip. The arc spec calls for "total LoL
 * matches, total Steam playtime, oldest tracked match date, oldest tracked
 * unlock date." Those alltime aggregates need a dedicated `/home/lifetime-
 * totals` endpoint that doesn't exist yet — landed as a follow-up to keep
 * R-5 from forking into API work. For now this strip surfaces the existing
 * weekly window absorbed from the retired `TileWeeklyTotals`, framed as
 * "the last seven days" so the framing reads honestly until the lifetime
 * aggregates land.
 */
export function LifetimeTotalsStrip() {
  const query = useHomeWeeklyTotals();
  const data = query.data;
  const endLabel = data
    ? new Date(data.weekEnd).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })
    : null;
  return (
    <section className="flex flex-col items-center gap-3 px-6 py-6 text-center">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {endLabel ? `The last seven days · ending ${endLabel}` : "The last seven days"}
      </span>
      <div className="flex flex-wrap justify-center gap-3">
        {data ? (
          <>
            <Chip label="LoL matches" value={data.lolMatchCount} />
            <Chip label="LoL time" value={formatHoursMinutes(data.lolMinutes)} />
            <Chip
              label="Steam time"
              value={
                data.steamMinutes > 0 ? (
                  formatHoursMinutes(data.steamMinutes)
                ) : (
                  <span className="text-muted-foreground/70">—</span>
                )
              }
            />
            <Chip label="Total" value={formatHoursMinutes(data.totalMinutes)} />
          </>
        ) : (
          <>
            <ChipPlaceholder label="LoL matches" />
            <ChipPlaceholder label="LoL time" />
            <ChipPlaceholder label="Steam time" />
            <ChipPlaceholder label="Total" />
          </>
        )}
      </div>
    </section>
  );
}
