import { SHADOW_BODY, SHADOW_LABEL } from "@/home/recap/chapter-shadows";
import { useHomeLifetimeTotals } from "@/home/use-home-lifetime-totals";
import { OWNER_TIME_ZONE, formatHoursMinutes } from "@vyoh/shared";

const SINCE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

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

function formatCompactInt(n: number): string {
  // Compact alltime counts so a 5-digit match count doesn't break the chip
  // shape. Below 10k stays exact; above 10k drops to "12.3k", "108k" form.
  if (n < 10_000) return n.toLocaleString("en-GB");
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k.toFixed(k < 100 ? 1 : 0)}k`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(m < 100 ? 1 : 0)}M`;
}

function formatCompactHours(minutes: number): string {
  // Alltime playtime is on the order of 1000s of hours — reading e.g.
  // "1850h 14m" is noise. Round to whole hours above 100h, keep
  // h+m for shorter spans.
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 100) return `${formatCompactInt(hours)}h`;
  return formatHoursMinutes(minutes);
}

function formatSinceDate(iso: string | null): string {
  if (iso === null) return "—";
  // Single-line "Jan 2024" — chip is too tight for a full date and the
  // year/month is what carries the "how long has this been tracked"
  // signal.
  return SINCE_FMT.format(new Date(iso));
}

function formatBacklog(unplayed: number, owned: number): React.ReactNode {
  // Zero owned = zero state (e.g. Steam not yet synced). Drop to a dash so
  // we don't render "0 / 0" which reads as a real number.
  if (owned === 0) return <span className="text-muted-foreground/70">—</span>;
  return `${formatCompactInt(unplayed)} / ${formatCompactInt(owned)}`;
}

function pickEarliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

/**
 * Conclusion lifetime totals strip. Alltime self-portrait totals: LoL
 * match count + playtime, Steam playtime, and the dates of the oldest
 * tracked match / unlock. Owner-filtered server-side so non-owner
 * accounts in `accounts.json` don't pollute the alltime numbers.
 */
export function LifetimeTotalsStrip() {
  const query = useHomeLifetimeTotals();
  const data = query.data;
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <span
        className="text-[10px] uppercase tracking-[0.2em] text-foreground/70"
        style={{ textShadow: SHADOW_LABEL }}
      >
        Since launch
      </span>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        {data ? (
          <>
            <Chip label="LoL matches" value={formatCompactInt(data.lolMatchCount)} />
            <Chip label="LoL time" value={formatCompactHours(data.lolMinutes)} />
            <Chip
              label="Steam time"
              value={
                data.steamMinutes > 0 ? (
                  formatCompactHours(data.steamMinutes)
                ) : (
                  <span className="text-muted-foreground/70">—</span>
                )
              }
            />
            <Chip
              label="Backlog"
              value={formatBacklog(data.steamGamesUnplayed, data.steamGamesOwned)}
            />
            <Chip
              label="Tracking since"
              value={formatSinceDate(
                pickEarliest(data.oldestMatchAt, data.oldestUnlockAt)
              )}
            />
          </>
        ) : (
          <>
            <ChipPlaceholder label="LoL matches" />
            <ChipPlaceholder label="LoL time" />
            <ChipPlaceholder label="Steam time" />
            <ChipPlaceholder label="Backlog" />
            <ChipPlaceholder label="Tracking since" />
          </>
        )}
      </div>
    </section>
  );
}
