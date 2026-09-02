import { formatTimeAgo } from "@vyoh/shared";

// First commit on this repo. Truthful and always derivable; decided
// 2026-05-14 over deploy / registration-style alternatives.
const LAUNCH_ISO = "2026-05-06";

function daysSince(iso: string): number {
  const launch = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - launch) / 86_400_000));
}

function FooterChip({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </span>
      <span className={`text-foreground/80 ${mono ? "font-mono" : "tabular-nums"}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Conclusion footer chips. Absorbs the bento's `TileBuildBadge` (last
 * deploy + commit hash) and `TileDomainAge` (days since launch) into a
 * single inline strip. The chips read as marginalia — the page already
 * said what it wanted to say.
 */
export function ConclusionFooterChips() {
  const deployRelative = formatTimeAgo(__BUILD_TIME__);
  const days = daysSince(LAUNCH_ISO);
  return (
    <footer className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 px-6 pb-12 pt-6">
      <FooterChip label="Deployed" value={deployRelative} />
      <FooterChip label="Commit" value={__BUILD_COMMIT__} mono />
      <FooterChip label="Live for" value={`${days} ${days === 1 ? "day" : "days"}`} />
    </footer>
  );
}
