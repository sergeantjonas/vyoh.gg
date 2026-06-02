// First commit on this repo. Truthful and always derivable; decided
// 2026-05-14 over deploy / registration-style alternatives.
const LAUNCH_ISO = "2026-05-06";

function daysSince(iso: string): number {
  const launch = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - launch) / 86_400_000));
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
  const deployRelative = formatRelative(__BUILD_TIME__);
  const days = daysSince(LAUNCH_ISO);
  return (
    <footer className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 px-6 pb-12 pt-6">
      <FooterChip label="Deployed" value={deployRelative} />
      <FooterChip label="Commit" value={__BUILD_COMMIT__} mono />
      <FooterChip label="Live for" value={`${days} ${days === 1 ? "day" : "days"}`} />
    </footer>
  );
}
